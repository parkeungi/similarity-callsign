// POST /api/admin/users/[id]/password-reset - 관리자가 사용자 비밀번호를 임시값으로 초기화, bcrypt 해싱, users 테이블
/**
 * PUT /api/admin/users/[id]/password-reset
 * 관리자 - 특정 사용자 비밀번호 초기화
 *
 * - 관리자가 직접 지정한 비밀번호로 즉시 교체
 * - password_change_required = true 설정
 *
 * 권한: admin 전용
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { PASSWORD_REGEX } from '@/lib/constants';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{
    id: string;
  }>;
}


export async function PUT(request: NextRequest, { params }: Params) {
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

    const { id: userId } = await params;

    // 대상 사용자와 항공사 정보 조회
    const userResult = await query(
      `SELECT u.id, u.email, u.status, u.role, u.airline_id, a.code as airline_code
       FROM users u
       LEFT JOIN airlines a ON u.airline_id = a.id
       WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const targetUser = userResult.rows[0];

    // 자기 자신의 비밀번호는 이 API로 초기화 불가 (보안)
    if (targetUser.id === payload.userId) {
      return NextResponse.json(
        { error: '자신의 비밀번호는 비밀번호 변경 화면을 이용해주세요.' },
        { status: 400 }
      );
    }

    let password: string | undefined;
    try {
      const body = await request.json();
      password = typeof body?.password === 'string' ? body.password.trim() : undefined;
    } catch {
      // body 파싱 실패는 아래 유효성 검사에서 처리
    }

    if (!password) {
      return NextResponse.json(
        { error: '새 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!PASSWORD_REGEX.test(password)) {
      return NextResponse.json(
        { error: '비밀번호는 8자 이상, 대문자·소문자·숫자·특수문자를 모두 포함해야 합니다.' },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // DB 업데이트
    await query(
      `UPDATE users
       SET password_hash = $1,
           is_default_password = true,
           password_change_required = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [passwordHash, userId]
    );

    // 감사 로그: 비밀번호 초기화 (보안 이벤트)
    logger.warn('관리자 작업: 사용자 비밀번호 초기화', 'admin/password-reset', {
      adminId: payload.userId,
      targetUserId: userId,
      targetUserEmail: targetUser.email,
    });

    return NextResponse.json({
      message: '비밀번호가 초기화되었습니다.',
      email: targetUser.email,
    });
  } catch (error) {
    logger.error('비밀번호 초기화 실패', error, 'admin/password-reset');
    return NextResponse.json(
      { error: '비밀번호 초기화 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/** PATCH도 동일하게 지원 */
export { PUT as PATCH };
