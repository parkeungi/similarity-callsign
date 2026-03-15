-- AI 자동 분석 작업 이력 테이블 (API 호출 기록 및 결과 추적)

CREATE TABLE IF NOT EXISTS ai_analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  provider VARCHAR(20) NOT NULL,
  model VARCHAR(50) NOT NULL,
  total_pairs INT NOT NULL DEFAULT 0,
  processed_pairs INT NOT NULL DEFAULT 0,
  inserted_count INT DEFAULT 0,
  updated_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  error_message TEXT,
  token_input INT,
  token_output INT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);
