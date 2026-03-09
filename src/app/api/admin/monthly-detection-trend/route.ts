import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { monthBucket } from '@/lib/db/sql-helpers';

export const dynamic = 'force-dynamic';

interface MonthlyTrendData {
  month: string;
  newDetections: number;
  repeatDetections: number;
  totalDetections: number;
  newRate: number;
  repeatRate: number;
}

/**
 * GET /api/admin/monthly-detection-trend
 *
 * 월별 신규 vs 재검출 비율 조회
 * - 같은 호출부호가 재조치되는 경우를 "재검출"로 분류
 * - 조치 효과를 장기적으로 추적
 *
 * 응답:
 * {
 *   success: true,
 *   data: [
 *     {
 *       month: "2026-03",
 *       newDetections: 31,
 *       repeatDetections: 0,
 *       totalDetections: 31,
 *       newRate: 100.0,
 *       repeatRate: 0.0
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // 1️⃣ 토큰 검증
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

    // 2️⃣ 관리자 권한 체크
    if (payload.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 3️⃣ 월별 신규 vs 재검출 비율 조회
    const sqlQuery = `
      WITH callsign_first_action AS (
        -- 각 callsign별 첫 번째 조치 완료일
        SELECT
          callsign_id,
          MIN(DATE(completed_at)) as first_action_date
        FROM actions
        WHERE status = 'completed' AND COALESCE(is_cancelled, false) = false
        GROUP BY callsign_id
      ),
      monthly_actions AS (
        -- 월별로 신규/재검출 구분
        SELECT
          DATE(a.completed_at) as action_date,
          a.callsign_id,
          CASE
            WHEN DATE(a.completed_at) = cfa.first_action_date THEN 'new'
            ELSE 'repeat'
          END as action_type
        FROM actions a
        LEFT JOIN callsign_first_action cfa ON a.callsign_id = cfa.callsign_id
        WHERE a.status = 'completed'
          AND COALESCE(a.is_cancelled, false) = false
          AND a.completed_at IS NOT NULL
      )
      SELECT
        ${monthBucket('action_date')} as month,
        COUNT(CASE WHEN action_type = 'new' THEN 1 END) as newDetections,
        COUNT(CASE WHEN action_type = 'repeat' THEN 1 END) as repeatDetections,
        COUNT(*) as totalDetections,
        ROUND(100.0 * COUNT(CASE WHEN action_type = 'new' THEN 1 END) /
              CAST(COUNT(*) AS FLOAT), 1) as newRate,
        ROUND(100.0 * COUNT(CASE WHEN action_type = 'repeat' THEN 1 END) /
              CAST(COUNT(*) AS FLOAT), 1) as repeatRate
      FROM monthly_actions
      GROUP BY 1
      ORDER BY month DESC;
    `;

    const { rows } = await query(sqlQuery);
    const results = (rows || []) as MonthlyTrendData[];

    console.log('[MonthlyDetectionTrend] 조회 완료:', {
      months: results.length,
      data: results.slice(0, 3)
    });

    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('[MonthlyDetectionTrend] 에러:', error);
    return NextResponse.json(
      { error: '조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
