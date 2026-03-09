import type { DatabaseProvider, QueryResult } from './interface';
import { PostgreSQLProvider } from './providers/postgresql';

let provider: DatabaseProvider | null = null;

function getProvider(): DatabaseProvider {
  if (provider) {
    return provider;
  }
  provider = new PostgreSQLProvider();
  return provider;
}

export async function query(text: string, params?: any[]): Promise<QueryResult> {
  return getProvider().query(text, params);
}

export async function transaction<T>(
  callback: (query: (text: string, params?: any[]) => Promise<QueryResult>) => Promise<T>
): Promise<T> {
  return getProvider().transaction(callback);
}

export async function closePool(): Promise<void> {
  if (provider) {
    await provider.closePool();
    provider = null;
  }
}
