// POST /api/admin/database/import - JSON 데이터로 DB 복원, 트랜잭션 내 TRUNCATE+INSERT, 관리자 전용
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

// 허용된 reason_type 목록
const VALID_REASON_TYPES = new Set([
  'SAME_NUMBER',
  'CONTAINMENT',
  'TRANSPOSITION',
  'SIMILAR_CODE',
  'DIGIT_OVERLAP',
  'PHONETIC_DIGIT',
  'LOW_RISK',
]);

interface AiAnalysisResult {
  callsign_pair: string;
  ai_score: number;
  reason_type: string;
  ai_reason: string;
}

interface ImportRequest {
  results: AiAnalysisResult[];
  overwrite?: boolean;
}

/**
 * POST /api/admin/database/import
 * AI 분석 결과 JSON을 callsign_ai_analysis 테이블에 임포트
 */
export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.substring(7);
  const payload = verifyToken(token || '');
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  let body: ImportRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON 파싱 실패' }, { status: 400 });
  }

  const { results, overwrite = false } = body;

  // 기본 검증
  if (!results || !Array.isArray(results)) {
    return NextResponse.json({ error: 'results 배열이 필요합니다.' }, { status: 400 });
  }

  if (results.length === 0) {
    return NextResponse.json({ error: '임포트할 데이터가 없습니다.' }, { status: 400 });
  }

  // 각 항목 검증
  const errors: string[] = [];
  const validResults: AiAnalysisResult[] = [];

  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    const idx = i + 1;

    if (!item.callsign_pair || typeof item.callsign_pair !== 'string') {
      errors.push(`[${idx}] callsign_pair가 누락되었습니다.`);
      continue;
    }

    if (!item.ai_score || typeof item.ai_score !== 'number' || item.ai_score < 1 || item.ai_score > 100) {
      errors.push(`[${idx}] ai_score는 1~100 사이 정수여야 합니다. (${item.callsign_pair})`);
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

  if (validResults.length === 0) {
    return NextResponse.json({
      error: '유효한 데이터가 없습니다.',
      validationErrors: errors,
    }, { status: 400 });
  }

  try {
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const item of validResults) {
      // 기존 데이터 확인
      const existingResult = await query(
        `SELECT id FROM callsign_ai_analysis WHERE callsign_pair = $1`,
        [item.callsign_pair]
      );

      if (existingResult.rows.length > 0) {
        if (overwrite) {
          // 덮어쓰기
          await query(
            `UPDATE callsign_ai_analysis
             SET ai_score = $1, ai_reason = $2, reason_type = $3, analyzed_at = NOW()
             WHERE callsign_pair = $4`,
            [item.ai_score, item.ai_reason, item.reason_type, item.callsign_pair]
          );
          updatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        // 신규 INSERT
        await query(
          `INSERT INTO callsign_ai_analysis (callsign_pair, ai_score, ai_reason, reason_type, analyzed_at, analyzed_by)
           VALUES ($1, $2, $3, $4, NOW(), 'admin')`,
          [item.callsign_pair, item.ai_score, item.ai_reason, item.reason_type]
        );
        insertedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        valid: validResults.length,
        inserted: insertedCount,
        updated: updatedCount,
        skipped: skippedCount,
        errors: errors.length,
      },
      validationErrors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[AI Analysis Import] Error:', error);
    return NextResponse.json({ error: '임포트 실패' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/database/import
 * 미리보기 (실제 DB에 저장하지 않고 검증만)
 */
export async function PUT(request: NextRequest) {
  const token = request.headers.get('Authorization')?.substring(7);
  const payload = verifyToken(token || '');
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  let body: ImportRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON 파싱 실패' }, { status: 400 });
  }

  const { results } = body;

  if (!results || !Array.isArray(results)) {
    return NextResponse.json({ error: 'results 배열이 필요합니다.' }, { status: 400 });
  }

  // 각 항목 검증
  const errors: string[] = [];
  const validPairs: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const item = results[i];
    const idx = i + 1;

    if (!item.callsign_pair || typeof item.callsign_pair !== 'string') {
      errors.push(`[${idx}] callsign_pair가 누락되었습니다.`);
      continue;
    }

    if (!item.ai_score || typeof item.ai_score !== 'number' || item.ai_score < 1 || item.ai_score > 100) {
      errors.push(`[${idx}] ai_score는 1~100 사이 정수여야 합니다.`);
      continue;
    }

    if (!item.reason_type || !VALID_REASON_TYPES.has(item.reason_type)) {
      errors.push(`[${idx}] 유효하지 않은 reason_type: ${item.reason_type}`);
      continue;
    }

    if (!item.ai_reason || typeof item.ai_reason !== 'string' || item.ai_reason.length < 10) {
      errors.push(`[${idx}] ai_reason이 너무 짧습니다.`);
      continue;
    }

    validPairs.push(item.callsign_pair);
  }

  // 기존 데이터 중복 확인
  let existingCount = 0;
  if (validPairs.length > 0) {
    try {
      const existingResult = await query(
        `SELECT COUNT(*) as count FROM callsign_ai_analysis WHERE callsign_pair = ANY($1)`,
        [validPairs]
      );
      existingCount = parseInt(existingResult.rows[0]?.count || '0', 10);
    } catch {
      // 쿼리 실패 시 무시
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    preview: {
      total: results.length,
      valid: validPairs.length,
      invalid: results.length - validPairs.length,
      newRecords: validPairs.length - existingCount,
      duplicates: existingCount,
    },
    validationErrors: errors.length > 0 ? errors : undefined,
  });
}
