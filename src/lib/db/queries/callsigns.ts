// 유사호출부호 SQL 쿼리 모음 - findByAirline·upsert·updateStatus·getStats, callsigns 테이블 CRUD
/**
 * 유사호출부호 관련 SQL 쿼리 (SQLite)
 */

/**
 * 유사호출부호 상세 조회
 */
export const getCallsignById = `SELECT
  c.*,
  a.code as airline_code_ref, a.name_ko as airline_name_ko, a.name_en as airline_name_en
FROM callsigns c
LEFT JOIN airlines a ON c.airline_id = a.id
WHERE c.id = $1`;

/**
 * 조치 이력 조회 (특정 유사호출부호)
 */
export const getActionsByCallsignId = `SELECT *
FROM actions
WHERE callsign_id = $1
ORDER BY updated_at DESC, registered_at DESC`;

/**
 * 항공사별 유사호출부호 조회
 */
export const getCallsignsByAirlineId = `SELECT * FROM callsigns WHERE airline_id = $1 ORDER BY occurrence_count DESC LIMIT $2`;

/**
 * 유사호출부호 통계
 */
export const getCallsignsStats = `SELECT
  COUNT(*) as total,
  SUM(CASE WHEN risk_level = '매우높음' THEN 1 ELSE 0 END) as very_high_risk,
  SUM(CASE WHEN risk_level = '높음' THEN 1 ELSE 0 END) as high_risk,
  SUM(occurrence_count) as total_occurrences
FROM callsigns`;
