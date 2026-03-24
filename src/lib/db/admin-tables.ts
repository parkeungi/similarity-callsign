// 데이터베이스 관리 화면에서 사용하는 공통 상수 (중복 정의 방지)

// 관리자 DB 뷰어에서 접근 허용된 테이블 목록 (화이트리스트 - SQL Injection 방지)
export const ALLOWED_ADMIN_TABLES = new Set([
  'users',
  'airlines',
  'callsigns',
  'callsign_occurrences',
  'callsign_uploads',
  'actions',
  'action_history',
  'action_types',
  'announcements',
  'announcement_views',
  'file_uploads',
  'callsign_ai_analysis',
  'ai_analysis_jobs',
  'password_history',
  'audit_logs',
]);

// 마스킹할 민감 컬럼 (내보내기/조회 시 '***' 처리)
export const MASKED_COLUMNS = new Set([
  'password',
  'password_hash',
  'hashed_password',
  'refresh_token',
  'refresh_token_hash',
]);

// FK 의존성 기반 임포트 순서 (부모 → 자식)
export const IMPORT_ORDER: string[] = [
  'airlines',
  'users',
  'password_history',
  'action_types',
  'file_uploads',
  'callsigns',
  'callsign_occurrences',
  'callsign_uploads',
  'actions',
  'action_history',
  'announcements',
  'announcement_views',
  'callsign_ai_analysis',
  'ai_analysis_jobs',
  'audit_logs',
];
