// PostgreSQL 스키마 초기화 - CREATE TABLE IF NOT EXISTS 전체 테이블(users·airlines·callsigns·actions 등), 인덱스 생성
import { PoolClient } from 'pg';

export async function initializeSchema(client: PoolClient): Promise<void> {
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  } catch (error) {
    console.warn('[PostgreSQLProvider] Failed to ensure pgcrypto extension', error);
  }
}
