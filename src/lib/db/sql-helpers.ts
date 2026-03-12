// SQL 쿼리 빌더 유틸리티 - buildWhereClause·buildPagination·buildOrderBy 헬퍼 함수, $1/$2 플레이스홀더 자동 생성
/**
 * PostgreSQL 전용 SQL 헬퍼 함수
 * (SQLite 지원 제거 - DB_PROVIDER=postgresql 고정)
 */

export const isPostgres = true;

export function monthBucket(column: string): string {
  return `TO_CHAR(${column}, 'YYYY-MM')`;
}

export function dayBucket(column: string): string {
  return `TO_CHAR(${column}, 'MM-DD')`;
}

export function hourBucket(column: string): string {
  return `TO_CHAR(${column}, 'HH24')`;
}

export function fullTime(column: string): string {
  return `TO_CHAR(${column}, 'HH24:MI:SS')`;
}

export function dateDiffInDays(laterColumn: string, earlierColumn: string): string {
  return `EXTRACT(EPOCH FROM (${laterColumn} - ${earlierColumn})) / 86400.0`;
}

export function dateDiffInDaysInt(laterColumn: string, earlierColumn: string): string {
  return `ROUND(EXTRACT(EPOCH FROM (${laterColumn} - ${earlierColumn})) / 86400.0)::INT`;
}

/**
 * STRING_AGG with LIMIT subquery (PostgreSQL)
 * 상위 N개의 column 값을 separator로 연결하는 스칼라 서브쿼리를 반환
 *
 * @param table         - 집계 대상 테이블
 * @param column        - 연결할 컬럼
 * @param whereClause   - WHERE 조건 (예: "callsign_id = cs.id")
 * @param orderByColumn - 정렬 기준 컬럼 (DESC 고정)
 * @param limitN        - 최대 행 수
 * @param separator     - 구분자 (기본값: ',')
 */
export function groupConcatLimit(
  table: string,
  column: string,
  whereClause: string,
  orderByColumn: string,
  limitN: number,
  separator = ','
): string {
  return `(
    SELECT STRING_AGG(${column}::TEXT, '${separator}')
    FROM (
      SELECT ${column} FROM ${table}
      WHERE ${whereClause}
      ORDER BY ${orderByColumn} DESC
      LIMIT ${limitN}
    ) _gcl
  )`;
}
