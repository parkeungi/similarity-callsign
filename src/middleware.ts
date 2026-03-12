// Next.js 미들웨어 - refreshToken JWT 서명+만료 검증, 보호 경로 접근 제어
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/', '/auth/login', '/auth/register'];

/**
 * refreshToken JWT를 경량 검증 (서명 + 만료)
 * Edge Runtime 호환을 위해 jose 라이브러리 사용
 */
async function verifyRefreshTokenEdge(token: string): Promise<boolean> {
  try {
    const secret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;
    if (!secret) return false;

    const secretKey = new TextEncoder().encode(secret);
    await jwtVerify(token, secretKey, {
      issuer: 'katc1',
      audience: 'katc1:refresh',
    });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 공개 경로는 통과
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // refreshToken 쿠키 존재 여부 확인
  const refreshToken = request.cookies.get('refreshToken')?.value;

  if (!refreshToken) {
    const loginUrl = new URL('/', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // JWT 서명 + 만료 검증
  const isValid = await verifyRefreshTokenEdge(refreshToken);

  if (!isValid) {
    // 만료/변조된 토큰 → 쿠키 삭제 후 로그인 리다이렉트
    const loginUrl = new URL('/', request.url);
    const response = NextResponse.redirect(loginUrl);
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/airline',
    '/airline/:path*',
    '/change-password',
    '/callsign-management',
    '/callsign-management/:path*',
  ],
};
