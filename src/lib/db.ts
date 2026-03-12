// DB 통합 인터페이스 - db/index.ts에서 query·transaction 함수 re-export, 전체 API에서 import 진입점
/**
 * 데이터베이스 통합 인터페이스 (re-export)
 * PostgreSQL (Supabase) 전용
 *
 * 환경 변수:
 * - DATABASE_URL: Supabase PostgreSQL 연결 문자열
 */

export * from './db/index';
