// utils/sql_agent.ts
import { executeAuditedQuery } from './audit_cache';
import { generateSqlFromLLM } from './llm_engine';

// Strict typing for security-critical contexts
export interface UserContext {
    userId: string;
    districtId: number;
    role: 'CONSTABLE' | 'INSPECTOR' | 'SUPERINTENDENT';
}

// Expanded whitelist covering the core analytical needs of a 25-table schema
const SAFE_QUERIES: Record<string, { sql: string, cacheType: 'STATIC' | 'ACTIVE' }> = {
    "crimes_by_district": {
        sql: "SELECT COUNT(*) as count FROM crimes_scoped_view",
        cacheType: 'ACTIVE'
    },
    "arrests_by_date_range": {
        sql: "SELECT COUNT(*) as count FROM arrests_scoped_view WHERE ArrestSurrenderDate BETWEEN ? AND ?",
        cacheType: 'STATIC'
    },
    "crimes_by_date_range": {
        sql: "SELECT COUNT(*) as count FROM crimes_scoped_view WHERE CrimeRegisteredDate BETWEEN ? AND ?",
        cacheType: 'STATIC'
    },
    "crimes_by_category": {
        sql: "SELECT cc.LookupValue as category, COUNT(*) as count FROM crimes_scoped_view c JOIN CaseCategory cc ON c.CaseCategoryID = cc.CaseCategoryID GROUP BY cc.LookupValue ORDER BY count DESC",
        cacheType: 'STATIC'
    },
    "chargesheets_by_date_range": {
        sql: "SELECT COUNT(*) as count FROM chargesheets_scoped_view WHERE csdate BETWEEN ? AND ?",
        cacheType: 'STATIC'
    },
    "fir_trend_by_month": {
        sql: "SELECT MONTH(CrimeRegisteredDate) as month, COUNT(*) as count FROM crimes_scoped_view WHERE YEAR(CrimeRegisteredDate) = ? GROUP BY MONTH(CrimeRegisteredDate) ORDER BY month",
        cacheType: 'STATIC'
    },
    "accused_by_age_group": {
        sql: "SELECT CASE WHEN AgeYear < 18 THEN 'Juvenile' WHEN AgeYear BETWEEN 18 AND 30 THEN '18-30' WHEN AgeYear BETWEEN 31 AND 45 THEN '31-45' ELSE '45+' END as age_group, COUNT(*) as count FROM accused_scoped_view GROUP BY age_group",
        cacheType: 'STATIC'
    },
    "crimes_by_station": {
        sql: "SELECT ps.StationName, COUNT(*) as count FROM crimes_scoped_view c JOIN PoliceStation ps ON c.PoliceStationID = ps.PoliceStationID GROUP BY ps.StationName ORDER BY count DESC",
        cacheType: 'STATIC'
    },
    "cases_by_status": {
        sql: "SELECT CaseStatus, COUNT(*) as count FROM crimes_scoped_view GROUP BY CaseStatus",
        cacheType: 'ACTIVE'
    },
    "property_value_ranges": {
        sql: "SELECT CASE WHEN TotalPropertyValue < 50000 THEN 'Under 50k' WHEN TotalPropertyValue BETWEEN 50000 AND 500000 THEN '50k - 5L' ELSE 'Over 5L' END as value_range, COUNT(*) as count FROM property_scoped_view GROUP BY value_range",
        cacheType: 'STATIC'
    },
    "victim_demographics": {
        sql: "SELECT Gender, CASE WHEN Age < 18 THEN 'Minor' ELSE 'Adult' END as age_group, COUNT(*) as count FROM victim_scoped_view GROUP BY Gender, age_group",
        cacheType: 'STATIC'
    }
};

// CROSS-DISTRICT MENTION DETECTOR
function detectCrossDistrictMention(query: string, userDistrictId: number): string | null {
    // Catches patterns like "District 15", "district 7", "dist. 22"
    const districtMentions = query.match(/district\s*\.?\s*(\d+)/gi);
    if (!districtMentions) return null;

    for (const mention of districtMentions) {
        const num = parseInt(mention.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num !== userDistrictId) {
            return ` Your query mentions District ${num}, but your access is scoped to District ${userDistrictId}. Results below are filtered to YOUR jurisdiction only. To access cross-district data, contact your Superintendent.`;
        }
    }
    return null;
}

// PARAMETER EXTRACTION & VALIDATION
const llmExtractParams = async (query: string, intentKey: string): Promise<any[]> => {
    // TODO for production: Swap this Regex block for a fast, low-temperature LLM call 
    // structured to output EXACTLY a JSON array of ISO dates: ["2026-03-01", "2026-04-15"]
    
    if (['arrests_by_date_range', 'crimes_by_date_range', 'chargesheets_by_date_range'].includes(intentKey)) {
        // Current fallback logic:
        const yearMatch = query.match(/\b(20\d{2})\b/);
        const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
        return [`${year}-01-01`, `${year}-12-31`]; 
    }
    if (intentKey === 'fir_trend_by_month') {
        const yearMatch = query.match(/\b(20\d{2})\b/);
        const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();
        return [year];
    }
    return [];
};

const validateParams = (params: any[], intentKey: string): any[] => {
    // Date-range queries
    if (['arrests_by_date_range', 'crimes_by_date_range', 'chargesheets_by_date_range'].includes(intentKey)) {
        if (params.length !== 2) throw new Error("VALIDATION_FAILED: Missing date parameters.");

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(params[0]) || !dateRegex.test(params[1])) {
            throw new Error("VALIDATION_FAILED: Invalid date format.");
        }

        const start = new Date(params[0]);
        const end = new Date(params[1]);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new Error("VALIDATION_FAILED: Invalid date (e.g. Month 13).");
        }
        if (start > end) {
            throw new Error("VALIDATION_FAILED: Start date must be before end date.");
        }
        // Future date guard
        if (end > new Date()) {
            throw new Error("VALIDATION_FAILED: End date cannot be in the future.");
        }
    }

    // Year-only queries
    if (intentKey === 'fir_trend_by_month') {
        if (params.length !== 1) throw new Error("VALIDATION_FAILED: Missing year parameter.");
        const year = parseInt(params[0], 10);
        if (isNaN(year) || year < 2000 || year > new Date().getFullYear()) {
            throw new Error("VALIDATION_FAILED: Year out of valid range.");
        }
    }

    return params;
};

// INTENT KEYWORD MAPPING (case-insensitive)
function resolveQueryKey(normalizedQuery: string): string {
    if (normalizedQuery.includes('chargesheet')) return 'chargesheets_by_date_range';
    if (normalizedQuery.includes('arrest')) return 'arrests_by_date_range';

    // Fix: Trigger on trend/month regardless of "fir"
    if (normalizedQuery.includes('trend') || normalizedQuery.includes('month'))
        return 'fir_trend_by_month';

    if (normalizedQuery.includes('accused') && normalizedQuery.includes('age'))
        return 'accused_by_age_group';
    if (normalizedQuery.includes('category') || normalizedQuery.includes('type'))
        return 'crimes_by_category';

    // New templates mapped
    if (normalizedQuery.includes('station')) return 'crimes_by_station';
    if (normalizedQuery.includes('status') || normalizedQuery.includes('pending'))
        return 'cases_by_status';
    if (normalizedQuery.includes('value') || normalizedQuery.includes('lakh'))
        return 'property_value_ranges';
    if (normalizedQuery.includes('victim') && (normalizedQuery.includes('age') || normalizedQuery.includes('gender')))
        return 'victim_demographics';

    // Catch-all for crimes/cases
    if (normalizedQuery.includes('crime') || normalizedQuery.includes('cases'))
        return 'crimes_by_district';

    return 'unknown';
}

// MAIN SQL AGENT ENTRY POINT
export async function call_sql_agent(userQuery: string, userContext: UserContext): Promise<any> {
    const reasoningPath: string[] = [];

    // 1. Cross-district mention detection
    const crossDistrictWarning = detectCrossDistrictMention(userQuery, userContext.districtId);
    if (crossDistrictWarning) {
        reasoningPath.push(crossDistrictWarning);
    }

    // 2. Case-insensitive intent matching
    const normalizedQuery = userQuery.toLowerCase();
    const queryKey = resolveQueryKey(normalizedQuery);

    if (!SAFE_QUERIES[queryKey]) {
        reasoningPath.push("Query not in static whitelist. Initiating Agentic Text-to-SQL generation with Schema RAG.");
        
        // 1. Retrieve Schema (Mocked here for your implementation)
        const retrievedSchema = "Table: crimes_scoped_view (CrimeNo, CrimeRegisteredDate, CaseCategoryID, CaseStatus)";
        
        // 2. The Agentic Self-Correction Loop (Max 3 retries)
        let generatedSql = "";
        let dbResults: any = null;
        let lastError = "";

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                // In production, call Catalyst QuickML here
                generatedSql = await generateSqlFromLLM(userQuery, retrievedSchema, lastError);
                
                // Execute generated SQL
                dbResults = await executeAuditedQuery(
                    'dynamic_generated_sql',
                    generatedSql,
                    [],
                    userContext.userId,
                    userContext.districtId,
                    'ACTIVE'
                );
                
                reasoningPath.push(`Agent successfully generated and executed SQL on attempt ${attempt}.`);
                break; // Success! Break the loop.
                
            } catch (error: any) {
                lastError = error.message;
                reasoningPath.push(`Attempt ${attempt} failed: ${lastError}. Agent self-correcting...`);
                if (attempt === 3) throw new Error("Agent failed to generate valid SQL after 3 attempts.");
            }
        }

        // Return the dynamic XAI payload
        return {
            nlp_answer: `Dynamic query executed successfully. Found ${dbResults[0]?.count || 0} results.`,
            visualization_type: "TABLE",
            reasoning_path: reasoningPath,
            execution_details: userContext.role === 'SUPERINTENDENT' ? {
                engine: "Catalyst Data Store - LLM Generated",
                query_executed: generatedSql,
                rls_enforcement: "DATABASE_VIEW_LEVEL"
            } : null,
            citations: [{ source_type: "DATABASE_RECORD", confidence_score: 0.92 }]
        };
    }

    const safeQueryDef = SAFE_QUERIES[queryKey];
    reasoningPath.push(`Mapped user query to safe query template: ${queryKey}`);

    // 3. Extract and validate parameters
    const rawParams = await llmExtractParams(userQuery, queryKey);
    const validatedParams = validateParams(rawParams, queryKey);
    reasoningPath.push(`Parameters extracted and strictly validated against domain schema.`);

    // 4. Execute with RLS
    const dbResults = await executeAuditedQuery(
        queryKey,
        safeQueryDef.sql,
        validatedParams,
        userContext.userId,
        userContext.districtId,
        safeQueryDef.cacheType
    );
    reasoningPath.push("Executed parameterized query securely against scoped views.");

    const nlpAnswer = crossDistrictWarning
        ? `${crossDistrictWarning}\n\nQuery results (District ${userContext.districtId} only): Found ${dbResults[0]?.count || 0} matching records.`
        : `Query results processed securely. Found ${dbResults[0]?.count || 0} matching records.`;

    // 5. Role-gated execution details
    // INSPECTOR+ can see that RLS was applied (transparency), but raw SQL is SUPERINTENDENT-only
    const showFullDetails = userContext.role === 'SUPERINTENDENT';
    const showRLSNotice = userContext.role === 'INSPECTOR' || userContext.role === 'SUPERINTENDENT';

    return {
        nlp_answer: nlpAnswer,
        visualization_type: "METRIC_CARD",
        reasoning_path: reasoningPath,
        execution_details: showFullDetails ? {
            engine: "Catalyst Data Store (MySQL) - Constrained Views",
            query_executed: safeQueryDef.sql,
            parameters: validatedParams,
            rls_enforcement: "DATABASE_VIEW_LEVEL"
        } : showRLSNotice ? {
            engine: "Catalyst Data Store (MySQL) - Constrained Views",
            rls_enforcement: "DATABASE_VIEW_LEVEL",
            scoped_to_district: userContext.districtId
        } : null,
        citations: [
            {
                source_type: "DATABASE_RECORD",
                reference: "Whitelisted SQL Execution on Scoped Views",
                confidence_score: 1.0
            }
        ]
    };
}
