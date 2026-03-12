// GET/PATCH/DELETE /api/announcements/[id] - 공지사항 상세조회(GET)/수정(PATCH)/삭제(DELETE), announcements 테이블, 관리자 권한 필요
/**
 * GET /api/announcements/{id}
 * 공지사항 상세 조회
 *
 * POST /api/announcements/{id}/view
 * 공지사항 읽음 상태 기록
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: 공지사항 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // 2. 사용자 정보 조회
    const userResult = await query(
      `
      SELECT u.id, u.airline_id, a.code as airline_code
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

    // 3. 공지사항 조회 (활성화된 것만, viewCount 포함)
    const { id } = await params;

    const targetPattern = user.airline_code ? `%,${user.airline_code},%` : null;
    const announcementResult = await query(
      `
      SELECT
        id, title, content, level,
        start_date as "startDate", end_date as "endDate",
        target_airlines as "targetAirlines",
        created_by as "createdBy", created_at as "createdAt",
        updated_by as "updatedBy", updated_at as "updatedAt",
        is_active as "isActive",
        CASE
          WHEN start_date <= CURRENT_TIMESTAMP AND end_date >= CURRENT_TIMESTAMP THEN 'active'
          ELSE 'expired'
        END as status,
        (SELECT COUNT(*) FROM announcement_views WHERE announcement_id = $1) as "viewCount"
      FROM announcements
      WHERE id = $2
        AND is_active = true
        AND (
          target_airlines IS NULL
          OR (',' || COALESCE(target_airlines, '') || ',') LIKE $3
        )
      `,
      [id, id, targetPattern]
    );

    if (announcementResult.rows.length === 0) {
      return NextResponse.json(
        { error: '공지사항을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const announcement = announcementResult.rows[0];

    // 4. 사용자의 읽음 상태 확인
    const viewResult = await query(
      `
      SELECT id, viewed_at as "viewedAt"
      FROM announcement_views
      WHERE announcement_id = $1 AND user_id = $2
      `,
      [id, user.id]
    );

    return NextResponse.json({
      ...announcement,
      isViewed: viewResult.rows.length > 0,
      viewedAt: viewResult.rows.length > 0 ? viewResult.rows[0].viewedAt : null
    });
  } catch (error) {
    console.error('[GET /api/announcements/{id}] Error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 공지사항 읽음 상태 기록
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // 2. 공지사항 존재 확인
    const announcementResult = await query(
      `SELECT id FROM announcements WHERE id = $1`,
      [id]
    );

    if (announcementResult.rows.length === 0) {
      return NextResponse.json(
        { error: '공지사항을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 3. 읽음 상태 기록 (UPSERT)
    await query(
      `
      INSERT INTO announcement_views (announcement_id, user_id, viewed_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (announcement_id, user_id)
      DO UPDATE SET viewed_at = CURRENT_TIMESTAMP
      `,
      [id, payload.userId]
    );

    return NextResponse.json({ status: 'recorded' }, { status: 200 });
  } catch (error) {
    console.error('[POST /api/announcements/{id}] Error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
