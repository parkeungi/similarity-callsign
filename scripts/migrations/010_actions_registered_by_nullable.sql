-- 010: actions.registered_by NOT NULL 제약 제거
-- 사용자 삭제 시 ON DELETE SET NULL이 정상 동작하도록 수정
-- 실행: Supabase SQL Editor에서 실행

ALTER TABLE actions ALTER COLUMN registered_by DROP NOT NULL;
