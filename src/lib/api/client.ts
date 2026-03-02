/**
 * 인증 인터셉터가 내장된 글로벌 fetch 래퍼
 *
 * 동작 원리:
 * 1. 모든 API 요청에 Authorization 헤더 자동 삽입
 * 2. 응답이 401인 경우 /api/auth/refresh 로 토큰 갱신 시도
 * 3. 갱신 성공 시 원래 요청을 새 accessToken 으로 재시도
 * 4. 갱신 실패(refreshToken 만료 등) 시 로그아웃 처리
 */

import { authStore } from '@/store/authStore';

/** 동시 refresh 요청 방지를 위한 싱글 Promise 플래그 (모듈 레벨에서 공유) */
export let refreshingPromise: Promise<string | null> | null = null;

/**
 * /api/auth/refresh 호출 후 새 accessToken 반환
 * 실패하면 null 반환
 * (authStore.checkTokenExpiry()와 apiFetch에서 공유)
 */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include', // refreshToken 쿠키 포함
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const newAccessToken: string = data.accessToken;

    // 스토어 갱신
    authStore.getState().setAccessToken(newAccessToken);

    return newAccessToken;
  } catch {
    return null;
  }
}

/**
 * 토큰 갱신 중복 호출 방지: 동시에 여러 요청이 401 받아도 refresh는 1회만
 * (authStore.checkTokenExpiry()와 apiFetch에서 공유되는 뮤텍스)
 */
export async function getRefreshedToken(): Promise<string | null> {
  if (!refreshingPromise) {
    refreshingPromise = refreshAccessToken().finally(() => {
      refreshingPromise = null;
    });
  }
  return refreshingPromise;
}

/**
 * 인증 인터셉터가 포함된 fetch
 *
 * @param url      요청 URL
 * @param options  RequestInit 옵션 (headers 자동 병합)
 * @returns        Response
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const accessToken = authStore.getState().accessToken;

  // Authorization 헤더 병합
  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const firstResponse = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // 401이 아니면 그대로 반환
  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  // 401: 토큰 갱신 시도
  const newToken = await getRefreshedToken();

  if (!newToken) {
    // 갱신 실패 → 로그아웃 및 쿠키 삭제 후 리다이렉트
    // 쿠키 삭제 API를 기다린 후 리다이렉트해야 middleware가 올바르게 작동함
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // 로그아웃 API 실패해도 계속 진행
    }

    // 메모리 상태 초기화
    authStore.setState({ user: null, accessToken: null, isLoading: false });

    // 브라우저 환경에서만 리다이렉트
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return firstResponse;
  }

  // 새 토큰으로 재시도
  const retryHeaders = new Headers(options.headers);
  retryHeaders.set('Authorization', `Bearer ${newToken}`);
  if (!retryHeaders.has('Content-Type') && !(options.body instanceof FormData)) {
    retryHeaders.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers: retryHeaders,
    credentials: 'include',
  });
}
