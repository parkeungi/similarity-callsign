/**
 * GET /api/admin/announcements
 * 전체 공지사항 목록 (관리자용)
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
 * POST /api/admin/announcements
 * 공지사항 생성
 *
 * 요청 본문:
 *   {
 *     title: string,
 *     content: string,
 *     level: 'warning' | 'info' | 'success',
 *     startDate: string (ISO 8601),
 *     endDate: string (ISO 8601),
 *     targetAirlines: string[] (선택사항, 없으면 전체)
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: 전체 공지사항 목록 (관리자용)
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

    if (!payload || payload.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자만 접근 가능합니다.' },
        { status: 403 }
      );
    }

    // 2. 필터 파라미터
    const level = request.nextUrl.searchParams.get('level');
    const status = request.nextUrl.searchParams.get('status') || 'all';
    const dateFrom = request.nextUrl.searchParams.get('dateFrom');
    const dateTo = request.nextUrl.searchParams.get('dateTo');
    const search = request.nextUrl.searchParams.get('search');
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    // 3. WHERE 조건 부분을 먼저 구성
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;

    // 4. 필터 적용 (날짜 형식 검증)
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

    if (level && ['warning', 'info', 'success'].includes(level)) {
      whereClause += ` AND a.level = $${paramIndex++}`;
      queryParams.push(level);
    }

    if (status !== 'all') {
      if (status === 'active') {
        whereClause += ` AND a.start_date <= CURRENT_TIMESTAMP AND a.end_date >= CURRENT_TIMESTAMP`;
      } else if (status === 'expired') {
        whereClause += ` AND (a.start_date > CURRENT_TIMESTAMP OR a.end_date < CURRENT_TIMESTAMP)`;
      }
    }

    if (dateFrom) {
      whereClause += ` AND a.start_date >= $${paramIndex++}`;
      queryParams.push(dateFrom);
    }

    if (dateTo) {
      whereClause += ` AND DATE(a.start_date) <= DATE($${paramIndex++})`;
      queryParams.push(dateTo);
    }

    // 제목/내용 검색
    if (search) {
      whereClause += ` AND (a.title LIKE $${paramIndex++} OR a.content LIKE $${paramIndex++})`;
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    // 5. COUNT 쿼리 실행 (subquery 안전함)
    const countResult = await query(
      `SELECT COUNT(*) as count FROM announcements a ${whereClause}`,
      queryParams
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // 6. 데이터 쿼리 구성
    let sql = `
      SELECT
        a.id, a.title, a.content, a.level,
        a.start_date as "startDate", a.end_date as "endDate",
        a.target_airlines as "targetAirlines",
        a.is_active as "isActive",
        a.created_by as "createdBy", a.created_at as "createdAt",
        u.email as "createdByEmail",
        CASE
          WHEN a.start_date <= CURRENT_TIMESTAMP AND a.end_date >= CURRENT_TIMESTAMP THEN 'active'
          ELSE 'expired'
        END as status,
        (SELECT COUNT(*) FROM announcement_views WHERE announcement_id = a.id) as "viewCount"
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      ${whereClause}
    `;

    sql += ` ORDER BY a.start_date DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(limit, offset);

    const result = await query(sql, queryParams);

    return NextResponse.json({
      announcements: result.rows,
      total,
      page,
      limit
    });
  } catch (error) {
    console.error('[GET /api/admin/announcements] Error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 공지사항 생성
export async function POST(request: NextRequest) {
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

    if (!payload || payload.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자만 접근 가능합니다.' },
        { status: 403 }
      );
    }

    // 2. 요청 데이터 검증
    const body = await request.json();
    const { title, content, level, startDate, endDate, targetAirlines } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: '제목과 내용은 필수입니다.' },
        { status: 400 }
      );
    }

    // 제목/내용 길이 검증
    if (typeof title !== 'string' || title.length > 255) {
      return NextResponse.json(
        { error: '제목은 최대 255자여야 합니다.' },
        { status: 400 }
      );
    }

    if (typeof content !== 'string' || content.length > 10000) {
      return NextResponse.json(
        { error: '내용은 최대 10,000자여야 합니다.' },
        { status: 400 }
      );
    }

    if (title.trim().length === 0 || content.trim().length === 0) {
      return NextResponse.json(
        { error: '제목과 내용은 공백만으로 구성될 수 없습니다.' },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '시작일과 종료일은 필수입니다.' },
        { status: 400 }
      );
    }

    // 시간 범위 검증
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return NextResponse.json(
        { error: '시작일은 종료일보다 전에 있어야 합니다.' },
        { status: 400 }
      );
    }

    // 3. 긴급도 검증
    if (!['warning', 'info', 'success'].includes(level)) {
      return NextResponse.json(
        { error: "긴급도는 'warning', 'info', 'success' 중 하나여야 합니다." },
        { status: 400 }
      );
    }

    const validLevel = level;

    // 4. 대상 항공사 문자열 변환
    const targetAirlinesStr = targetAirlines && targetAirlines.length > 0
      ? targetAirlines.join(',')
      : null;

    // 5. DB 저장
    const insertResult = await query(
      `INSERT INTO announcements
        (title, content, level, start_date, end_date, target_airlines, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [title, content, level, startDate, endDate, targetAirlinesStr, payload.userId]
    );

    // 6. 생성된 공지사항 조회
    const createdResult = await query(
      `SELECT id, title, content, level,
              start_date as "startDate", end_date as "endDate",
              target_airlines as "targetAirlines",
              created_by as "createdBy", created_at as "createdAt",
              is_active as "isActive"
       FROM announcements
       WHERE created_by = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [payload.userId]
    );

    if (createdResult.rows.length === 0) {
      return NextResponse.json(
        { error: '공지사항 생성 확인 실패' },
        { status: 500 }
      );
    }

    return NextResponse.json(createdResult.rows[0], { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/announcements] Error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
