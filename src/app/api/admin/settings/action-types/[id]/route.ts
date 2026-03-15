// PATCH/DELETE /api/admin/settings/action-types/[id] - 조치유형 수정(PATCH)/삭제(DELETE), action_types 테이블, 관리자 전용
/**
 * PATCH  /api/admin/settings/action-types/[id]  - 조치유형 수정
 * DELETE /api/admin/settings/action-types/[id]  - 조치유형 소프트 삭제 (is_active = false)
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authCheck = checkAdminAuth(request.headers.get('Authorization'));
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
    }

    const { id } = params;
    const body = await request.json();
    const { name, description, display_order, is_active } = body;

    // 존재 확인
    const existing = await query('SELECT id FROM action_types WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: '존재하지 않는 조치유형입니다.' }, { status: 404 });
    }

    // 이름 변경 시 중복 체크
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: '조치유형 이름이 유효하지 않습니다.' }, { status: 400 });
      }
      if (name.trim().length > 100) {
        return NextResponse.json({ error: '조치유형 이름은 100자 이하여야 합니다.' }, { status: 400 });
      }
      const duplicate = await query(
        'SELECT id FROM action_types WHERE name = $1 AND id != $2',
        [name.trim(), id]
      );
      if (duplicate.rows.length > 0) {
        return NextResponse.json({ error: '이미 존재하는 조치유형 이름입니다.' }, { status: 409 });
      }
    }

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name.trim()); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description?.trim() || null); }
    if (display_order !== undefined) { fields.push(`display_order = $${idx++}`); values.push(display_order); }
    if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }

    if (fields.length === 0) {
      return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 });
    }

    values.push(id);
    const result = await query(
      `UPDATE action_types SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (error) {
    logger.error('조치유형 수정 실패', error, 'admin/settings/action-types');
    return NextResponse.json({ error: '조치유형 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authCheck = checkAdminAuth(request.headers.get('Authorization'));
    if (authCheck.error) {
      return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
    }

    const { id } = params;

    // 존재 확인
    const existing = await query('SELECT id, name FROM action_types WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: '존재하지 않는 조치유형입니다.' }, { status: 404 });
    }

    // 소프트 삭제: is_active = false
    const result = await query(
      'UPDATE action_types SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );

    return NextResponse.json({ data: result.rows[0], message: '비활성화되었습니다.' });
  } catch (error) {
    logger.error('조치유형 비활성화 실패', error, 'admin/settings/action-types');
    return NextResponse.json({ error: '조치유형 비활성화 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
