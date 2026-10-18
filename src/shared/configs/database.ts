import { Pool, types } from 'pg';
import type { PoolConfig } from 'pg';
import env from '@/shared/configs/env.js';

export function parseDatabaseUrl(databaseUrl: string) {
    const url = new URL(databaseUrl);

    const host = url.hostname.trim();
    const port = Number(url.port || '5432');
    const user = decodeURIComponent(url.username).trim();
    const password = decodeURIComponent(url.password);
    const database = url.pathname.slice(1).trim();

    const sslModeParam = url.searchParams.get('sslmode');
    const sslMode = sslModeParam
        ? ['require', 'true', 'enable'].includes(sslModeParam)
        : process.env.DB_SSL_MODE === 'true';

    return {
        host,
        port,
        user,
        password,
        database,
        sslMode,
    };
}

const dbEnvConfig = parseDatabaseUrl(env.DATABASE_URL);

if (!dbEnvConfig.host || !dbEnvConfig.port || !dbEnvConfig.user || !dbEnvConfig.database)
    throw new Error('Invalid database URL in Database service');

const dbConfig: PoolConfig = {
    user: dbEnvConfig.user,
    password: dbEnvConfig.password,
    host: dbEnvConfig.host,
    database: dbEnvConfig.database,
    port: dbEnvConfig.port,
    max: 80,

    connectionTimeoutMillis: 30000, // i.e. "connect_timeout" // (30 seconds X 1000 milliseconds)
    idleTimeoutMillis: 900000, // (15 minutes X 60 seconds X 1000 milliseconds)
    statement_timeout: 30000, // (30 seconds X 1000 milliseconds)
    query_timeout: 30000, // (30 seconds X 1000 milliseconds)
};

if (dbEnvConfig.sslMode) {
    dbConfig.ssl = {
        rejectUnauthorized: false,
    };
}

// types.setTypeParser(1114, (dateStr) => new Date(`${dateStr} UTC`));
types.setTypeParser(1700, (val) => parseFloat(val));

// Type OID 1082 = DATE in PostgreSQL
types.setTypeParser(1082, (value) => value); // returns 'YYYY-MM-DD' string as-is

export const pool = new Pool(dbConfig);
