// GET /api/admin/duplicate-callsigns-stats - 중복 호출부호 통계(동일편명 빈도·항공사 쌍별), callsigns 테이블 집계
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/duplicate-callsigns-stats
 *
 * 중복 유사호출부호 현황 조회
 * - 같은 조치 유형으로 여러 건을 처리한 항공사 통계
 * - 비용 절감 및 프로세스 개선 기회 발견
 *
 * 응답:
 * {
 *   data: [
 *     {
 *       airline_code: "KAL",
 *       airline_name_ko: "대한항공",
 *       action_type: "편명 변경",
 *       count: 10,
 *       opportunity_score: 85
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

    // 2️⃣ 중복 유사호출부호 현황 조회
    // 같은 조치 유형으로 3건 이상 처리한 항공사만 조회
    // CTE로 airline별 total_actions를 1회만 계산 (기존: SELECT 내 서브쿼리 2회 반복)
    const duplicateResult = await query(
      `
      WITH airline_totals AS (
        SELECT airline_id, COUNT(*) as total_actions
        FROM actions
        GROUP BY airline_id
      )
      SELECT
        a.airline_id,
        al.code as airline_code,
        al.name_ko as airline_name_ko,
        a.action_type,
        COUNT(*) as count,
        at2.total_actions,
        ROUND(COUNT(*) * 100.0 / at2.total_actions, 1) as percentage,
        ROUND(COUNT(*) * 50.0 / 100.0) as opportunity_score
      FROM actions a
      LEFT JOIN airlines al ON a.airline_id = al.id
      JOIN airline_totals at2 ON at2.airline_id = a.airline_id
      WHERE a.action_type IS NOT NULL AND a.action_type != ''
      GROUP BY a.airline_id, al.code, al.name_ko, a.action_type, at2.total_actions
      HAVING COUNT(*) >= 3
      ORDER BY count DESC
      LIMIT 100
      `,
      []
    );

    // 3️⃣ 전체 중복 현황 요약
    const summaryResult = await query(
      `
      SELECT
        a.airline_id,
        al.code as airline_code,
        al.name_ko as airline_name_ko,
        COUNT(DISTINCT a.action_type) as unique_action_types,
        COUNT(*) as total_actions,
        COUNT(DISTINCT a.callsign_id) as unique_callsigns,
        ROUND(
          COUNT(*) * 100.0 / COUNT(DISTINCT a.callsign_id),
          1
        ) as duplicate_rate
      FROM actions a
      LEFT JOIN airlines al ON a.airline_id = al.id
      GROUP BY a.airline_id, al.code, al.name_ko
      HAVING COUNT(*) > 0
      ORDER BY duplicate_rate DESC
      `,
      []
    );

    return NextResponse.json({
      action_types: duplicateResult.rows.map((row: any) => ({
        airline_code: row.airline_code,
        airline_name_ko: row.airline_name_ko,
        action_type: row.action_type,
        count: parseInt(row.count, 10),
        total_actions: parseInt(row.total_actions, 10),
        percentage: parseFloat(row.percentage) || 0,
        opportunity_score: parseInt(row.opportunity_score, 10) || 0,
      })),
      summary: summaryResult.rows.map((row: any) => ({
        airline_code: row.airline_code,
        airline_name_ko: row.airline_name_ko,
        unique_action_types: parseInt(row.unique_action_types, 10),
        total_actions: parseInt(row.total_actions, 10),
        unique_callsigns: parseInt(row.unique_callsigns, 10),
        duplicate_rate: parseFloat(row.duplicate_rate) || 0,
      })),
    });
  } catch (error) {
    logger.error('중복 호출부호 통계 조회 실패', error, 'admin/duplicate-callsigns-stats');
    return NextResponse.json(
      { error: '통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
