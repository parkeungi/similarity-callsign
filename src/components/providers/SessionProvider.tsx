// 세션 프로바이더 - 세션 타임아웃 + 페이지 새로고침/서버 재시작 후 자동 세션 복구
'use client';

import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { ReactNode, useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';

/**
 * 세션 관리 프로바이더
 * 1. 페이지 새로고침/서버 재시작 후 refreshToken 쿠키 기반 세션 자동 복구
 * 2. 30분 비활동 시 자동 로그아웃 (세션 타임아웃)
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [isRestoring, setIsRestoring] = useState(true);
  const { user, accessToken, setAuth, setLoading, setSessionRestoring } = useAuthStore();

  // 세션 타임아웃 활성화
  useSessionTimeout();

  // 마운트 시 세션 복구 시도
  useEffect(() => {
    async function restoreSession() {
      // 이미 인증 상태면 복구 불필요
      if (user && accessToken) {
        setIsRestoring(false);
        setSessionRestoring(false);
        return;
      }

      // refreshToken 쿠키 기반 세션 복구 (refresh 응답에 user 포함 → /me 호출 불필요)
      try {
        setLoading(true);
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.user && refreshData.accessToken) {
            setAuth(refreshData.user, refreshData.accessToken);
          }
        }
      } catch {
        // refreshToken 쿠키 없거나 만료 → 미인증 상태 유지 (로그인 필요)
      } finally {
        setLoading(false);
        setIsRestoring(false);
        setSessionRestoring(false);
      }
    }

    restoreSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 복구 중에는 최소한의 로딩 표시 (깜빡임 방지)
  if (isRestoring) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return <>{children}</>;
}
