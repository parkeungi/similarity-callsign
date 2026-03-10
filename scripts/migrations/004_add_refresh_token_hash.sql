-- 004_add_refresh_token_hash.sql
-- RefreshToken DB 저장 (토큰 탈취 무효화 대응)
-- 로그아웃/관리자 강제 로그아웃 시 즉시 무효화 가능

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(64) NULL;

COMMENT ON COLUMN users.refresh_token_hash IS 'RefreshToken SHA-256 해시 (로그아웃 시 NULL, 탈취 무효화용)';
