import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/auth/login', '/auth/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 공개 경로는 통과
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // refreshToken 쿠키 존재 여부로 인증 판단
  const refreshToken = request.cookies.get('refreshToken')?.value;

  if (!refreshToken) {
    const loginUrl = new URL('/', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 관리자 경로는 추가 검증 (accessToken의 role 클레임 확인은 API에서 수행)
  // 미들웨어에서는 쿠키 존재 여부만 1차 확인
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/airline/:path*',
    '/change-password',
    '/callsign-management/:path*',
  ],
};
