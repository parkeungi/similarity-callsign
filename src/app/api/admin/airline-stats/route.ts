import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/airline-stats
 *
 * 항공사별 집계 통계 조회 (날짜 범위 필터 지원)
 *
 * 쿼리 파라미터:
 * - dateFrom: YYYY-MM-DD (optional)
 * - dateTo: YYYY-MM-DD (optional)
 *
 * 응답:
 * {
 *   data: [
 *     {
 *       airline_id: string,
 *       airline_code: string,
 *       airline_name_ko: string,
 *       total_callsigns: number,
 *       pending_actions: number,
 *       in_progress_actions: number,
 *       completed_actions: number,
 *       total_actions: number,
 *       completion_rate: number
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // 1️⃣ 인증 체크
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // 관리자 권한 체크
    if (payload.role !== 'admin') {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 2️⃣ 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // SQL WHERE 절 동적 구성
    let whereClause = '1=1';
    const params: (string | null)[] = [];

    if (dateFrom) {
      whereClause += ' AND DATE(a.registered_at) >= DATE(?)';
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ' AND DATE(a.registered_at) <= DATE(?)';
      params.push(dateTo);
    }

    // 3️⃣ 항공사별 집계 통계 조회
    // 조치율 = 완료 건수 / (진행중 + 완료) 건수 × 100%
    const result = await query(
      `
      SELECT
        al.id as airline_id,
        al.code as airline_code,
        al.name_ko as airline_name_ko,
        COUNT(DISTINCT cs.id) as total_callsigns,
        SUM(CASE WHEN a.status = 'in_progress' AND COALESCE(a.is_cancelled, 0) = 0 THEN 1 ELSE 0 END) as in_progress_actions,
        SUM(CASE WHEN a.status = 'completed' AND COALESCE(a.is_cancelled, 0) = 0 THEN 1 ELSE 0 END) as completed_actions,
        ROUND(
          SUM(CASE WHEN a.status = 'completed' AND COALESCE(a.is_cancelled, 0) = 0 THEN 1 ELSE 0 END) * 100.0 /
          NULLIF(
            SUM(CASE WHEN a.status IN ('in_progress', 'completed') AND COALESCE(a.is_cancelled, 0) = 0 THEN 1 ELSE 0 END),
            0
          ),
          1
        ) as completion_rate
      FROM airlines al
      LEFT JOIN callsigns cs ON cs.airline_id = al.id
      LEFT JOIN actions a ON a.airline_id = al.id AND (${whereClause})
      GROUP BY al.id, al.code, al.name_ko
      ORDER BY completed_actions DESC, in_progress_actions DESC
      `,
      params
    );

    return NextResponse.json({
      data: result.rows.map((row: any) => ({
        airline_id: row.airline_id,
        airline_code: row.airline_code,
        airline_name_ko: row.airline_name_ko,
        total_callsigns: parseInt(row.total_callsigns, 10),
        in_progress_actions: parseInt(row.in_progress_actions, 10) || 0,
        completed_actions: parseInt(row.completed_actions, 10) || 0,
        completion_rate: parseFloat(row.completion_rate) || 0,
      })),
    });
  } catch (error) {
    console.error('[API] /api/admin/airline-stats error:', error);
    return NextResponse.json(
      { error: '통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
