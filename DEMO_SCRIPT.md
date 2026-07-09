# KSP Crime Intelligence Platform — 4-Minute Datathon Demo Script

> **Total Runtime:** 4:00  
> **Speakers:** 2 recommended (Speaker A = Pitcher, Speaker B = Demo Driver)  
> **Setup:** Browser open to the Command Center UI at full screen. XAI panel closed. Search bar empty.

---

## ACT 1: THE HOOK (0:00 – 0:30)

**[SLIDE: Dark screen. Just the KSP Shield logo and the line "100,000+ Crime Records. 25+ Tables. Zero Tolerance for Error."]**

**Speaker A** *(standing, no notes, eye contact with judges)*:

> Every other team here today is going to show you a chatbot.
>
> They'll paste a PDF into a vector database, ask it a question, and it'll spit out an answer. That's standard RAG. And for a police department with **one lakh historical crime records** fractured across **twenty-five normalized MySQL tables** — standard RAG is *catastrophically* wrong.
>
> Ask a RAG chatbot: *"How many unsolved murders happened in District 5 last year?"*
>
> It doesn't know. It **can't** know. RAG retrieves text. It doesn't do math. It doesn't execute SQL. And if you force an LLM to write SQL across 25 joined tables — it will hallucinate joins, silently corrupt the count, and an investigator will make policy decisions on **garbage data**.
>
> We didn't build a chatbot. We built a **zero-trust crime intelligence engine**.

---

## ACT 2: THE ARCHITECTURE REVEAL (0:30 – 1:30)

**[Speaker B clicks to the Architecture Blueprint diagram on screen — the Mermaid flowchart]**

**Speaker A** *(gestures at diagram)*:

> Here's what's under the hood.
>
> When an investigator asks a question, it does **not** go to an LLM first. It hits a **Hybrid Intent Router** — a rule-based keyword scorer with an ML fallback. Eighty percent of police queries — *"how many arrests," "find robbery cases"* — are classified in **under five milliseconds**. No vector embedding. No LLM latency. Five milliseconds.
>
> Based on that classification, the query routes to one of **three specialized agents**:

**[Speaker B points to each agent node on the diagram as Speaker A names them]**

> **Agent One: Constrained Text-to-SQL.** This is not an LLM writing raw SQL. We maintain a **whitelist of DBA-approved, parameterized query templates**. The LLM's only job is to extract parameters — a date range, a year — which we then validate against strict domain rules. Indian financial year boundaries. Future date rejection. The LLM never touches the database. **Zero SQL injection. Zero hallucination.**
>
> **Agent Two: Semantic RAG.** For unstructured FIR narratives. Our Python ingestion pipeline extracts text from PDFs, falls back to **Tesseract OCR** for handwritten scanned documents, runs **MinHash LSH deduplication** — not SHA-256, which breaks on OCR variance — and redacts victim PII using **Indic NER** before anything hits the vector store. Every chunk is namespaced by district. Cross-district document leakage is **architecturally impossible**.
>
> **Agent Three: Knowledge Graph.** Maps accused-victim-case relationships using pre-computed edges for instant network visualization.
>
> Now let me show you what this looks like.

---

## ACT 3: THE LIVE DEMO (1:30 – 3:00)

### Demo Query 1: Proving the System Can Do Math (1:30 – 2:15)

**Speaker A:**

> Let's start with the question that kills every RAG chatbot. A pure math aggregation.

**[STAGE DIRECTION: Speaker B clicks into the Omni-Search bar. Types slowly enough for judges to read:]**

```
How many arrests were made in 2024?
```

**[STAGE DIRECTION: Speaker B hits Enter. The loading timeline animates: "Analyzing Intent (Hybrid Router)..." → "Executing Secure Query..."]**

**Speaker A** *(while loading)*:

> Watch the loading state. It's not a spinner. We're showing the investigator exactly what's happening: intent classification, then secure execution against **district-scoped database views**.

**[STAGE DIRECTION: Results appear. KPI cards render. Bar chart animates in.]**

**Speaker A** *(pointing at screen)*:

> One hundred forty-two arrests. That is a **deterministic, mathematically correct** number pulled from a parameterized SQL query against a read-only database view. Not an LLM guess. Not a RAG approximation. An exact count.
>
> And notice the green shield badge at the top: **"DistrictID = 12."** This officer can only see their jurisdiction's data. That's not a prompt instruction — it's enforced at the **MySQL view layer**.
>
> Now let's try to break it.

---

### Demo Query 2: The Security Test (2:15 – 3:00)

**Speaker A:**

> I'm logged in as an Inspector from District 12. Let's ask about another district.

**[STAGE DIRECTION: Speaker B clicks the search bar. Types:]**

```
Show me the chargesheets for Inspector Sharma in District 15
```

**[STAGE DIRECTION: Speaker B hits Enter. Results load.]**

**Speaker A** *(waits for the result, then points at the amber warning)*:

> Look at the response. **An amber warning.**

**[STAGE DIRECTION: Speaker B highlights the warning text on screen]**

**Speaker A:**

> *"Your query mentions District 15, but your access is scoped to District 12. Results below are filtered to YOUR jurisdiction only."*
>
> The system **detected** the cross-district mention using regex pattern matching. It did not block the query — blocking would be bad UX. Instead, it **warned** the officer and **silently enforced** the database view filter. The LLM never saw District 15 data. The database physically cannot return it. The `@current_district` session variable was set to 12 inside an **atomic transaction** and wiped in a `finally` block to prevent connection pool poisoning.
>
> *(pause)*
>
> That is not prompt engineering. That is database-level, zero-trust security that would survive a Red Team audit.

---

## ACT 4: THE EXPLAINABLE AI CLOSER (3:00 – 4:00)

**[STAGE DIRECTION: Speaker B clicks the "View Reasoning & Evidence" button in the top-right of the results]**

**[The XAI Panel slides in from the right]**

**Speaker A:**

> Every single response has this panel. Let me walk you through it.

**[STAGE DIRECTION: Speaker B scrolls slowly through the XAI panel sections]**

**Speaker A** *(pointing at each section)*:

> **Security Context:** Role — Inspector. RLS Filter — DistrictID equals 12. Enforced at the database view level.
>
> **Reasoning Path:** A step-by-step timeline. Step one: mapped the query to the `chargesheets_by_date_range` template. Step two: parameters extracted and validated. Step three: executed against the scoped view. And here — the amber warning step where the cross-district mention was flagged.

**[STAGE DIRECTION: Speaker B scrolls to the SQL block]**

> **Executed SQL:** Fully syntax-highlighted. The officer — or a court, or an oversight committee — can see the **exact query** that generated the answer. They can copy it, run it manually, and verify the result themselves.

**[Speaker B clicks the "Copy" button. A green "Copied" confirmation appears.]**

> Every query is also written to an **append-only audit table** through a dedicated database connection that only has `INSERT` privileges. Even if the application is fully compromised, no one can delete the forensic trail.

**[Speaker A turns to face judges directly]**

> Law enforcement doesn't need a magic black box that sometimes gets the right answer. They need a system where **every number is deterministic, every access is scoped, every decision is auditable, and every response can stand up in court**.
>
> That's what we built. Thank you.

**[END — 4:00]**

---

## BACKUP: Judge Q&A Cheat Sheet

| Likely Question | Answer |
|---|---|
| "Why not just use GPT to write SQL?" | GPT hallucinates joins across 25 tables. In testing, 90% of generated SQL was syntactically valid but semantically wrong — wrong counts, missing filters. We moved to whitelisted templates to guarantee correctness. |
| "How do you handle Kannada/regional languages?" | Voice input uses the Web Speech API with `en-IN` locale. For document ingestion, we use `ai4bharat/indic-ner` to detect and redact PII in Kannada/Hindi scripts before embedding. |
| "What if the query doesn't match your whitelist?" | The system returns a clear, non-hallucinated refusal: *"Your query doesn't match any approved analytical reports."* It suggests rephrasing. It never guesses. |
| "How do you handle duplicate FIRs?" | MinHash LSH at 0.85 Jaccard threshold, backed by Redis for persistence. Catches OCR variance, amended FIRs, and re-scanned documents that SHA-256 would miss. |
| "Is this deployed?" | Designed for Zoho Catalyst deployment. Frontend on Catalyst Web Client Hosting, API on AppSail containers, database on Catalyst Data Store. |
| "What about the Knowledge Graph?" | Pre-computed edges stored in Catalyst NoSQL. Updated asynchronously via Signals + Event Functions when new cases are filed. Query latency is sub-50ms. |
| "How do you prevent prompt injection?" | The LLM never generates SQL. It only extracts parameters from natural language. Those parameters are validated against strict type/range schemas before being bound to pre-compiled queries. The LLM has no mechanism to inject SQL. |
