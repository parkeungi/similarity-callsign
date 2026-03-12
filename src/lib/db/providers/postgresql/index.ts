// PostgreSQL Provider 구현 - pg.Pool 기반, query(sql,params)→{rows}·transaction(fn)·initSchema() 메서드, DATABASE_URL 환경변수 사용
import { Pool } from 'pg';
import type { DatabaseProvider, QueryResult } from '../../interface';
import { initializeSchema } from './schema';

export class PostgreSQLProvider implements DatabaseProvider {
  private pool: Pool;
  private initialized = false;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('[PostgreSQLProvider] DATABASE_URL is not set');
    }

    const shouldDisableSslVerify =
      process.env.DB_DISABLE_SSL_VERIFY === 'true' ||
      process.env.NODE_ENV !== 'production' ||
      /supabase\.co/.test(connectionString);

    let normalizedConnectionString = connectionString;
    try {
      const url = new URL(connectionString);
      if (url.searchParams.has('sslmode')) {
        url.searchParams.delete('sslmode');
      }
      normalizedConnectionString = url.toString();
    } catch {
      // ignore parse error, fallback to original connection string
    }

    const sslConfig = shouldDisableSslVerify ? { rejectUnauthorized: false } : undefined;
    this.pool = new Pool({
      connectionString: normalizedConnectionString,
      ssl: sslConfig,
    });

    this.pool.on('error', err => {
      console.error('[PostgreSQLProvider] Pool error', err);
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    const client = await this.pool.connect();
    try {
      await initializeSchema(client);
      this.initialized = true;
    } finally {
      client.release();
    }
  }

  async query(text: string, params: any[] = []): Promise<QueryResult> {
    await this.ensureInitialized();
    const sql = text;
    const result = await this.pool.query(sql, params);
    return {
      rows: result.rows ?? [],
      rowCount: result.rowCount ?? 0,
      changes: result.rowCount ?? 0,
    };
  }

  async transaction<T>(
    callback: (query: (text: string, params?: any[]) => Promise<QueryResult>) => Promise<T>
  ): Promise<T> {
    await this.ensureInitialized();
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const queryFn = async (text: string, params: any[] = []) => {
        const sql = text;
        const result = await client.query(sql, params);
        return {
          rows: result.rows ?? [],
          rowCount: result.rowCount ?? 0,
          changes: result.rowCount ?? 0,
        };
      };

      const value = await callback(queryFn);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async closePool(): Promise<void> {
    await this.pool.end();
  }
}
