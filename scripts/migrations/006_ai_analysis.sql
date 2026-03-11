-- 006: AI 유사호출부호 우선순위 분석 테이블
-- 생성일: 2026-03-11

CREATE TABLE IF NOT EXISTS callsign_ai_analysis (
  id SERIAL PRIMARY KEY,
  callsign_pair TEXT NOT NULL UNIQUE,
  ai_score INT NOT NULL CHECK (ai_score BETWEEN 1 AND 100),
  ai_reason TEXT NOT NULL,
  reason_type TEXT NOT NULL DEFAULT 'LOW_RISK',
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_by TEXT DEFAULT 'claude'
);

-- reason_type 유형:
-- SAME_NUMBER    : 다른 항공사, 편명번호 완전 동일 (ESR887 ↔ KAL887)
-- CONTAINMENT    : 짧은 번호가 긴 번호에 포함 (KAL126 ↔ KAL1256)
-- TRANSPOSITION  : 숫자 자릿수 전치 (TWB301 ↔ TWB310)
-- SIMILAR_CODE   : 항공사코드 발음 유사 + 편명 유사 (JNA301 ↔ JJA301)
-- DIGIT_OVERLAP  : 같은 항공사, 앞/뒤 숫자 겹침 (AAR701 ↔ AAR731)
-- PHONETIC_DIGIT : 발음 혼동 숫자 조합 포함 (135 ↔ 195, 5↔9)
-- LOW_RISK       : 유사성 낮음

CREATE INDEX IF NOT EXISTS idx_ai_analysis_pair ON callsign_ai_analysis(callsign_pair);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_score ON callsign_ai_analysis(ai_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_reason_type ON callsign_ai_analysis(reason_type);
