/**
 * GET /api/announcements/history
 * 공지사항 이력 조회 (사용자의 항공사별)
 *
 * 쿼리 파라미터:
 *   - level: warning|info|success (선택사항)
 *   - status: active|expired|all (선택사항)
 *   - dateFrom: YYYY-MM-DD (선택사항)
 *   - dateTo: YYYY-MM-DD (선택사항)
 *   - search: 제목/내용 검색 (선택사항)
 *   - page: 페이지 번호 (기본값: 1)
 *   - limit: 페이지 크기 (기본값: 20, 최대: 100)
 *
 * 응답:
 *   { announcements: [...], total: number, page: number, limit: number }
 *
 * 주의: 이 엔드포인트는 비활성화된 공지사항도 포함합니다.
 *      사용자가 과거에 본 모든 공지사항의 이력을 유지하기 위한 의도적 설계입니다.
 *      활성 공지사항만 필요한 경우 /api/announcements를 사용하세요.
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

    // 2. 사용자 정보 조회
    const userResult = await query(
      `
      SELECT u.id, u.airline_id, a.code as airline_code
      FROM users u
      LEFT JOIN airlines a ON u.airline_id = a.id
      WHERE u.id = ?
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

    // 3. 필터 파라미터
    const level = request.nextUrl.searchParams.get('level');
    const status = request.nextUrl.searchParams.get('status') || 'all';
    const dateFrom = request.nextUrl.searchParams.get('dateFrom');
    const dateTo = request.nextUrl.searchParams.get('dateTo');
    const search = request.nextUrl.searchParams.get('search');
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    // 4. 날짜 형식 검증
    const dateFormatRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (dateFrom && !dateFormatRegex.test(dateFrom)) {
      return NextResponse.json(
        { error: '시작 날짜는 YYYY-MM-DD 형식이어야 합니다.' },
        { status: 400 }
      );
    }

    if (dateTo && !dateFormatRegex.test(dateTo)) {
      return NextResponse.json(
        { error: '종료 날짜는 YYYY-MM-DD 형식이어야 합니다.' },
        { status: 400 }
      );
    }

    // 5. WHERE 조건 부분을 먼저 구성
    let whereClause = `(
      a.target_airlines IS NULL
      OR (',' || COALESCE(a.target_airlines, '') || ',') LIKE ?
    )`;

    const targetPattern = user.airline_code ? `%,${user.airline_code},%` : null;
    const queryParams: any[] = [targetPattern];

    // 6. 필터 적용
    if (level && ['warning', 'info', 'success'].includes(level)) {
      whereClause += ` AND a.level = ?`;
      queryParams.push(level);
    }

    // 상태 필터
    if (status !== 'all') {
      if (status === 'active') {
        whereClause += ` AND a.start_date <= CURRENT_TIMESTAMP AND a.end_date >= CURRENT_TIMESTAMP`;
      } else if (status === 'expired') {
        whereClause += ` AND (a.start_date > CURRENT_TIMESTAMP OR a.end_date < CURRENT_TIMESTAMP)`;
      }
    }

    // 날짜 범위 필터
    if (dateFrom) {
      whereClause += ` AND a.start_date >= ?`;
      queryParams.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ` AND DATE(a.start_date) <= DATE(?)`;
      queryParams.push(dateTo);
    }

    // 제목/내용 검색
    if (search) {
      whereClause += ` AND (a.title LIKE ? OR a.content LIKE ?)`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    // 7. COUNT 쿼리 실행 (subquery 안전함)
    const countParams: any[] = [...queryParams];
    const countResult = await query(
      `
      SELECT COUNT(*) as count
      FROM announcements a
      LEFT JOIN announcement_views av
        ON a.id = av.announcement_id AND av.user_id = ?
      WHERE ${whereClause}
      `,
      [payload.userId, ...countParams]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // 7. 데이터 쿼리 구성
    let sql = `
      SELECT
        a.id, a.title, a.content, a.level,
        a.start_date as "startDate", a.end_date as "endDate",
        a.is_active as "isActive",
        a.created_at as "createdAt",
        CASE
          WHEN a.start_date <= CURRENT_TIMESTAMP AND a.end_date >= CURRENT_TIMESTAMP THEN 'active'
          ELSE 'expired'
        END as status,
        CASE WHEN av.id IS NOT NULL THEN 1 ELSE 0 END as "isViewed"
      FROM announcements a
      LEFT JOIN announcement_views av
        ON a.id = av.announcement_id AND av.user_id = ?
      WHERE ${whereClause}
    `;

    sql += ` ORDER BY a.start_date DESC LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    const result = await query(sql, [payload.userId, ...queryParams]);

    return NextResponse.json({
      announcements: result.rows,
      total,
      page,
      limit
    });
  } catch (error) {
    console.error('[GET /api/announcements/history] Error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
