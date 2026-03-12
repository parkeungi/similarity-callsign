/**
 * 사용자 관련 SQL 쿼리 (SQLite)
 */

/**
 * 사용자 생성
 */
export const createUser = `INSERT INTO users (email, password_hash, role, airline_id, status, is_default_password, password_change_required, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`;

/**
 * 사용자 승인/상태 변경
 */
export const updateUserStatus = `UPDATE users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`;

/**
 * 사용자 항공사 변경
 */
export const updateUserAirline = `UPDATE users SET airline_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`;

/**
 * 사용자 정보 변경
 */
export const updateUserInfo = `UPDATE users SET email = $1, airline_id = $2, role = $3, status = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5`;

/**
 * 사용자 삭제
 */
export const deleteUser = `DELETE FROM users WHERE id = $1`;

/**
 * 이메일로 사용자 존재 여부 확인
 */
export const checkEmailExists = `SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`;

/**
 * 대기 중인 사용자 조회
 */
export const getPendingUsers = `SELECT
  u.id, u.email, u.role, u.status, u.airline_id, u.created_at,
  a.code as airline_code, a.name_ko as airline_name_ko
FROM users u
LEFT JOIN airlines a ON u.airline_id = a.id
WHERE u.status = 'pending'
ORDER BY u.created_at ASC`;

/**
 * 활성 사용자 조회
 */
export const getActiveUsers = `SELECT COUNT(*) as total FROM users WHERE status = 'active'`;

/**
 * 사용자 통계
 */
export const getUsersStats = `SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
  COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended
FROM users`;
