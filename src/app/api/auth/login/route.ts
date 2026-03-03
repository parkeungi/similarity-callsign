/**
 * POST /api/auth/login
 * 로그인 API
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { generateAccessToken, generateRefreshToken } from '@/lib/jwt';
import * as authQueries from '@/lib/db/queries/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 유효성 검사
    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    const normalizedEmail = email.trim();

    // 사용자 조회 (항공사 정보, 비밀번호 정책 추적 필드 포함)
    const result = await query(authQueries.getUserByEmail, [normalizedEmail]);

    if (result.rows.length === 0) {
      // 열거 공격 방어: 존재하지 않는 사용자도 같은 메시지 반환
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    // 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 사용자 상태 확인
    if (user.status === 'suspended') {
      return NextResponse.json(
        { error: '정지된 계정입니다.' },
        { status: 403 }
      );
    }

    // 90일 비밀번호 만료 확인
    if (user.last_password_changed_at) {
      const lastChanged = new Date(user.last_password_changed_at);
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      if (lastChanged < ninetyDaysAgo) {
        // password_change_required 플래그 설정
        await query(
          `UPDATE users SET password_change_required = true, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [user.id]
        );
        user.password_change_required = true;
      }
    }

    // 마지막 로그인 시간 업데이트
    await query(authQueries.updateLastLogin, [user.id]);

    // 토큰 생성 (airline_id 포함)
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      airlineId: user.airline_id,
    });

    const refreshToken = generateRefreshToken(user.id);

    // 항공사 정보 구성
    const airline = user.airline_code
      ? {
          id: user.airline_id,
          code: user.airline_code,
          name_ko: user.airline_name_ko,
          name_en: user.airline_name_en,
        }
      : null;

    // 📌 비밀번호 강제 변경 기준: is_default_password 또는 password_change_required 중 하나라도 true
    // SQLite는 boolean을 정수 0/1로 저장하므로, !! 연산자로 변환 (1 === true는 false이므로)
    const needsPasswordChange = !!user.is_default_password || !!user.password_change_required;

    const sanitizedUser = {
      id: user.id,
      email: user.email,
      status: user.status,
      role: user.role,
      airline_id: user.airline_id,
      airline,
      is_default_password: user.is_default_password,
      password_change_required: user.password_change_required,
      forceChangePassword: needsPasswordChange,
    };

    // 응답 생성 (forceChangePassword 플래그 포함)
    const response = NextResponse.json(
      {
        user: sanitizedUser,
        accessToken,
        forceChangePassword: sanitizedUser.forceChangePassword,
      },
      { status: 200 }
    );

    // refreshToken은 httpOnly 쿠키에 저장
    // 📌 개발 환경(localhost:3002 HTTP)에서는 secure: false, 프로덕션에서는 secure: true
    response.cookies.set('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    // user 쿠키 설정 (라우트 보호 및 세션 확인용)
    // 📌 passwordChangeRequired 추가: 미들웨어에서 강제 리다이렉트 판단용
    // 📌 Next.js cookies.set()이 자동 인코딩하므로 JSON 문자열만 전달
    response.cookies.set('user', JSON.stringify({
      id: sanitizedUser.id,
      email: sanitizedUser.email,
      role: sanitizedUser.role,
      status: sanitizedUser.status,
      airline_id: sanitizedUser.airline_id,
      airline: sanitizedUser.airline,
      passwordChangeRequired: needsPasswordChange,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: '로그인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
