/**
 * Next.js 미들웨어: 서버사이드 라우트 보호
 * - refreshToken 쿠키 검증 (JWT 서명 검증 포함)
 * - 역할 기반 접근 제어는 클라이언트에서 처리
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

// 보호되는 라우트
const protectedRoutes = ['/airline', '/admin', '/announcements', '/callsign-management'];
// 📌 인증 라우트: 로그인한 사용자는 이 페이지로 갈 수 없음
const authRoutes = ['/signup', '/forgot-password', '/change-password'];

interface RefreshTokenPayload {
  userId: string;
  exp?: number;
}

// ✅ JWT 서명 검증 함수 (jsonwebtoken 라이브러리 사용)
const verifyRefreshToken = (token: string): RefreshTokenPayload | null => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.warn('[Middleware] JWT_SECRET이 설정되지 않음');
      return null;
    }

    // ✅ jsonwebtoken으로 서명 검증
    const decoded = jwt.verify(token, secret) as RefreshTokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
};

const isTokenExpired = (payload: RefreshTokenPayload | null): boolean => {
  if (!payload?.exp) {
    return true;
  }

  return payload.exp * 1000 <= Date.now();
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ✅ refreshToken 쿠키 추출
  const refreshToken = request.cookies.get('refreshToken')?.value;

  // 토큰 유효성 체크
  let tokenPayload: RefreshTokenPayload | null = null;
  let shouldDeleteRefreshToken = false;
  let isLoggedIn = false;

  if (refreshToken) {
    // ✅ JWT 서명 검증
    tokenPayload = verifyRefreshToken(refreshToken);

    if (!tokenPayload || isTokenExpired(tokenPayload)) {
      shouldDeleteRefreshToken = true;
      tokenPayload = null;
    } else {
      isLoggedIn = true;
    }
  }

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  const finalizeResponse = (response: NextResponse) => {
    if (shouldDeleteRefreshToken) {
      response.cookies.delete('refreshToken');
    }
    return response;
  };

  // 라우팅 로직
  // 1. 미로그인 + 보호 라우트 → 로그인 페이지(/)로 리다이렉트
  if (!isLoggedIn && isProtectedRoute) {
    return finalizeResponse(NextResponse.redirect(new URL('/', request.url)));
  }

  // 2. 로그인 상태 + 인증 라우트(signup, forgot-password, change-password) → /airline로 리다이렉트
  if (isLoggedIn && isAuthRoute) {
    return finalizeResponse(NextResponse.redirect(new URL('/airline', request.url)));
  }

  // 3. 로그인 상태 + 홈(/) 접속 → /airline으로 리다이렉트
  if (isLoggedIn && pathname === '/') {
    return finalizeResponse(NextResponse.redirect(new URL('/airline', request.url)));
  }

  return finalizeResponse(NextResponse.next());
}

/**
 * 미들웨어 설정
 */
export const config = {
  matcher: [
    // 모든 경로 (/_next, /api, /static, /favicon.ico 제외)
    '/((?!_next|api|static|favicon.ico).*)',
  ],
};
