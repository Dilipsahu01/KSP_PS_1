# KSP AI Platform: Granular Implementation Guide

This document defines the low-level implementation details for the KSP Crime Database AI platform, focusing on multilingual voice, massive data ingestion, transparent payload structures, and dynamic few-shot prompt engineering.

---

## 1. Multilingual & Voice Integration (Next.js + Catalyst)

Handling real-time Voice (English and Kannada) requires a highly optimized streaming architecture to prevent UX blocking.

### Architecture & Workflow
1.  **Frontend Capture (Next.js):** 
    *   Use the browser's native `MediaRecorder` API to capture audio chunks (`audio/webm;codecs=opus`).
    *   Stream these chunks via WebSockets or send a finalized Blob via HTTP POST to a Catalyst API Gateway endpoint.
2.  **Transcription & Translation Gateway (Catalyst Serverless):**
    *   **Primary Engine:** Utilize **Catalyst Zia Services (Speech-to-Text & Translation)** as mandated by the Catalyst ecosystem.
    *   **Accuracy Fallback (Bhashini):** If Zia's Kannada handling lacks legal/police vocabulary accuracy, integrate the Government of India's **Bhashini API** (specifically tuned for Indian languages) as a lightweight, low-latency microservice call.
    *   **Workflow:** Audio (Kannada) -> STT (Kannada Text) -> Translate (English Text).
3.  **Routing:** The English text is passed to the Intent Routing Engine (detailed in the main blueprint).
4.  **Response Generation:** The final English NLP response is translated back to Kannada and passed through **Catalyst Zia Text-to-Speech (TTS)** to return an audio buffer to the frontend.

### Latency Optimization Strategy
*   **Avoid heavy LLMs for translation:** Do not use GPT-4/Claude for translation. Dedicated NMT (Neural Machine Translation) models like Bhashini or Zia Translation have significantly lower TTFT (Time to First Token) and cost.

---

## 2. Historical Data Ingestion Pipeline (100,000+ PDFs)

Processing 100,000 unstructured case PDFs requires a robust, distributed worker pipeline to extract text, chunk semantically, deduplicate, and embed without hitting API rate limits or out-of-memory errors.

### The Pipeline Architecture
1.  **Extraction:** Use **Catalyst SmartBrowz** (or PyMuPDF in a Python worker) to extract raw text.
2.  **Semantic Chunking:** Use recursive character splitting. Split by double newlines (`\n\n` - paragraphs), then single newlines, then spaces. Target chunk size: 500 tokens with 100 token overlap to preserve investigative context (e.g., suspect descriptions spanning page breaks).
3.  **Deduplication (SHA-256):** Before embedding, hash the chunk text. Check the hash against a `ProcessedHashes` collection in **Catalyst NoSQL**. If it exists, skip embedding to save costs.
4.  **Batch Embedding:** Send chunks in batches of 100 to **Catalyst QuickML** embedding endpoints. Store results in the QuickML Vector DB.

### Python Worker Strategy (Pseudo-code for Catalyst Job Scheduling)

```python
import hashlib
import concurrent.futures
from text_splitter import RecursiveCharacterTextSplitter

def process_pdf_batch(pdf_uris):
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    
    for uri in pdf_uris:
        text = extract_text_from_pdf(uri) # via SmartBrowz
        chunks = splitter.split_text(text)
        
        valid_chunks = []
        for chunk in chunks:
            chunk_hash = hashlib.sha256(chunk.encode('utf-8')).hexdigest()
            # Redis/NoSQL Deduplication check
            if not cache.exists(chunk_hash):
                valid_chunks.append({"text": chunk, "hash": chunk_hash, "source": uri})
                cache.set(chunk_hash, True)
                
        # Batch embed to avoid network overhead per chunk
        if valid_chunks:
            embeddings = quickml.embed_batch([c["text"] for c in valid_chunks])
            vector_db.upsert(valid_chunks, embeddings)

# Execute via ThreadPool for network-bound API calls
def handler(event, context):
    pdf_queue = fetch_unprocessed_pdfs(limit=1000)
    batch_size = 50
    batches = [pdf_queue[i:i + batch_size] for i in range(0, len(pdf_queue), batch_size)]
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        executor.map(process_pdf_batch, batches)
```

---

## 3. Explainable AI (XAI) Payload Structure

For law enforcement, "black box" AI is unacceptable. The Catalyst API must return a highly structured JSON response to Next.js so the UI can render citations, SQL queries, and reasoning steps.

### Standardized Orchestrator JSON Response

```json
{
  "query_id": "req-9a8b7c6d",
  "intent_routed": "TEXT_TO_SQL",
  "processing_time_ms": 842,
  "response": {
    "nlp_answer": "There were 142 vehicle thefts reported in the Central District during Q3 2023. The clearance rate was 21%.",
    "visualization_type": "BAR_CHART"
  },
  "explainability": {
    "reasoning_path": [
      "User intent classified as statistical aggregation.",
      "Retrieved schemas for CaseMaster and District.",
      "Generated MySQL query joining CaseMaster and District on DistrictID.",
      "Executed query successfully. Extracted counts."
    ],
    "execution_details": {
      "engine": "Catalyst Data Store (MySQL)",
      "query_executed": "SELECT COUNT(*) as thefts FROM CaseMaster cm JOIN District d ON cm.DistrictID = d.DistrictID WHERE d.DistrictName = 'Central' AND cm.CrimeMajorHeadID = 14 AND cm.CrimeRegisteredDate BETWEEN '2023-07-01' AND '2023-09-30';"
    },
    "citations": [
      {
        "source_type": "DATABASE_RECORD",
        "reference": "Aggregated from CaseMaster (CrimeMajorHeadID=14)",
        "confidence_score": 1.0
      }
    ]
  },
  "security_context": {
    "applied_filters": ["DistrictID = 12"],
    "user_role": "INVESTIGATOR"
  }
}
```
*Note: If the route was Semantic RAG, the `execution_details` would show the vector search parameters, and `citations` would array the specific PDF filenames and page numbers retrieved.*

---

## 4. Few-Shot Prompt Injection for Text-to-SQL

Dynamic Schema retrieval prevents context bloat, but the LLM still needs examples of KSP's specific query style to avoid hallucinating invalid JOINs on highly normalized tables. 

**Solution:** We maintain a second, smaller Vector DB containing "Gold Standard" SQL query examples. When a user asks a question, we embed it, retrieve the top 2 closest historical SQL examples, and inject them into the prompt.

### The Dynamic System Prompt Template

```text
You are an expert Law Enforcement Data Analyst and MySQL Specialist for the Karnataka State Police.
Your task is to translate the user's natural language question into a highly optimized, syntactically correct MySQL query.

### RULES:
1. ONLY use the tables and columns provided in the [SCHEMA] section below.
2. DO NOT hallucinate columns.
3. ALWAYS apply the Security Context filters provided.
4. Output ONLY the raw SQL query. Do not provide explanations.

### [RETRIEVED SCHEMA]
{dynamic_schema_injection}
// Example: Table: CaseMaster (CaseMasterID, CrimeRegisteredDate, PoliceStationID, DistrictID, CrimeMajorHeadID...)

### [GOLD STANDARD EXAMPLES]
{dynamic_few_shot_injection}
// Example Q: "How many murders in 2022?" 
// Example A: SELECT COUNT(*) FROM CaseMaster WHERE CrimeMajorHeadID = 1 AND YEAR(CrimeRegisteredDate) = 2022;

### [SECURITY CONTEXT]
The current user is restricted to DistrictID: {user_district_id}.
You MUST append "AND DistrictID = {user_district_id}" to the WHERE clause of your main query.

### [USER QUERY]
{user_natural_language_query}

### [MYSQL OUTPUT]
```

This dynamic, few-shot injection strategy drastically improves the first-pass accuracy of the Text-to-SQL agent, minimizing the need for the slower self-correction loop.
