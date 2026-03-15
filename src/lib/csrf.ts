// CSRF 토큰 생성/검증 유틸리티 - Double Submit Cookie 패턴
/**
 * CSRF 보호 (Double Submit Cookie 패턴)
 *
 * 동작 원리:
 * 1. 로그인 성공 시 랜덤 CSRF 토큰을 일반 쿠키로 발급
 * 2. 클라이언트가 상태 변경 요청 시 해당 토큰을 헤더에 포함
 * 3. 서버가 쿠키값 vs 헤더값 일치 확인
 * 4. 다른 도메인에서는 쿠키 읽기 불가 → 공격 차단
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

// CSRF 토큰 설정
export const CSRF_TOKEN_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'X-CSRF-Token';
export const CSRF_TOKEN_LENGTH = 32; // 256비트

/**
 * CSRF 토큰 생성
 */
export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * CSRF 토큰 쿠키 설정
 * @param response NextResponse 객체
 * @param token CSRF 토큰 (없으면 자동 생성)
 */
export function setCsrfTokenCookie(response: NextResponse, token?: string): string {
  const csrfToken = token || generateCsrfToken();

  response.cookies.set(CSRF_TOKEN_NAME, csrfToken, {
    httpOnly: false, // JavaScript에서 읽어서 헤더에 포함해야 함
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict', // 다른 사이트에서 쿠키 전송 차단
    maxAge: 7 * 24 * 60 * 60, // refreshToken과 동일 (7일)
    path: '/',
  });

  return csrfToken;
}

/**
 * CSRF 토큰 쿠키 삭제
 */
export function clearCsrfTokenCookie(response: NextResponse): void {
  response.cookies.set(CSRF_TOKEN_NAME, '', {
    maxAge: 0,
    path: '/',
  });
}

/**
 * CSRF 토큰 검증
 * @param request NextRequest 객체
 * @returns 검증 결과 (true: 통과, false: 실패)
 */
export function verifyCsrfToken(request: NextRequest): boolean {
  // 쿠키에서 토큰 추출
  const cookieToken = request.cookies.get(CSRF_TOKEN_NAME)?.value;

  // 헤더에서 토큰 추출
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  // 둘 다 존재하고 일치해야 통과
  if (!cookieToken || !headerToken) {
    return false;
  }

  // 상수 시간 비교 (타이밍 공격 방지)
  if (cookieToken.length !== headerToken.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < cookieToken.length; i++) {
    result |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i);
  }

  return result === 0;
}

/**
 * CSRF 검증 실패 응답
 */
export function csrfErrorResponse(): NextResponse {
  return NextResponse.json(
    { error: 'CSRF 토큰이 유효하지 않습니다.' },
    { status: 403 }
  );
}
