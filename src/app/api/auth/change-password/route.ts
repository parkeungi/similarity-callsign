/**
 * POST /api/auth/change-password
 * 비밀번호 변경 API (초기 비밀번호 강제 변경 + 사용자가 언제든 비밀번호 변경)
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifyToken } from '@/lib/jwt';
import { query, transaction } from '@/lib/db';
import { PASSWORD_REGEX } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    // 인증 토큰 검증
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '인증 토큰이 필요합니다.' },
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

    const userId = payload.userId;

    // 요청 본문 파싱
    const { currentPassword, newPassword, newPasswordConfirm } = await request.json();

    // 유효성 검사
    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      return NextResponse.json(
        { error: '모든 필드는 필수입니다.' },
        { status: 400 }
      );
    }

    if (newPassword !== newPasswordConfirm) {
      return NextResponse.json(
        { error: '새 비밀번호가 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    // 새 비밀번호 규칙 검사
    if (!PASSWORD_REGEX.test(newPassword)) {
      return NextResponse.json(
        { error: '8자 이상, 대문자·소문자·숫자·특수문자 모두 포함 필요' },
        { status: 400 }
      );
    }

    // 현재 비밀번호 검증
    const userResult = await query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const user = userResult.rows[0];

    // 현재 비밀번호가 일치하는지 확인
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: '현재 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 새 비밀번호 암호화
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // 최근 5개 비밀번호 이력 조회 (재사용 방지)
    const historyResult = await query(
      `SELECT password_hash FROM password_history
       WHERE user_id = $1
       ORDER BY changed_at DESC
       LIMIT 5`,
      [userId]
    );

    // 현재 비밀번호도 포함하여 이력 확인
    const allPreviousHashes = [
      user.password_hash,
      ...historyResult.rows.map((row: any) => row.password_hash),
    ];

    for (const oldHash of allPreviousHashes) {
      const isReused = await bcrypt.compare(newPassword, oldHash);
      if (isReused) {
        return NextResponse.json(
          { error: '최근 사용한 비밀번호는 재사용할 수 없습니다.' },
          { status: 400 }
        );
      }
    }

    // 트랜잭션: 비밀번호 변경 + 이력 기록 + 플래그 업데이트
    await transaction(async (trx) => {
      // 1. 비밀번호 이력에 새 비밀번호 기록
      await trx(
        `INSERT INTO password_history (user_id, password_hash, changed_at, changed_by)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3)`,
        [userId, newPasswordHash, 'user']
      );

      // 2. 사용자 비밀번호 업데이트 + 플래그 업데이트
      // 📌 SQLite boolean 호환성: false 대신 0 사용
      await trx(
        `UPDATE users
         SET password_hash = $1,
             is_default_password = 0,
             password_change_required = 0,
             last_password_changed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [newPasswordHash, userId]
      );
    });

    // 📌 user 쿠키 갱신: passwordChangeRequired = false로 업데이트
    // 클라이언트 쿠키를 직접 갱신하려면 user 정보를 다시 조회해야 함
    const updatedUserResult = await query(
      `SELECT id, email, status, role, airline_id
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (updatedUserResult.rows.length > 0) {
      const updatedUser = updatedUserResult.rows[0];
      const userCookieValue = encodeURIComponent(JSON.stringify({
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
        airline_id: updatedUser.airline_id,
        passwordChangeRequired: false, // 📌 플래그 갱신
      }));

      const response = NextResponse.json(
        { message: '비밀번호가 변경되었습니다.' },
        { status: 200 }
      );

      // user 쿠키 갱신
      response.cookies.set('user', userCookieValue, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });

      return response;
    }

    return NextResponse.json(
      { message: '비밀번호가 변경되었습니다.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    return NextResponse.json(
      { error: '비밀번호 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
