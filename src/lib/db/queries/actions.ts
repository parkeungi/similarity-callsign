// 조치 SQL 쿼리 모음 - findById·findByAirline·create·update·cancel·getStats, actions 테이블 CRUD
/**
 * 조치 이력 관련 SQL 쿼리 (SQLite)
 */

/**
 * 조치 이력 생성
 */
export const createAction = `INSERT INTO actions (callsign_id, status, manager_name, description, registered_at, updated_at)
VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;

/**
 * 조치 이력 상세 조회
 */
export const getActionById = `SELECT * FROM actions WHERE id = $1`;

/**
 * 조치 이력 수정
 */
export const updateAction = `UPDATE actions SET status = $1, manager_name = $2, description = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4`;

/**
 * 조치 이력 삭제
 */
export const deleteAction = `DELETE FROM actions WHERE id = $1`;

/**
 * 특정 유사호출부호의 최신 조치 조회
 */
export const getLatestActionByCallsignId = `SELECT * FROM actions WHERE callsign_id = $1 ORDER BY updated_at DESC LIMIT 1`;

/**
 * 항공사별 조치 이력 통계
 */
export const getActionStatsByAirline = `SELECT
  c.airline_id,
  a.code as airline_code,
  COUNT(DISTINCT ac.id) as total_actions,
  COUNT(DISTINCT CASE WHEN ac.status = 'completed' THEN ac.id END) as completed,
  COUNT(DISTINCT CASE WHEN ac.status = 'in_progress' THEN ac.id END) as in_progress,
  COUNT(DISTINCT CASE WHEN ac.status = 'pending' THEN ac.id END) as pending
FROM callsigns c
LEFT JOIN airlines a ON c.airline_id = a.id
LEFT JOIN actions ac ON c.id = ac.callsign_id
WHERE a.id = $1
GROUP BY c.airline_id, a.code`;

/**
 * 조치 이력 통계
 */
export const getActionsStats = `SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
FROM actions`;
