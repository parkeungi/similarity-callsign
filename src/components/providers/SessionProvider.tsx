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
  const { user, accessToken, setAuth, setLoading } = useAuthStore();

  // 세션 타임아웃 활성화
  useSessionTimeout();

  // 마운트 시 세션 복구 시도
  useEffect(() => {
    async function restoreSession() {
      // 이미 인증 상태면 복구 불필요
      if (user && accessToken) {
        setIsRestoring(false);
        return;
      }

      // sessionStorage에 accessToken이 남아있으면 (같은 탭 새로고침)
      const storedToken = typeof window !== 'undefined'
        ? sessionStorage.getItem('accessToken')
        : null;

      if (storedToken) {
        // /api/auth/me로 유저 정보만 복구
        try {
          const meRes = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          if (meRes.ok) {
            const data = await meRes.json();
            setAuth(data.user, storedToken);
            setIsRestoring(false);
            return;
          }
        } catch {
          // 실패 시 아래 refresh 시도
        }
      }

      // sessionStorage에 토큰 없음 (탭 재열기/서버 재시작) → refreshToken 쿠키로 복구
      try {
        setLoading(true);
        const refreshRes = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const newAccessToken = refreshData.accessToken;

          // 새 accessToken으로 유저 정보 조회
          const meRes = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${newAccessToken}` },
          });

          if (meRes.ok) {
            const meData = await meRes.json();
            setAuth(meData.user, newAccessToken);
          }
        }
      } catch {
        // refreshToken 쿠키 없거나 만료 → 미인증 상태 유지 (로그인 필요)
      } finally {
        setLoading(false);
        setIsRestoring(false);
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
