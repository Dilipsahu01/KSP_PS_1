// utils/audit_cache.ts
import * as crypto from 'crypto';

import mysql from 'mysql2/promise';

// Main pool for query execution
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ksp_database',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true // Required for SET @current_district execution
});

// Dedicated restricted pool for auditing (Append-only)
const auditPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_AUDIT_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ksp_database',
    waitForConnections: true,
    connectionLimit: 5
});

export interface AuditEvent {
    userId: string;
    districtId: number;
    action: string;
    queryKey: string;
    paramsHash: string;
    outcome: string;
}

// Security Fix 6: Logs query_key (reconstructable) + paramsHash (non-Pii evidence)
async function writeAuditLog(event: AuditEvent) {
    await auditPool.execute(
        `INSERT INTO audit_log 
         (timestamp, user_id, district_id, action, query_key, params_hash, outcome)
         VALUES (NOW(), ?, ?, ?, ?, ?, ?)`,
        [event.userId, event.districtId, event.action, 
         event.queryKey, event.paramsHash, event.outcome]
    );
}

// Global cache (In production, replace Map with Redis for distributed persistence)
const globalCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL_MS = 3600 * 1000; // 1 hour for STATIC queries

export async function executeAuditedQuery(
    queryKey: string,
    query: string, 
    params: any[], 
    userId: string, 
    districtId: number, 
    cacheStrategy: 'STATIC' | 'ACTIVE'
) {
    const hashInput = query + JSON.stringify(params);
    const queryHash = crypto.createHash('sha256').update(hashInput).digest('hex');
    const cacheKey = `query:${districtId}:${queryHash}`;

    await writeAuditLog({
        userId, districtId, action: 'INTENT_TO_EXECUTE', queryKey, paramsHash: queryHash, outcome: 'PENDING'
    });

    if (cacheStrategy === 'STATIC') {
        const cached = globalCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
            await writeAuditLog({
                userId, districtId, action: 'CACHE_HIT', queryKey, paramsHash: queryHash, outcome: 'SUCCESS'
            });
            return cached.data;
        }
        globalCache.delete(cacheKey); 
    }

    const connection = await pool.getConnection();
    try {
        await connection.execute('SET @current_district = ?', [districtId]);
        const [rows] = await connection.execute(query, params);
        
        if (cacheStrategy === 'STATIC') {
            globalCache.set(cacheKey, { data: rows, timestamp: Date.now() });
        }
        
        await writeAuditLog({
            userId, districtId, action: 'EXECUTED_SUCCESSFULLY', queryKey, paramsHash: queryHash, outcome: 'SUCCESS'
        });
        
        return rows;
    } catch (err: any) {
        await writeAuditLog({
            userId, districtId, action: 'EXECUTION_FAILED', queryKey, paramsHash: queryHash, outcome: err.message
        });
        throw err;
    } finally {
        if (connection && typeof connection.execute === 'function') {
            try {
                await connection.execute('SET @current_district = NULL');
            } catch (cleanupErr) {
                console.error("Failed to clear RLS context:", cleanupErr);
            }
            connection.release();
        }
    }
}
