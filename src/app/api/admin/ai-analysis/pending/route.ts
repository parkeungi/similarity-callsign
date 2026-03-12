import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

/**
 * GET /api/admin/ai-analysis/pending
 * callsign_ai_analysis 테이블에 없는 미분석 콜사인 쌍 조회
 */
export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.substring(7);
  const payload = verifyToken(token || '');
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    // callsigns 테이블에서 callsign_ai_analysis에 없는 pair만 조회
    const result = await query(`
      SELECT
        c.callsign_a || ' | ' || c.callsign_b AS pair,
        COUNT(*) AS count
      FROM callsigns c
      LEFT JOIN callsign_ai_analysis ai
        ON ai.callsign_pair = c.callsign_a || ' | ' || c.callsign_b
        OR ai.callsign_pair = c.callsign_b || ' | ' || c.callsign_a
      WHERE ai.id IS NULL
      GROUP BY c.callsign_a, c.callsign_b
      ORDER BY COUNT(*) DESC, c.callsign_a, c.callsign_b
    `);

    const pairs = result.rows.map((row: { pair: string; count: string }) => ({
      pair: row.pair,
      count: parseInt(row.count, 10),
    }));

    return NextResponse.json({
      success: true,
      totalCount: pairs.length,
      pairs,
    });
  } catch (error) {
    console.error('[AI Analysis Pending] Error:', error);
    return NextResponse.json({ error: '미분석 데이터 조회 실패' }, { status: 500 });
  }
}
