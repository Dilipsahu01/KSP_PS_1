// utils/llm_engine.ts
const OLLAMA_URL = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434/api/generate';

export async function generateSqlFromLLM(userQuery: string, schema: string, lastError: string): Promise<string> {
    const prompt = `You are a MySQL expert generating queries for a police database.
Schema: ${schema}
User Query: "${userQuery}"
${lastError ? `Your previous attempt failed with error: ${lastError}. Fix the syntax.` : ''}

CRITICAL RULE: Return ONLY the raw SQL query. Do not include markdown formatting (like \`\`\`sql). Do not include explanations.`;

    const res = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'llama3',
            prompt: prompt,
            stream: false,
            temperature: 0.1 // Low temp for deterministic SQL
        })
    });

    if (!res.ok) throw new Error(`Ollama Error: ${res.statusText}`);
    const data = await res.json();
    
    // Strip markdown if the LLM ignores the prompt rule
    let sql = data.response.trim();
    sql = sql.replace(/```sql/ig, '').replace(/```/g, '').trim();
    return sql;
}
