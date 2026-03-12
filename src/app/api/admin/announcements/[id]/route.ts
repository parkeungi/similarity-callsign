/**
 * PATCH /api/admin/announcements/{id}
 * 공지사항 수정
 *
 * 요청 본문 (부분 업데이트 가능):
 *   {
 *     title?: string,
 *     content?: string,
 *     level?: 'warning' | 'info' | 'success',
 *     startDate?: string,
 *     endDate?: string,
 *     targetAirlines?: string[],
 *     isActive?: boolean
 *   }
 *
 * DELETE /api/admin/announcements/{id}
 * 공지사항 삭제 (announcement_views도 함께 삭제됨)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// PATCH: 공지사항 수정
export async function PATCH(
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

    if (!payload || payload.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자만 접근 가능합니다.' },
        { status: 403 }
      );
    }

    // 2. 공지사항 존재 확인 및 기존 데이터 조회
    const existResult = await query(
      `SELECT id, start_date as "startDate", end_date as "endDate" FROM announcements WHERE id = $1`,
      [id]
    );

    if (existResult.rows.length === 0) {
      return NextResponse.json(
        { error: '공지사항을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const existing = existResult.rows[0];

    // 3. 요청 데이터 파싱
    const body = await request.json();
    const { title, content, level, startDate, endDate, targetAirlines, isActive } = body;

    // 4. 동적 UPDATE 쿼리 구성
    const updates: string[] = [];
    const params_arr: any[] = [];
    let paramIndex = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      params_arr.push(title);
    }

    if (content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      params_arr.push(content);
    }

    if (level !== undefined && ['warning', 'info', 'success'].includes(level)) {
      updates.push(`level = $${paramIndex++}`);
      params_arr.push(level);
    }

    if (startDate !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      params_arr.push(startDate);
    }

    if (endDate !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      params_arr.push(endDate);
    }

    if (targetAirlines !== undefined) {
      const targetAirlinesStr = targetAirlines && targetAirlines.length > 0
        ? targetAirlines.join(',')
        : null;
      updates.push(`target_airlines = $${paramIndex++}`);
      params_arr.push(targetAirlinesStr);
    }

    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params_arr.push(isActive);
    }

    // updated_at 항상 업데이트
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    updates.push(`updated_by = $${paramIndex++}`);
    params_arr.push(payload.userId);

    if (updates.length === 2) {
      // 변경할 내용이 없음
      return NextResponse.json(
        { error: '변경할 내용이 없습니다.' },
        { status: 400 }
      );
    }

    // 5. 시간 범위 검증 (부분 업데이트 시 기존 값과 비교)
    const finalStartDate = startDate !== undefined ? startDate : existing.startDate;
    const finalEndDate = endDate !== undefined ? endDate : existing.endDate;

    if (finalStartDate && finalEndDate) {
      const start = new Date(finalStartDate);
      const end = new Date(finalEndDate);
      if (start >= end) {
        return NextResponse.json(
          { error: '시작일은 종료일보다 전에 있어야 합니다.' },
          { status: 400 }
        );
      }
    }

    // 6. DB 업데이트
    params_arr.push(id);
    const sql = `
      UPDATE announcements
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++}`;

    await query(sql, params_arr);

    // 7. 업데이트된 공지사항 조회
    const updatedResult = await query(
      `SELECT id, title, content, level,
              start_date as "startDate", end_date as "endDate",
              target_airlines as "targetAirlines",
              created_by as "createdBy", created_at as "createdAt",
              updated_by as "updatedBy", updated_at as "updatedAt",
              is_active as "isActive"
       FROM announcements
       WHERE id = $1`,
      [id]
    );

    if (updatedResult.rows.length === 0) {
      return NextResponse.json(
        { error: '공지사항을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedResult.rows[0], { status: 200 });
  } catch (error) {
    console.error('[PATCH /api/admin/announcements/{id}] Error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE: 공지사항 삭제
export async function DELETE(
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

    if (!payload || payload.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자만 접근 가능합니다.' },
        { status: 403 }
      );
    }

    // 2. 공지사항 존재 확인
    const existResult = await query(
      `SELECT id FROM announcements WHERE id = $1`,
      [id]
    );

    if (existResult.rows.length === 0) {
      return NextResponse.json(
        { error: '공지사항을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 3. 삭제 (ON DELETE CASCADE로 announcement_views도 함께 삭제)
    await query(
      `DELETE FROM announcements WHERE id = $1`,
      [id]
    );

    return NextResponse.json(
      { status: 'deleted' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[DELETE /api/admin/announcements/{id}] Error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
