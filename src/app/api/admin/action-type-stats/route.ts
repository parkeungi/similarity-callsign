import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/action-type-stats
 *
 * 조치 유형별 분포 통계 조회 (날짜 범위 필터 지원)
 * - 각 조치 유형별 건수
 * - 각 조치 유형별 완료율
 *
 * 쿼리 파라미터:
 * - dateFrom: YYYY-MM-DD (optional)
 * - dateTo: YYYY-MM-DD (optional)
 *
 * 응답:
 * {
 *   data: [
 *     {
 *       action_type: "편명 변경",
 *       total_count: 45,
 *       completed_count: 38,
 *       completion_rate: 84.4,
 *       in_progress_count: 5,
 *       pending_count: 2
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
    let whereClause = 'action_type IS NOT NULL AND action_type != \'\'';
    const params: (string | null)[] = [];
    let paramIndex = 1;

    if (dateFrom) {
      whereClause += ` AND DATE(registered_at) >= DATE($${paramIndex++})`;
      params.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ` AND DATE(registered_at) <= DATE($${paramIndex++})`;
      params.push(dateTo);
    }

    // 2️⃣ 조치 유형별 분포 통계 조회
    const result = await query(
      `
      SELECT
        action_type,
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        ROUND(
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
          1
        ) as completion_rate
      FROM actions
      WHERE ${whereClause}
      GROUP BY action_type
      ORDER BY total_count DESC
      `,
      params
    );

    return NextResponse.json({
      data: result.rows.map((row: any) => ({
        action_type: row.action_type,
        total_count: parseInt(row.total_count, 10),
        completed_count: parseInt(row.completed_count, 10),
        in_progress_count: parseInt(row.in_progress_count, 10),
        pending_count: parseInt(row.pending_count, 10),
        completion_rate: parseFloat(row.completion_rate) || 0,
      })),
    });
  } catch (error) {
    console.error('[API] /api/admin/action-type-stats error:', error);
    return NextResponse.json(
      { error: '통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
