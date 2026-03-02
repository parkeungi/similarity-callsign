'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { authStore } from '@/store/authStore';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      })
  );

  // Option 4: 비활동 감시 및 토큰 만료 체크
  useEffect(() => {
    // 1️⃣ 사용자 활동 감시 (click, scroll, keypress)
    const handleActivity = () => {
      authStore.getState().recordActivity();
    };

    // 이벤트 리스너 등록
    const events = ['click', 'scroll', 'keypress', 'mousemove'];
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // 2️⃣ 주기적으로 비활동 시간 체크 (1분마다)
    const inactivityCheckInterval = setInterval(() => {
      const authState = authStore.getState();

      // 비활동 30분 확인
      if (authState.isAuthenticated() && authState.checkInactivity()) {
        console.warn('[SessionManager] 30분 비활동으로 로그아웃합니다.');
        authState.logout();
      }

      // 토큰 만료 확인 및 갱신 (5분 전 갱신)
      if (authState.isAuthenticated()) {
        authState.checkTokenExpiry().catch(() => {});
      }
    }, 60 * 1000); // 1분마다 실행

    // 3️⃣ 정리
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(inactivityCheckInterval);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
