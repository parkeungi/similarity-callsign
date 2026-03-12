// DatabaseProvider 인터페이스 정의 - query(sql,params)→{rows}·transaction(fn)·close() 메서드 시그니처
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
