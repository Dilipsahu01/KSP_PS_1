# KSP Intelligent Conversational AI & Platform 

**Production Architecture Blueprint & Setup Guide**

This document serves as the authoritative, step-by-step guide for deploying the Karnataka State Police (KSP) Multi-Agent Database and AI Platform on a clean Linux (Ubuntu) environment. 

This platform leverages an autonomous Multi-Agent AI architecture (Semantic Routing, Agentic SQL Generation, and RAG Ingestion) built on top of a zero-trust, Row-Level Security (RLS) enabled MySQL data layer. 

---

## 1. System Prerequisites & Dependencies

To execute this platform, you require three background daemons running persistently:
1. **MySQL Server 8.0+** (Relational Data & Audit Cache)
2. **Ollama** (Local LLM Engine)
3. **Tesseract OCR** (For PDF Ingestion fallback)

Run the following terminal commands to provision your Ubuntu environment:

```bash
# Update repositories
sudo apt update && sudo apt upgrade -y

# 1. Install MySQL Server & start the daemon
sudo apt install mysql-server -y
sudo systemctl enable mysql
sudo systemctl start mysql

# 2. Install Tesseract OCR & Language Packs (English + Kannada)
sudo apt install tesseract-ocr tesseract-ocr-eng tesseract-ocr-kan -y

# 3. Install Ollama Runtime Engine
curl -fsSL https://ollama.com/install.sh | sh
```

---

## 2. Model Acquisition & Configuration

The local AI engine runs deterministically for Text-to-SQL tasks. We recommend `llama3` for its balance of speed and reasoning, or `phi3` for extremely lightweight deployments.

```bash
# Start the Ollama server in the background (or in a separate tmux/screen session)
ollama serve &

# Pull the primary routing and SQL generation model
ollama pull llama3

# Optional: Pull phi3 as a fast-fallback for RAG extraction
ollama pull phi3
```

**Terminal Smoke Test:**
Verify the model is responding locally:
```bash
curl -X POST http://localhost:11434/api/generate -d '{
  "model": "llama3",
  "prompt": "SELECT 1;",
  "stream": false
}'
```

---

## 3. Environment Configuration

In the root of your project `~/KSP_P1/`, create a `.env.local` file. This dictates the Next.js API constraints and the database connection pools.

```env
# .env.local

# Database Connection Pool
DB_HOST=localhost
DB_USER=root
DB_PASSWORD="YourSecurePassword"
DB_NAME=ksp_database
DB_AUDIT_USER=root

# Local LLM Routing
OLLAMA_ENDPOINT=http://localhost:11434/api/generate
OLLAMA_MODEL=llama3

# Application State
NEXT_PUBLIC_API_URL=http://localhost:3000
NODE_ENV=development
```

---

## 4. Execution Workflow

### A. Database Initialization
Ensure you have the `sql.txt` schema definition in the root directory. This will drop, recreate, and provision the `ksp_database` with 25 normalized tables, the `audit_log` table, and the RLS scoped views.

```bash
# Provision the Schema
sudo mysql -u root -p < sql.txt
```

### B. Node.js Next.js Gateway
The command center runs on the Next.js App Router, serving as the JWT gatekeeper and Semantic Intent Router.

```bash
# Install specific operational dependencies
npm install mysql2 next react react-dom typescript tailwindcss lucide-react recharts

# Spin up the development server
npm run dev
```

### C. Python Ingestion Worker
The backend OCR and vector ingestion runs via a detached Python script.

```bash
# Initialize a clean virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install pymupdf pytesseract datasketch pymongo

# Execute the worker daemon
python3 ingestion_worker.py
```

---

## 5. Verification & Testing Blueprints

Once all 3 subsystems (Ollama, Next.js, MySQL) are running, verify the Multi-Agent intent routing and Row-Level Security via curl.

**Test 1: Agentic Text-to-SQL (Authorized)**
```bash
curl -X POST http://localhost:3000/api/orchestrator \
-H "Content-Type: application/json" \
-H "Authorization: Bearer mock-jwt-token" \
-d '{"query": "How many arrests were there in District 12?"}'
```

**Test 2: Security Classifier Block (Unauthorized HR Query)**
```bash
curl -X POST http://localhost:3000/api/orchestrator \
-H "Content-Type: application/json" \
-H "Authorization: Bearer mock-jwt-token" \
-d '{"query": "Get the home address of the informant for case 101."}'
```
*Expected Result: HTTP 200 with XAI Envelope containing "RESTRICTED" NLP answer and block reasoning.*

---
**Architectural Note:** 
All API transactions return a standardized Explainable AI (XAI) payload, providing the caller with the `intent_routed`, the extracted variables, the `execution_details`, and the applied `security_context`. This guarantees full auditability for legal scrutiny.
