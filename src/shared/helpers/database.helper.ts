import { pool } from '@/shared/configs/database.js';

type PrimitiveParam = string | number | boolean | null | Date;
type QueryParams = PrimitiveParam[];
type NamedParams = Record<string, PrimitiveParam | undefined>;

function convertNamedQueryToPositional(sqlStmt: string, params: NamedParams = {}) {
    const values: QueryParams = [];
    let paramIndex = 1;

    const newQueryText = sqlStmt.replace(/\$\w+/g, (match: string) => {
        const paramName = match.substring(1); // Remove the $
        values.push(params[paramName] ?? null);
        const result = `$${paramIndex}`;
        paramIndex += 1;
        return result;
    });

    return { sqlStmt: newQueryText, params: values };
}

function convertStringLiteralToQuery(strings: string[], ...values: QueryParams) {
    return {
        sqlStmt: strings.reduce(
            (query: string, str: string, i: number) =>
                query + str + (i < values.length ? `$${i + 1}` : ''),
            '',
        ),
        params: values,
    };
}

function createQueryHelpers(
    executor: (sqlStmt: string, params?: QueryParams) => Promise<{ rows: any[] }>,
) {
    async function queryAll<T = any>(sqlStmt: string, params?: QueryParams): Promise<T[]> {
        const res = await executor(sqlStmt, params);
        return res.rows;
    }

    async function queryOne<T = any>(sqlStmt: string, params?: QueryParams): Promise<T | null> {
        const res = await queryAll<T>(sqlStmt, params);
        return res[0] ?? null;
    }

    async function namedQueryAll<T = any>(sqlStmt: string, params?: NamedParams): Promise<T[]> {
        const newQuery = convertNamedQueryToPositional(sqlStmt, params);
        return queryAll<T>(newQuery.sqlStmt, newQuery.params);
    }

    async function namedQueryOne<T = any>(
        sqlStmt: string,
        params?: NamedParams,
    ): Promise<T | null> {
        const res = await namedQueryAll<T>(sqlStmt, params);
        return res[0] ?? null;
    }

    async function queryLiteralAll<T = any>(
        strings: string[],
        ...values: QueryParams
    ): Promise<T[]> {
        const newQuery = convertStringLiteralToQuery(strings, ...values);
        return queryAll<T>(newQuery.sqlStmt, newQuery.params);
    }

    async function queryLiteralOne<T = any>(
        strings: string[],
        ...values: QueryParams
    ): Promise<T | null> {
        const res = await queryLiteralAll<T>(strings, ...values);
        return res[0] ?? null;
    }

    return {
        queryAll,
        queryOne,
        namedQueryAll,
        namedQueryOne,
        queryLiteralAll,
        queryLiteralOne,
    };
}

async function getConnection() {
    const client = await pool.connect();
    const helpers = createQueryHelpers((sqlStmt, params) => client.query(sqlStmt, params));
    let is_in_transaction = false;

    async function begin() {
        if (is_in_transaction) return;
        await client.query('BEGIN');
        is_in_transaction = true;
    }

    async function commit() {
        if (!is_in_transaction) return;
        await client.query('COMMIT');
        is_in_transaction = false;
    }

    async function rollback() {
        if (!is_in_transaction) return;
        await client.query('ROLLBACK');
        is_in_transaction = false;
    }

    const obj = {
        client,
        query: (sqlStmt: string, params?: QueryParams) => client.query(sqlStmt, params),
        release: () => client.release(),
        ...helpers,
        begin,
        commit,
        rollback,
    };

    return obj;
}

const poolHelpers = createQueryHelpers((sqlStmt, params) => pool.query(sqlStmt, params));

export type DatabaseClient = Awaited<ReturnType<typeof getConnection>>;

export default {
    pool,
    getConnection,
    query: (sqlStmt: string, params?: QueryParams) => pool.query(sqlStmt, params),
    ...poolHelpers,
};
