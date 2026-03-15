-- 007: AI 재분석 감지를 위한 스냅샷 및 플래그 컬럼 추가
-- 생성일: 2026-03-13
-- 관련 요구서: KATC1-AI-001 (FR-02, FR-03)

-- 분석 당시 공존시간(분) 스냅샷
ALTER TABLE callsign_ai_analysis
  ADD COLUMN IF NOT EXISTS coexistence_snapshot INT NULL;

-- 분석 당시 누적 검출건수 스냅샷
ALTER TABLE callsign_ai_analysis
  ADD COLUMN IF NOT EXISTS occurrence_snapshot INT NULL;

-- 분석 당시 관제사 권고사항 스냅샷
ALTER TABLE callsign_ai_analysis
  ADD COLUMN IF NOT EXISTS atc_snapshot VARCHAR(50) NULL;

-- 재분석 필요 여부 플래그
ALTER TABLE callsign_ai_analysis
  ADD COLUMN IF NOT EXISTS needs_reanalysis BOOLEAN DEFAULT FALSE;

-- needs_reanalysis 인덱스 (pending 목록 조회 성능)
CREATE INDEX IF NOT EXISTS idx_ai_analysis_reanalysis
  ON callsign_ai_analysis(needs_reanalysis) WHERE needs_reanalysis = TRUE;
