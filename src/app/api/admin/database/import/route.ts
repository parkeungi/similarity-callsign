// POST/PUT /api/admin/database/import - AI 분석 결과 JSON 임포트 및 미리보기, 관리자 전용
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import { importAiResults, validateResults, type AiAnalysisResult } from '@/lib/ai/import-results';
import { logger } from '@/lib/logger';

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

  if (!results || !Array.isArray(results)) {
    return NextResponse.json({ error: 'results 배열이 필요합니다.' }, { status: 400 });
  }

  if (results.length === 0) {
    return NextResponse.json({ error: '임포트할 데이터가 없습니다.' }, { status: 400 });
  }

  try {
    const summary = await importAiResults(results, overwrite, 'admin');

    if (summary.valid === 0) {
      return NextResponse.json({
        error: '유효한 데이터가 없습니다.',
        validationErrors: summary.validationErrors,
      }, { status: 400 });
    }

    // 감사 로그: 데이터 임포트
    logger.info('관리자 작업: AI 분석 결과 임포트', 'admin/database/import', {
      adminId: payload.userId,
      total: summary.total,
      inserted: summary.inserted,
      updated: summary.updated,
    });

    return NextResponse.json({
      success: true,
      summary: {
        total: summary.total,
        valid: summary.valid,
        inserted: summary.inserted,
        updated: summary.updated,
        skipped: summary.skipped,
        errors: summary.errors,
      },
      validationErrors: summary.validationErrors.length > 0 ? summary.validationErrors : undefined,
    });
  } catch (error) {
    logger.error('AI 분석 결과 임포트 실패', error, 'admin/database/import');
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

  const { validResults, errors } = validateResults(results);

  // 기존 데이터 중복 확인
  let existingCount = 0;
  const validPairs = validResults.map(r => r.callsign_pair);
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
