// GET /api/admin/airline-stats - 항공사별 통계(호출부호수·조치완료율·위험도분포), callsigns·actions·airlines JOIN 집계
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

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
    const fileUploadId = searchParams.get('fileUploadId');
    const uuidRegex = /^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validFileUploadId = fileUploadId && uuidRegex.test(fileUploadId) ? fileUploadId : null;

    const params: (string | null)[] = [];
    let paramIndex = 1;

    // 3️⃣ 항공사별 집계 통계 조회
    let callsignBatchFilter = '';
    let actionsBatchJoin = '';
    let actionsDateWhere = '1=1';

    if (validFileUploadId) {
      // 배치 필터: callsign_uploads JOIN 또는 레거시 file_upload_id 기준
      params.push(validFileUploadId);
      const batchParam = `$${paramIndex++}`;
      callsignBatchFilter = `AND (
        EXISTS (SELECT 1 FROM callsign_uploads _cu WHERE _cu.callsign_id = cs.id AND _cu.file_upload_id = ${batchParam})
        OR (cs.file_upload_id = ${batchParam} AND NOT EXISTS (SELECT 1 FROM callsign_uploads _cu2 WHERE _cu2.callsign_id = cs.id))
      )`;
      // actions 서브쿼리도 같은 배치의 callsign만 대상으로
      params.push(validFileUploadId);
      const batchParam2 = `$${paramIndex++}`;
      actionsBatchJoin = `JOIN callsigns _cs ON _cs.id = actions.callsign_id AND (
        EXISTS (SELECT 1 FROM callsign_uploads _cu WHERE _cu.callsign_id = _cs.id AND _cu.file_upload_id = ${batchParam2})
        OR (_cs.file_upload_id = ${batchParam2} AND NOT EXISTS (SELECT 1 FROM callsign_uploads _cu2 WHERE _cu2.callsign_id = _cs.id))
      )`;
    } else {
      if (dateFrom) {
        actionsDateWhere += ` AND DATE(registered_at) >= DATE($${paramIndex++})`;
        params.push(dateFrom);
      }
      if (dateTo) {
        actionsDateWhere += ` AND DATE(registered_at) <= DATE($${paramIndex++})`;
        params.push(dateTo);
      }
    }

    // 조치율 = (진행중 + 완료) / 전체호출부호 × 100%
    // 📌 카티션 곱셈 방지: 서브쿼리로 각각 집계 후 JOIN
    const result = await query(
      `
      SELECT
        al.id as airline_id,
        al.code as airline_code,
        al.name_ko as airline_name_ko,
        COUNT(DISTINCT cs.id) as total_callsigns,
        COALESCE(MAX(action_stats.in_progress_actions), 0) as in_progress_actions,
        COALESCE(MAX(action_stats.completed_actions), 0) as completed_actions,
        ROUND(
          (COALESCE(MAX(action_stats.in_progress_actions), 0) + COALESCE(MAX(action_stats.completed_actions), 0)) * 100.0 /
          NULLIF(COUNT(DISTINCT cs.id), 0),
          1
        ) as completion_rate
      FROM airlines al
      LEFT JOIN callsigns cs ON cs.airline_id = al.id ${callsignBatchFilter}
      LEFT JOIN (
        SELECT
          actions.airline_id,
          SUM(CASE WHEN actions.status IN ('pending', 'in_progress') AND COALESCE(actions.is_cancelled, false) = false THEN 1 ELSE 0 END) as in_progress_actions,
          SUM(CASE WHEN actions.status = 'completed' AND COALESCE(actions.is_cancelled, false) = false THEN 1 ELSE 0 END) as completed_actions
        FROM actions
        ${actionsBatchJoin}
        WHERE (${actionsDateWhere})
        GROUP BY actions.airline_id
      ) action_stats ON action_stats.airline_id = al.id
      GROUP BY al.id, al.code, al.name_ko
      ORDER BY completed_actions DESC, in_progress_actions DESC
      `,
      params
    );

    return NextResponse.json({
      data: result.rows.map((row: any) => {
        const totalCallsigns = parseInt(row.total_callsigns, 10);
        const inProgressActions = parseInt(row.in_progress_actions, 10) || 0;
        const completedActions = parseInt(row.completed_actions, 10) || 0;
        const totalActions = inProgressActions + completedActions;

        // 완료율 = 완료 / (진행중 + 완료) × 100%
        const completionRate = totalActions > 0
          ? Math.round((completedActions / totalActions) * 100 * 10) / 10
          : 0;

        // 미조치 = 전체호출부호 - (진행중 + 완료)
        const pendingCallsigns = Math.max(0, totalCallsigns - totalActions);

        return {
          airline_id: row.airline_id,
          airline_code: row.airline_code,
          airline_name_ko: row.airline_name_ko,
          total_callsigns: totalCallsigns,
          pending_callsigns: pendingCallsigns,  // 미조치 호출부호
          in_progress_actions: inProgressActions,  // 진행중
          completed_actions: completedActions,  // 완료
          action_rate: parseFloat(row.completion_rate) || 0,  // 조치율 = (진행중+완료)/전체
          completion_rate: completionRate,  // 완료율 = 완료/(진행중+완료)
        };
      }),
    });
  } catch (error) {
    logger.error('항공사별 통계 조회 실패', error, 'admin/airline-stats');
    return NextResponse.json(
      { error: '통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
