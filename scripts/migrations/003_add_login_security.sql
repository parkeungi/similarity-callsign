-- 003_add_login_security.sql
-- 계정 잠금 및 로그인 시도 횟수 추적 컬럼 추가 (행안부 정보보호 지침)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP NULL;

COMMENT ON COLUMN users.failed_login_attempts IS '연속 로그인 실패 횟수 (5회 초과 시 계정 잠금)';
COMMENT ON COLUMN users.locked_until IS '계정 잠금 해제 시각 (NULL이면 잠금 없음)';
