// GET /api/admin/ai-analysis/pending - AI 분석 대기 호출부호 목록 (신규 + 데이터변경 2카테고리)
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/ai-analysis/pending
 * 2카테고리로 분리된 미분석/재분석 콜사인 쌍 조회
 * - 신규: callsign_ai_analysis에 기록 없음
 * - 데이터변경: AI 분석 있으나 needs_reanalysis = TRUE
 */
export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.substring(7);
  const payload = verifyToken(token || '');
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    // 카테고리 1: 신규 (AI 분석 기록 없음)
    const newResult = await query(`
      SELECT
        c.callsign_pair AS pair,
        COUNT(*) AS count,
        MAX(c.coexistence_minutes) AS coexistence_minutes,
        SUM(c.occurrence_count) AS total_occurrences,
        'new' AS category,
        NULL::int AS previous_score
      FROM callsigns c
      LEFT JOIN callsign_ai_analysis ai
        ON ai.callsign_pair = c.callsign_pair
      WHERE ai.id IS NULL
      GROUP BY c.callsign_pair
      ORDER BY COUNT(*) DESC, c.callsign_pair
    `);

    // 카테고리 2: 데이터변경 (AI 분석 있으나 재분석 필요)
    const staleResult = await query(`
      SELECT
        c.callsign_pair AS pair,
        COUNT(*) AS count,
        MAX(c.coexistence_minutes) AS coexistence_minutes,
        SUM(c.occurrence_count) AS total_occurrences,
        'stale' AS category,
        ai.ai_score AS previous_score
      FROM callsigns c
      INNER JOIN callsign_ai_analysis ai
        ON ai.callsign_pair = c.callsign_pair
      WHERE ai.needs_reanalysis = TRUE
      GROUP BY c.callsign_pair, ai.ai_score
      ORDER BY ai.ai_score DESC, c.callsign_pair
    `);

    const newPairs = newResult.rows.map((row: any) => ({
      pair: row.pair,
      count: parseInt(row.count, 10),
      category: 'new' as const,
      previousScore: null,
      coexistenceMinutes: row.coexistence_minutes ? parseInt(row.coexistence_minutes, 10) : null,
      totalOccurrences: parseInt(row.total_occurrences, 10) || 0,
    }));

    const stalePairs = staleResult.rows.map((row: any) => ({
      pair: row.pair,
      count: parseInt(row.count, 10),
      category: 'stale' as const,
      previousScore: row.previous_score,
      coexistenceMinutes: row.coexistence_minutes ? parseInt(row.coexistence_minutes, 10) : null,
      totalOccurrences: parseInt(row.total_occurrences, 10) || 0,
    }));

    return NextResponse.json({
      success: true,
      newCount: newPairs.length,
      staleCount: stalePairs.length,
      totalCount: newPairs.length + stalePairs.length,
      pairs: [...newPairs, ...stalePairs],
    });
  } catch (error) {
    logger.error('미분석 데이터 조회 실패', error, 'admin/ai-analysis/pending');
    return NextResponse.json({ error: '미분석 데이터 조회 실패' }, { status: 500 });
  }
}
