/**
 * 공통 데이터베이스 인터페이스 정의
 */

export interface QueryResult {
  rows: any[];
  rowCount: number;
  changes?: number;
}

export interface DatabaseProvider {
  query(text: string, params?: any[]): Promise<QueryResult>;
  transaction<T>(
    callback: (query: (text: string, params?: any[]) => Promise<QueryResult>) => Promise<T>
  ): Promise<T>;
  closePool(): Promise<void>;
}
