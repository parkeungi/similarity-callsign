// PostgreSQL 스키마 초기화
// ⚠️ 중요: 배포 전 Supabase SQL Editor에서 scripts/init.sql을 반드시 수동 실행해야 합니다.
// 이 함수는 pgcrypto 확장만 보장하며, 테이블 생성은 init.sql에서 처리합니다.
import { PoolClient } from 'pg';
import { logger } from '@/lib/logger';

export async function initializeSchema(client: PoolClient): Promise<void> {
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  } catch (error) {
    logger.warn('Failed to ensure pgcrypto extension', 'db/postgresql/schema', { error: error instanceof Error ? error.message : String(error) });
  }
}
