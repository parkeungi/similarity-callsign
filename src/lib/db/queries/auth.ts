/**
 * 인증 관련 SQL 쿼리 (SQLite)
 */

/**
 * 이메일로 사용자 조회
 */
export const getUserByEmail = `SELECT
  u.id, u.password_hash, u.status, u.role, u.email,
  u.airline_id, u.is_default_password, u.password_change_required, u.last_password_changed_at,
  a.code as airline_code, a.name_ko as airline_name_ko, a.name_en as airline_name_en
FROM users u
LEFT JOIN airlines a ON u.airline_id = a.id
WHERE LOWER(u.email) = LOWER($1)`;

/**
 * 마지막 로그인 시간 업데이트
 */
export const updateLastLogin = `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1`;

/**
 * 사용자 정보 조회 (by ID)
 */
export const getUserById = `SELECT
  u.id, u.email, u.status, u.role, u.airline_id,
  a.code as airline_code, a.name_ko as airline_name_ko, a.name_en as airline_name_en
FROM users u
LEFT JOIN airlines a ON u.airline_id = a.id
WHERE u.id = $1`;

/**
 * 비밀번호 변경
 */
export const updatePassword = `UPDATE users SET password_hash = $1, is_default_password = false, password_change_required = false WHERE id = $2`;
