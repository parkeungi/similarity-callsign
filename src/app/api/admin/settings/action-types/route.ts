// GET/POST /api/admin/settings/action-types - 조치유형 목록 조회(GET)/생성(POST), action_types 테이블, 관리자 전용
/**
 * GET  /api/admin/settings/action-types  - 조치유형 목록 조회
 * POST /api/admin/settings/action-types  - 조치유형 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

function checkAdminAuth(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: true, message: '인증이 필요합니다.', status: 401 };
  }
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload || payload.role !== 'admin') {
    return { error: true, message: '관리자만 접근 가능합니다.', status: 403 };
  }
  return { error: false };
}

export async function GET(request: NextRequest) {
  try {
    const authCheck = checkAdminAuth(request.headers.get('Authorization'));
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active_only') === 'true';

    const sql = activeOnly
      ? 'SELECT * FROM action_types WHERE is_active = true ORDER BY display_order ASC, name ASC'
      : 'SELECT * FROM action_types ORDER BY display_order ASC, name ASC';

    const result = await query(sql);

    return NextResponse.json({
      data: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    logger.error('조치유형 조회 실패', error, 'admin/settings/action-types');
    return NextResponse.json({ error: '조치유형 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authCheck = checkAdminAuth(request.headers.get('Authorization'));
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
    }

    const body = await request.json();
    const { name, description, display_order } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: '조치유형 이름은 필수입니다.' }, { status: 400 });
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: '조치유형 이름은 100자 이하여야 합니다.' }, { status: 400 });
    }

    // 중복 이름 확인 (is_active 무관)
    const existing = await query('SELECT id FROM action_types WHERE name = $1', [name.trim()]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: '이미 존재하는 조치유형 이름입니다.' }, { status: 409 });
    }

    // display_order 미전달 시 현재 최댓값 + 1
    let order = display_order;
    if (order === undefined || order === null) {
      const maxResult = await query('SELECT COALESCE(MAX(display_order), 0) AS max_order FROM action_types');
      order = maxResult.rows[0].max_order + 1;
    }

    const result = await query(
      `INSERT INTO action_types (name, description, display_order)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), description?.trim() || null, order]
    );

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error) {
    logger.error('조치유형 생성 실패', error, 'admin/settings/action-types');
    return NextResponse.json({ error: '조치유형 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
