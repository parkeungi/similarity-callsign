// PATCH /api/admin/users/[id] - 사용자 상태 변경(승인approved/거부rejected/정지suspended), users 테이블, 관리자 전용
/**
 * PATCH /api/admin/users/[id]
 * 사용자 상태 변경 (관리자만)
 *
 * 요청 본문:
 *   - status: active|suspended
 *   - role: admin|user (선택사항)
 *
 * DELETE /api/admin/users/[id]
 * 사용자 삭제 (관리자만)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

interface Params {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    // 인증 확인
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

    const { id } = await params;

    const { status, role, airlineId, airlineCode } = await request.json();
    const userId = id;

    // 상태 검증 (active|suspended만 가능)
    if (status && !['active', 'suspended'].includes(status)) {
      return NextResponse.json(
        { error: '올바른 상태가 아닙니다. (active|suspended)' },
        { status: 400 }
      );
    }

    // 역할 검증 (선택사항)
    if (role && !['admin', 'user'].includes(role)) {
      return NextResponse.json(
        { error: '올바른 역할이 아닙니다. (admin|user)' },
        { status: 400 }
      );
    }

    // 항공사 검증 (선택사항) - airlineCode 또는 airlineId 지원
    let resolvedAirlineId: string | undefined;
    if (airlineId || airlineCode) {
      const airlineCheck = airlineCode
        ? await query('SELECT id FROM airlines WHERE code = $1', [airlineCode])
        : await query('SELECT id FROM airlines WHERE id = $1', [airlineId]);
      if (airlineCheck.rows.length === 0) {
        return NextResponse.json(
          { error: '존재하지 않는 항공사입니다.' },
          { status: 404 }
        );
      }
      resolvedAirlineId = airlineCheck.rows[0].id;
    }

    // 업데이트할 필드 동적 구성
    const updates: string[] = [];
    const params_array: any[] = [];
    let paramIndex = 1;

    if (status) {
      updates.push(`status = $${paramIndex++}`);
      params_array.push(status);
    }

    if (role) {
      updates.push(`role = $${paramIndex++}`);
      params_array.push(role);
    }

    if (resolvedAirlineId) {
      updates.push(`airline_id = $${paramIndex++}`);
      params_array.push(resolvedAirlineId);
    }

    // 변경할 필드가 없으면 먼저 체크
    if (updates.length === 0) {
      return NextResponse.json(
        { error: '업데이트할 필드가 없습니다.' },
        { status: 400 }
      );
    }

    // 항상 updated_at 업데이트
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // userId 추가
    params_array.push(userId);

    // 사용자 업데이트
    const sql = `UPDATE users
                 SET ${updates.join(', ')}
                 WHERE id = $${paramIndex++}`;

    await query(sql, params_array);

    // 감사 로그: 사용자 상태/역할 변경
    logger.info('관리자 작업: 사용자 정보 변경', 'admin/users', {
      adminId: payload.userId,
      targetUserId: userId,
      changes: { status, role, airlineId: resolvedAirlineId },
    });

    // 업데이트된 사용자 조회
    const userResult = await query(
      `SELECT id, email, status, role, airline_id, last_login_at, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // 항공사 정보 조회
    const airlineResult = await query(
      'SELECT code, name_ko, name_en FROM airlines WHERE id = $1',
      [user.airline_id]
    );

    const airline = airlineResult.rows[0]
      ? {
          id: user.airline_id,
          code: airlineResult.rows[0].code,
          name_ko: airlineResult.rows[0].name_ko,
          name_en: airlineResult.rows[0].name_en,
        }
      : null;

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        role: user.role,
        airline_id: user.airline_id,
        airline,
        // 날짜/로그인 필드: snake_case + camelCase 모두 포함
        last_login_at: user.last_login_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
    });
  } catch (error) {
    logger.error('사용자 상태 변경 실패', error, 'admin/users');
    return NextResponse.json(
      { error: '사용자 상태 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    // 인증 확인
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

    const { id } = await params;
    const userId = id;

    // 관리자는 삭제 불가
    const adminCheck = await query('SELECT role FROM users WHERE id = $1', [userId]);
    if (adminCheck.rows.length === 0) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 자기 자신은 삭제 불가
    if (userId === payload.userId) {
      return NextResponse.json(
        { error: '자기 자신은 삭제할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 관리자 삭제 시: 최소 1명의 관리자는 남아있어야 함
    if (adminCheck.rows[0].role === 'admin') {
      const adminCountResult = await query(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin'",
      );
      const adminCount = parseInt(adminCountResult.rows[0].count, 10);
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: '최소 1명의 관리자가 필요합니다. 마지막 관리자는 삭제할 수 없습니다.' },
          { status: 400 }
        );
      }
    }

    // 삭제 전 사용자 정보 저장
    const userBeforeDelete = await query(
      'SELECT id, email FROM users WHERE id = $1',
      [userId]
    );

    if (userBeforeDelete.rows.length === 0) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const userInfo = userBeforeDelete.rows[0];

    // 사용자 삭제
    await query('DELETE FROM users WHERE id = $1', [userId]);

    // 감사 로그: 사용자 삭제
    logger.warn('관리자 작업: 사용자 삭제', 'admin/users', {
      adminId: payload.userId,
      deletedUserId: userId,
      deletedUserEmail: userInfo.email,
    });

    return NextResponse.json({
      message: '사용자가 삭제되었습니다.',
      user: {
        id: userInfo.id,
        email: userInfo.email,
      },
    });
  } catch (error) {
    logger.error('사용자 삭제 실패', error, 'admin/users');
    return NextResponse.json(
      { error: '사용자 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
