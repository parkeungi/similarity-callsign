// 미분석/재분석 필요 콜사인 쌍 조회 및 데이터 가공 (export, auto 라우트 공유)
import { query } from '@/lib/db';

/**
 * 방향 판별: RK prefix로 입항/출항/국내선 구분
 */
export function deriveDirection(departure: string | null, arrival: string | null): '입항' | '출항' | '국내선' {
  const depIsRK = departure?.startsWith('RK') ?? false;
  const arrIsRK = arrival?.startsWith('RK') ?? false;

  if (depIsRK && arrIsRK) return '국내선';
  if (arrIsRK) return '입항';
  return '출항';
}

/**
 * 동시관제량 → traffic_level 변환
 */
export function deriveTrafficLevel(maxTraffic: number | null): '혼잡' | '보통' | '여유' {
  if (maxTraffic == null) return '보통';
  if (maxTraffic >= 15) return '혼잡';
  if (maxTraffic >= 10) return '보통';
  return '여유';
}

// 공통 SELECT 필드
const COMMON_SELECT = `
  c.callsign_pair AS pair,
  MAX(c.departure_airport1) AS departure_airport1,
  MAX(c.arrival_airport1) AS arrival_airport1,
  MAX(c.departure_airport2) AS departure_airport2,
  MAX(c.arrival_airport2) AS arrival_airport2,
  MAX(c.coexistence_minutes) AS coexistence_minutes,
  SUM(c.occurrence_count) AS total_occurrences,
  MAX(c.max_concurrent_traffic) AS max_concurrent_traffic,
  MAX(c.atc_recommendation) AS atc_recommendation,
  MAX(c.error_type) AS error_type,
  MAX(c.sub_error) AS sub_error,
  MAX(c.error_probability) AS error_probability,
  MAX(c.similarity) AS similarity,
  MAX(c.same_airline_code) AS same_airline_code,
  MAX(c.same_number_ratio) AS same_number_ratio,
  MAX(c.sector) AS sector
`;

interface PendingRow {
  pair: string;
  category: 'new' | 'stale';
  previous_score: number | null;
  departure_airport1: string | null;
  arrival_airport1: string | null;
  departure_airport2: string | null;
  arrival_airport2: string | null;
  coexistence_minutes: number | null;
  total_occurrences: string;
  max_concurrent_traffic: string | null;
  atc_recommendation: string | null;
  error_type: string | null;
  sub_error: string | null;
  error_probability: string | null;
  similarity: string | null;
  same_airline_code: string | null;
  same_number_ratio: string | null;
  sector: string | null;
}

export interface ProcessedPair {
  pair: string;
  category: 'new' | 'stale';
  previous_score: number | null;
  direction_a: '입항' | '출항' | '국내선';
  direction_b: '입항' | '출항' | '국내선';
  coexistence_level: 'long' | 'short';
  total_occurrences: number;
  max_concurrent_traffic: number | null;
  traffic_level: '혼잡' | '보통' | '여유';
  atc_recommendation: string | null;
  error_type: string | null;
  sub_error: string | null;
  error_probability: number | null;
  error_occurrences: number;
  similarity: string | null;
  same_airline_code: string | null;
  same_number_ratio: number | null;
  sector: string | null;
}

/**
 * 미분석 + 재분석 필요 콜사인 쌍을 조회하여 가공된 데이터 반환
 */
export async function fetchPendingPairs(): Promise<ProcessedPair[]> {
  // 국내항공사 코드를 airlines 테이블에서 조회
  const airlinesResult = await query(`SELECT icao_code FROM airlines WHERE icao_code IS NOT NULL`);
  const domesticCodes = airlinesResult.rows.map((r: { icao_code: string }) => r.icao_code);

  // 신규 미분석 pair 조회 (국내항공사만)
  const newResult = await query(`
    SELECT
      'new' AS category,
      NULL::int AS previous_score,
      ${COMMON_SELECT}
    FROM callsigns c
    LEFT JOIN callsign_ai_analysis ai
      ON ai.callsign_pair = c.callsign_pair
    WHERE ai.id IS NULL
      AND c.airline_code = ANY($1)
    GROUP BY c.callsign_pair
    ORDER BY SUM(c.occurrence_count) DESC, c.callsign_pair
    LIMIT 500
  `, [domesticCodes]);

  // 데이터변경 (재분석 필요) pair 조회 (국내항공사만)
  const staleResult = await query(`
    SELECT
      'stale' AS category,
      ai.ai_score AS previous_score,
      ${COMMON_SELECT}
    FROM callsigns c
    INNER JOIN callsign_ai_analysis ai
      ON ai.callsign_pair = c.callsign_pair
    WHERE ai.needs_reanalysis = TRUE
      AND c.airline_code = ANY($1)
    GROUP BY c.callsign_pair, ai.ai_score
    ORDER BY ai.ai_score DESC, c.callsign_pair
    LIMIT 500
  `, [domesticCodes]);

  const allRows: PendingRow[] = [...newResult.rows, ...staleResult.rows];

  // 각 쌍별 오류 발생 횟수 집계
  const pairList = allRows.map(r => r.pair);
  let errorCountMap: Record<string, { error_occurrences: number }> = {};

  if (pairList.length > 0) {
    const errorStats = await query(`
      SELECT
        cs.callsign_pair,
        COUNT(*) AS total_occ,
        COUNT(co.error_type) AS error_occ
      FROM callsign_occurrences co
      JOIN callsigns cs ON cs.id = co.callsign_id
      WHERE cs.callsign_pair = ANY($1)
      GROUP BY cs.callsign_pair
    `, [pairList]);

    for (const row of errorStats.rows) {
      errorCountMap[row.callsign_pair] = {
        error_occurrences: parseInt(row.error_occ, 10),
      };
    }
  }

  return allRows.map((row) => {
    const maxTraffic = row.max_concurrent_traffic ? parseInt(row.max_concurrent_traffic, 10) : null;
    const errStats = errorCountMap[row.pair];

    return {
      pair: row.pair,
      category: row.category,
      previous_score: row.previous_score ?? null,
      direction_a: deriveDirection(row.departure_airport1, row.arrival_airport1),
      direction_b: deriveDirection(row.departure_airport2, row.arrival_airport2),
      coexistence_level: (row.coexistence_minutes != null && row.coexistence_minutes >= 5) ? 'long' as const : 'short' as const,
      total_occurrences: parseInt(row.total_occurrences, 10) || 0,
      max_concurrent_traffic: maxTraffic,
      traffic_level: deriveTrafficLevel(maxTraffic),
      atc_recommendation: row.atc_recommendation || null,
      error_type: row.error_type || null,
      sub_error: row.sub_error || null,
      error_probability: row.error_probability ? parseInt(row.error_probability, 10) : null,
      error_occurrences: errStats?.error_occurrences ?? 0,
      similarity: row.similarity || null,
      same_airline_code: row.same_airline_code || null,
      same_number_ratio: row.same_number_ratio ? parseFloat(row.same_number_ratio) : null,
      sector: row.sector || null,
    };
  });
}
