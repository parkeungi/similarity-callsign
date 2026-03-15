-- ================================================================
-- 009: 성능 최적화 인덱스 추가
-- 목적: 4-5년 누적 데이터(~60,000건) 기준 쿼리 성능 보장
-- ================================================================

-- [1순위] actions 테이블 - LATERAL JOIN, DISTINCT ON, CTE 최적화
-- callsigns-with-actions: LATERAL JOIN에서 callsign_id + airline_code 기준 최신 조치 조회
CREATE INDEX IF NOT EXISTS idx_actions_callsign_cancelled_registered
  ON actions(callsign_id, is_cancelled, registered_at DESC);

-- monthly-detection-trend: CTE에서 status=completed, is_cancelled=false 필터 + completed_at 정렬
CREATE INDEX IF NOT EXISTS idx_actions_completed_active
  ON actions(status, completed_at)
  WHERE COALESCE(is_cancelled, false) = false;

-- duplicate-callsigns-stats: airline_id별 action_type 집계
CREATE INDEX IF NOT EXISTS idx_actions_airline_action_type
  ON actions(airline_id, action_type)
  WHERE action_type IS NOT NULL AND action_type != '';

-- [2순위] callsign_occurrences - 발생이력 서브쿼리 최적화
-- callsigns-with-actions: LATERAL JOIN에서 callsign_id 기준 최근 발생이력 조회
CREATE INDEX IF NOT EXISTS idx_occurrences_callsign_date_time
  ON callsign_occurrences(callsign_id, occurred_date DESC, occurred_time DESC NULLS LAST);

-- [3순위] callsigns 테이블 - 정렬/필터 최적화
-- callsigns-with-actions, occurrences: risk_level CASE 정렬 + occurrence_count 정렬
CREATE INDEX IF NOT EXISTS idx_callsigns_risk_occurrence
  ON callsigns(risk_level, occurrence_count DESC, last_occurred_at DESC);

-- callsigns: airline_id + airline_code 복합 인덱스 (LATERAL JOIN 조건)
CREATE INDEX IF NOT EXISTS idx_callsigns_airline_id_code
  ON callsigns(airline_id, airline_code);

-- comprehensive-stats: GROUP BY departure/arrival airport
CREATE INDEX IF NOT EXISTS idx_callsigns_airports
  ON callsigns(departure_airport1, arrival_airport1);

-- comprehensive-stats: uploaded_at 기반 날짜 필터
CREATE INDEX IF NOT EXISTS idx_callsigns_uploaded_at
  ON callsigns(uploaded_at DESC);

-- [4순위] users 테이블 - 관리자 사용자 조회
CREATE INDEX IF NOT EXISTS idx_users_status_created
  ON users(status, created_at DESC);

-- [5순위] announcement_views - NOT EXISTS 최적화
-- 이미 UNIQUE(announcement_id, user_id) 제약이 있으므로 추가 인덱스 불필요
-- 역방향 조회용 인덱스만 추가
CREATE INDEX IF NOT EXISTS idx_announcement_views_user_announcement
  ON announcement_views(user_id, announcement_id);
