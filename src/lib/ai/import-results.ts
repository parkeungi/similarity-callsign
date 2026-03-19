// AI 분석 결과 검증 및 DB 저장 (수동 임포트, 자동 분석 공유)
import { query, transaction } from '@/lib/db';

// "AAR123 | KAL456" 형식: ICAO코드(2~4자) + 편명번호(1~5자리) | 동일 패턴
const CALLSIGN_PAIR_PATTERN = /^[A-Z]{2,4}\d{1,5}\s*\|\s*[A-Z]{2,4}\d{1,5}$/;

const VALID_REASON_TYPES = new Set([
  'SAME_NUMBER',
  'CONTAINMENT',
  'TRANSPOSITION',
  'SIMILAR_CODE',
  'DIGIT_OVERLAP',
  'PHONETIC_DIGIT',
  'LOW_RISK',
  'OTHER',
]);

export interface AiAnalysisResult {
  callsign_pair: string;
  ai_score: number;
  reason_type: string;
  ai_reason: string;
}

export interface ImportSummary {
  total: number;
  valid: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: number;
  validationErrors: string[];
}

/**
 * AI 분석 결과 배열을 검증하여 유효한 항목만 반환
 */
export function validateResults(results: AiAnalysisResult[]): {
  validResults: AiAnalysisResult[];
  errors: string[];
} {
  const errors: string[] = [];
  const validResults: AiAnalysisResult[] = [];

  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    const idx = i + 1;

    if (!item.callsign_pair || typeof item.callsign_pair !== 'string') {
      errors.push(`[${idx}] callsign_pair가 누락되었습니다.`);
      continue;
    }

    if (!CALLSIGN_PAIR_PATTERN.test(item.callsign_pair.trim())) {
      errors.push(`[${idx}] callsign_pair 형식이 올바르지 않습니다: "${item.callsign_pair}" (예: "KAL852 | AAR123")`);
      continue;
    }

    if (typeof item.ai_score !== 'number' || isNaN(item.ai_score) || item.ai_score < 1 || item.ai_score > 100) {
      errors.push(`[${idx}] ai_score는 1~100 사이 숫자여야 합니다. (${item.callsign_pair})`);
      continue;
    }

    if (!item.reason_type || !VALID_REASON_TYPES.has(item.reason_type)) {
      errors.push(`[${idx}] 유효하지 않은 reason_type: ${item.reason_type} (${item.callsign_pair})`);
      continue;
    }

    if (!item.ai_reason || typeof item.ai_reason !== 'string' || item.ai_reason.length < 10) {
      errors.push(`[${idx}] ai_reason이 너무 짧습니다. (${item.callsign_pair})`);
      continue;
    }

    validResults.push(item);
  }

  return { validResults, errors };
}

/**
 * 검증된 AI 분석 결과를 DB에 저장 (INSERT 또는 UPDATE)
 */
export async function importAiResults(
  results: AiAnalysisResult[],
  overwrite: boolean,
  analyzedBy: string = 'admin'
): Promise<ImportSummary> {
  const { validResults, errors } = validateResults(results);

  if (validResults.length === 0) {
    return {
      total: results.length,
      valid: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: errors.length,
      validationErrors: errors,
    };
  }

  const allPairs = validResults.map(r => r.callsign_pair);

  const counts = await transaction(async (txQuery) => {
    // 일괄 스냅샷 조회 (N+1 → 1 쿼리)
    const snapshotResult = await txQuery(
      `SELECT callsign_pair,
         MAX(coexistence_minutes) AS coexistence_snapshot,
         SUM(occurrence_count) AS occurrence_snapshot,
         MAX(atc_recommendation) AS atc_snapshot
       FROM callsigns
       WHERE callsign_pair = ANY($1)
       GROUP BY callsign_pair`,
      [allPairs]
    );
    const snapMap = new Map(
      snapshotResult.rows.map((r: Record<string, unknown>) => [r.callsign_pair as string, r])
    );

    // 일괄 기존 데이터 확인 (N+1 → 1 쿼리)
    const existingResult = await txQuery(
      `SELECT callsign_pair FROM callsign_ai_analysis WHERE callsign_pair = ANY($1)`,
      [allPairs]
    );
    const existingSet = new Set(
      existingResult.rows.map((r: Record<string, unknown>) => r.callsign_pair as string)
    );

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const item of validResults) {
      const snap = (snapMap.get(item.callsign_pair) || {}) as Record<string, unknown>;

      if (existingSet.has(item.callsign_pair)) {
        if (overwrite) {
          await txQuery(
            `UPDATE callsign_ai_analysis
             SET ai_score = $1, ai_reason = $2, reason_type = $3, analyzed_at = NOW(), analyzed_by = $4,
                 coexistence_snapshot = $5, occurrence_snapshot = $6, atc_snapshot = $7,
                 needs_reanalysis = FALSE
             WHERE callsign_pair = $8`,
            [item.ai_score, item.ai_reason, item.reason_type, analyzedBy,
             snap.coexistence_snapshot ?? null, snap.occurrence_snapshot ?? null, snap.atc_snapshot ?? null,
             item.callsign_pair]
          );
          updatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        await txQuery(
          `INSERT INTO callsign_ai_analysis
           (callsign_pair, ai_score, ai_reason, reason_type, analyzed_at, analyzed_by,
            coexistence_snapshot, occurrence_snapshot, atc_snapshot, needs_reanalysis)
           VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, FALSE)`,
          [item.callsign_pair, item.ai_score, item.ai_reason, item.reason_type, analyzedBy,
           snap.coexistence_snapshot ?? null, snap.occurrence_snapshot ?? null, snap.atc_snapshot ?? null]
        );
        insertedCount++;
      }
    }

    return { insertedCount, updatedCount, skippedCount };
  });

  return {
    total: results.length,
    valid: validResults.length,
    inserted: counts.insertedCount,
    updated: counts.updatedCount,
    skipped: counts.skippedCount,
    errors: errors.length,
    validationErrors: errors,
  };
}
