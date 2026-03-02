/**
 * Next.js 미들웨어: 서버사이드 라우트 보호
 * - refreshToken 쿠키만 검증 (단순화)
 * - 역할 기반 접근 제어는 클라이언트에서 처리
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 보호되는 라우트
const protectedRoutes = ['/airline', '/admin', '/announcements', '/callsign-management'];
// 📌 /change-password는 제외: 로그인 상태의 사용자가 언제든 접근 가능해야 함
const authRoutes = ['/login', '/forgot-password'];

interface RefreshTokenPayload {
  userId: string;
  exp?: number;
}

const decodeJwtPayload = (token: string): RefreshTokenPayload | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const base64Payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64Payload.padEnd(base64Payload.length + (4 - (base64Payload.length % 4)) % 4, '=');
    const decoded = atob(padded);
    const jsonPayload = decodeURIComponent(
      decoded
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );

    return JSON.parse(jsonPayload);
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

  // ✅ Option A: refreshToken 쿠키만 확인 (단순화)
  // sessionStorage 복구는 클라이언트(authStore)에서 처리
  const refreshToken = request.cookies.get('refreshToken')?.value;

  // 토큰 유효성/만료 여부 체크
  let tokenPayload: RefreshTokenPayload | null = null;
  let shouldDeleteRefreshToken = false;
  let isValidFormat = false;

  if (refreshToken) {
    const parts = refreshToken.split('.');
    isValidFormat = parts.length === 3 && parts.every((part) => part.length > 0);

    if (!isValidFormat) {
      shouldDeleteRefreshToken = true;
    } else {
      tokenPayload = decodeJwtPayload(refreshToken);
      if (!tokenPayload || isTokenExpired(tokenPayload)) {
        shouldDeleteRefreshToken = true;
        tokenPayload = null;
      }
    }
  }

  // refreshToken만으로 인증 여부 판단
  const isLoggedIn = !!refreshToken && isValidFormat && !!tokenPayload;
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  const finalizeResponse = (response: NextResponse) => {
    if (shouldDeleteRefreshToken) {
      response.cookies.delete('refreshToken');
    }
    return response;
  };

  // ✅ Option A: 단순화된 미들웨어 로직
  // 1. 로그인 안 된 상태 + 보호 라우트 → /login으로 리다이렉트
  if (!isLoggedIn && isProtectedRoute) {
    return finalizeResponse(NextResponse.redirect(new URL('/login', request.url)));
  }

  // 2. 로그인 상태 + 인증 라우트 → 보호 라우트로 리다이렉트
  if (isLoggedIn && isAuthRoute) {
    return finalizeResponse(NextResponse.redirect(new URL('/airline', request.url)));
  }

  // 3. 로그인 상태 + 홈(/) 접속 → /airline로 리다이렉트
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
