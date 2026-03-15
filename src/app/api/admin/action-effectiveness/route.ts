// GET /api/admin/action-effectiveness - 조치 효과성 분석(평균처리일수·유형별완료율·월별추세), actions 테이블 집계
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { dateDiffInDaysInt } from '@/lib/db/sql-helpers';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface ActionEffectivenessData {
  actionType: string;
  totalActions: number;
  noRepeatCount: number;
  repeatCount: number;
  preventionRate: number;
  avgDaysUntilRepeat: number;
  effectivenessScore: number;
}

/**
 * GET /api/admin/action-effectiveness
 *
 * 조치 유형별 효과성 분석
 * - 재검출 방지율: (조치 후 재검출 안 된 건수) / (총 조치 건수) * 100%
 * - 평균 처리 일수: 조치 완료 → 재검출까지의 평균 일수
 * - 효과성 점수: 방지율 * 가중치
 *
 * 응답:
 * {
 *   success: true,
 *   data: [
 *     {
 *       actionType: "절차 개선",
 *       totalActions: 15,
 *       noRepeatCount: 14,
 *       repeatCount: 1,
 *       preventionRate: 93.3,
 *       avgDaysUntilRepeat: 120,
 *       effectivenessScore: 9.3
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

    // 3️⃣ 조치 유형별 효과성 분석
    const sqlQuery = `
      WITH action_first_dates AS (
        -- 각 callsign별 조치 유형별 첫 번째 조치 완료일
        SELECT
          a1.callsign_id,
          a1.action_type,
          MIN(a1.completed_at) as first_completion_date
        FROM actions a1
        WHERE a1.status = 'completed' AND COALESCE(a1.is_cancelled, false) = false
        GROUP BY a1.callsign_id, a1.action_type
      ),
      action_repeats AS (
        -- 각 callsign+action_type별 재조치 여부 판단
        SELECT
          afd.callsign_id,
          afd.action_type,
          afd.first_completion_date,
          MIN(a2.completed_at) as next_completion_date,
          CASE WHEN a2.completed_at IS NOT NULL THEN 1 ELSE 0 END as is_repeat,
          CASE
            WHEN a2.completed_at IS NOT NULL
            THEN ${dateDiffInDaysInt('a2.completed_at', 'afd.first_completion_date')}
            ELSE NULL
          END as days_until_repeat
        FROM action_first_dates afd
        LEFT JOIN actions a2 ON afd.callsign_id = a2.callsign_id
          AND a2.action_type = afd.action_type
          AND a2.status = 'completed'
          AND COALESCE(a2.is_cancelled, false) = false
          AND a2.completed_at > afd.first_completion_date
        GROUP BY afd.callsign_id, afd.action_type
      )
      SELECT
        ar.action_type as actionType,
        COUNT(*) as totalActions,
        SUM(CASE WHEN ar.is_repeat = 0 THEN 1 ELSE 0 END) as noRepeatCount,
        SUM(CASE WHEN ar.is_repeat = 1 THEN 1 ELSE 0 END) as repeatCount,
        ROUND(100.0 * SUM(CASE WHEN ar.is_repeat = 0 THEN 1 ELSE 0 END) /
              CAST(COUNT(*) AS FLOAT), 1) as preventionRate,
        ROUND(AVG(CASE WHEN ar.is_repeat = 1 THEN ar.days_until_repeat END), 0) as avgDaysUntilRepeat,
        ROUND(100.0 * SUM(CASE WHEN ar.is_repeat = 0 THEN 1 ELSE 0 END) /
              CAST(COUNT(*) AS FLOAT) / 10.0, 1) as effectivenessScore
      FROM action_repeats ar
      GROUP BY ar.action_type
      ORDER BY preventionRate DESC;
    `;

    const { rows } = await query(sqlQuery);
    const results = (rows || []) as ActionEffectivenessData[];

    logger.debug('조회 완료', 'admin/action-effectiveness', {
      actionTypes: results.length,
      data: results.slice(0, 3)
    });

    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('조치 효과성 분석 조회 실패', error, 'admin/action-effectiveness');
    return NextResponse.json(
      { error: '조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
