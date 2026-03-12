/**
 * GET /api/announcements
 * 현재 활성 공지사항 조회 (로그인한 사용자의 항공사별)
 *
 * 필터 조건:
 *   - start_date <= CURRENT_TIMESTAMP <= end_date
 *   - is_active = true
 *   - (target_airlines IS NULL OR user.airline_id IN target_airlines)
 *
 * 응답:
 *   { announcements: [...], total: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. 인증 확인
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload || !payload.userId) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // 2. 사용자 정보 조회 (airline_id 확인)
    const userResult = await query(
      `
      SELECT u.id, u.airline_id, u.role, a.code as airline_code
      FROM users u
      LEFT JOIN airlines a ON u.airline_id = a.id
      WHERE u.id = $1
      `,
      [payload.userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // 3. 활성 공지사항 조회
    const sql = `
      SELECT
        id, title, content, level,
        start_date as "startDate", end_date as "endDate",
        target_airlines as "targetAirlines",
        created_by as "createdBy", created_at as "createdAt",
        updated_at as "updatedAt"
      FROM announcements
      WHERE is_active = true
        AND start_date <= CURRENT_TIMESTAMP
        AND end_date >= CURRENT_TIMESTAMP
        AND (
          target_airlines IS NULL
          OR (',' || COALESCE(target_airlines, '') || ',') LIKE $1
        )
      ORDER BY start_date DESC
    `;

    const targetPattern = user.airline_code ? `%,${user.airline_code},%` : null;
    const result = await query(sql, [targetPattern]);

    return NextResponse.json({
      announcements: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('[GET /api/announcements] Error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
