/**
 * GET /api/auth/me
 * 현재 로그인 사용자 정보 조회 (refreshToken 쿠키 기반 복원 지원)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, verifyRefreshToken } from '@/lib/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 토큰 추출: 1) Authorization 헤더 2) refreshToken 쿠키
    let userId: string | null = null;
    const authHeader = request.headers.get('Authorization');

    if (authHeader?.startsWith('Bearer ')) {
      // accessToken 검증
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      if (!payload) {
        return NextResponse.json(
          { error: '유효하지 않은 토큰입니다.' },
          { status: 401 }
        );
      }
      userId = payload.userId;
    } else {
      // refreshToken 쿠키 검증
      const refreshToken = request.cookies.get('refreshToken')?.value;
      if (!refreshToken) {
        return NextResponse.json(
          { error: '인증 토큰이 필요합니다.' },
          { status: 401 }
        );
      }
      const payload = verifyRefreshToken(refreshToken);
      if (!payload) {
        return NextResponse.json(
          { error: '유효하지 않은 토큰입니다.' },
          { status: 401 }
        );
      }
      userId = payload.userId;
    }

    if (!userId) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // DB에서 최신 정보 조회 (항공사 정보, 비밀번호 정책 추적 필드 포함)
    const result = await query(
      `SELECT
         u.id, u.email, u.status, u.role, u.last_login_at, u.created_at, u.updated_at,
         u.airline_id, u.is_default_password, u.password_change_required, u.last_password_changed_at,
         a.code as airline_code, a.name_ko as airline_name_ko, a.name_en as airline_name_en
       FROM users u
       LEFT JOIN airlines a ON u.airline_id = a.id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const user = result.rows[0];

    // 항공사 정보 구성
    const airline = user.airline_code
      ? {
          id: user.airline_id,
          code: user.airline_code,
          name_ko: user.airline_name_ko,
          name_en: user.airline_name_en,
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
        is_default_password: user.is_default_password,
        password_change_required: user.password_change_required,
        last_password_changed_at: user.last_password_changed_at,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    console.error('사용자 조회 오류:', error);
    return NextResponse.json(
      { error: '사용자 정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
