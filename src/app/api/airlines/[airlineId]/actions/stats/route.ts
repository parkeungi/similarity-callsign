// GET /api/airlines/[airlineId]/actions/stats - 항공사별 조치 통계(완료율·유형분포·월별추세), actions 테이블 GROUP BY 집계
/**
 * GET /api/airlines/[airlineId]/actions/stats
 * 항공사별 조치 통계 집계
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { dateDiffInDays, monthBucket } from '@/lib/db/sql-helpers';
import { logger } from '@/lib/logger';

function toDateOnlyString(date: Date) {
  return date.toISOString().split('T')[0];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ airlineId: string }> }
) {
  try {
    const airlineId = (await params).airlineId;

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    // 권한 검증: 관리자이거나 해당 항공사 소속 사용자만 접근
    if (payload.role !== 'admin' && payload.airlineId !== airlineId) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    // 항공사 존재 여부 확인
    const airlineResult = await query('SELECT id FROM airlines WHERE id = $1', [airlineId]);
    if (airlineResult.rows.length === 0) {
      return NextResponse.json({ error: '항공사를 찾을 수 없습니다.' }, { status: 404 });
    }

    const dateFromParam = request.nextUrl.searchParams.get('dateFrom');
    const dateToParam = request.nextUrl.searchParams.get('dateTo');
    const fileUploadIdParam = request.nextUrl.searchParams.get('fileUploadId');
    const hexRegex = /^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validFileUploadId = fileUploadIdParam && hexRegex.test(fileUploadIdParam) ? fileUploadIdParam : null;

    // fileUploadId 있을 때: 업로드 배치 기준 필터 (날짜 필터 무시)
    // fileUploadId 없을 때: 날짜 범위 필터
    let filterJoin = '';
    let filterWhere = '';
    let baseParams: any[];

    if (validFileUploadId) {
      filterJoin = 'LEFT JOIN callsigns cs ON a.callsign_id = cs.id';
      filterWhere = `AND (
        EXISTS (SELECT 1 FROM callsign_uploads cu WHERE cu.callsign_id = a.callsign_id AND cu.file_upload_id = $2)
        OR (cs.file_upload_id = $2 AND NOT EXISTS (SELECT 1 FROM callsign_uploads cu2 WHERE cu2.callsign_id = a.callsign_id))
      )`;
      baseParams = [airlineId, validFileUploadId];
    } else {
      const now = new Date();
      const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const defaultStart = new Date(defaultEnd);
      defaultStart.setDate(defaultEnd.getDate() - 29);

      const dateFrom = dateFromParam ? new Date(dateFromParam) : defaultStart;
      const dateTo = dateToParam ? new Date(dateToParam) : defaultEnd;

      if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
        return NextResponse.json({ error: '유효하지 않은 날짜 형식입니다.' }, { status: 400 });
      }
      if (dateFrom > dateTo) {
        return NextResponse.json({ error: '조회 시작일이 종료일보다 늦을 수 없습니다.' }, { status: 400 });
      }

      filterWhere = `AND DATE(a.registered_at) BETWEEN DATE($2) AND DATE($3)`;
      baseParams = [airlineId, toDateOnlyString(dateFrom), toDateOnlyString(dateTo)];
    }

    const fromDateString = validFileUploadId ? '' : (baseParams[1] as string);
    const toDateString = validFileUploadId ? '' : (baseParams[2] as string);

    const summaryResult = await query(
      `SELECT
         COUNT(*) AS total_actions,
         SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
         SUM(CASE WHEN a.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
         SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) AS completed_count
       FROM actions a
       ${filterJoin}
       WHERE a.airline_id = $1
         AND COALESCE(a.is_cancelled, false) = false
         ${filterWhere}`,
      baseParams
    );

    const summaryRow = summaryResult.rows[0] || {
      total_actions: 0,
      pending_count: 0,
      in_progress_count: 0,
      completed_count: 0,
    };

    const total = summaryRow.total_actions || 0;
    const pendingCount = summaryRow.pending_count || 0;
    const inProgressCount = summaryRow.in_progress_count || 0;
    const completedCount = summaryRow.completed_count || 0;

    const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    const avgResult = await query(
      `SELECT AVG(${dateDiffInDays('a.completed_at', 'a.registered_at')}) AS avg_days
       FROM actions a
       ${filterJoin}
       WHERE a.airline_id = $1
         AND COALESCE(a.is_cancelled, false) = false
         AND a.status = 'completed'
         AND a.completed_at IS NOT NULL
         AND a.registered_at IS NOT NULL
         ${filterWhere}`,
      baseParams
    );
    const averageCompletionDays = avgResult.rows[0]?.avg_days ? Math.round(avgResult.rows[0].avg_days) : 0;

    const typeResult = await query(
      `SELECT COALESCE(a.action_type, '미정의') AS action_type, COUNT(*) AS count
       FROM actions a
       ${filterJoin}
       WHERE a.airline_id = $1
         AND COALESCE(a.is_cancelled, false) = false
         ${filterWhere}
       GROUP BY 1
       ORDER BY count DESC`,
      baseParams
    );

    const typeDistribution = typeResult.rows.map((row: any) => ({
      name: row.action_type || '미정의',
      count: row.count,
      percentage: total > 0 ? Math.round((row.count / Math.max(total, 1)) * 100) : 0,
    }));

    const monthlyResult = await query(
      `SELECT ${monthBucket('a.registered_at')} AS month, COUNT(*) AS count
       FROM actions a
       ${filterJoin}
       WHERE a.airline_id = $1
         AND COALESCE(a.is_cancelled, false) = false
         ${filterWhere}
       GROUP BY 1
       ORDER BY month DESC
       LIMIT 6`,
      baseParams
    );

    const monthlyTrend = monthlyResult.rows.map((row: any) => ({
      month: row.month,
      count: row.count,
    }));

    return NextResponse.json({
      total,
      completionRate,
      averageCompletionDays,
      statusCounts: {
        waiting: pendingCount,
        in_progress: inProgressCount,
        completed: completedCount,
      },
      typeDistribution,
      monthlyTrend,
      filters: {
        dateFrom: fromDateString,
        dateTo: toDateString,
        fileUploadId: validFileUploadId ?? undefined,
      },
    });
  } catch (error) {
    logger.error('조치 통계 조회 오류', error, 'api/airlines/[airlineId]/actions/stats');
    return NextResponse.json(
      { error: '조치 통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
