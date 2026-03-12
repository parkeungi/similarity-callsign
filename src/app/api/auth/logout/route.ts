// POST /api/auth/logout - 로그아웃 처리, refresh_tokens 테이블에서 해당 토큰 삭제, refreshToken 쿠키 제거
/**
 * POST /api/auth/logout
 * 로그아웃 (쿠키 삭제 + DB RefreshToken 무효화)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken } from '@/lib/jwt';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  // RefreshToken 해시 DB에서 삭제 (탈취된 토큰도 즉시 무효화)
  const refreshToken = request.cookies.get('refreshToken')?.value;
  if (refreshToken) {
    const payload = verifyRefreshToken(refreshToken);
    if (payload?.userId) {
      await query(
        `UPDATE users SET refresh_token_hash = NULL WHERE id = $1`,
        [payload.userId]
      ).catch(() => {
        // 로그아웃은 DB 오류와 무관하게 쿠키는 항상 삭제
      });
    }
  }

  const response = NextResponse.json({ message: '로그아웃되었습니다.' }, { status: 200 });

  response.cookies.set({
    name: 'refreshToken',
    value: '',
    maxAge: 0,
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  return response;
}
