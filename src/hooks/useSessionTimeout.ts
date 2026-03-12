// 세션 타임아웃 훅 - 마우스/키보드 이벤트 감지, 30분 비활동 시 authStore.logout() 호출+/ 리다이렉트
/**
 * 세션 타임아웃 훅
 * - 30분 비활동 시 자동 로그아웃
 * - 마우스, 키보드, 터치 활동 감지 시 타이머 리셋
 */

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30분

export function useSessionTimeout() {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuthStore();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 타이머 시작/리셋
  const resetTimer = useCallback(() => {
    // 기존 타이머 취소
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // 인증되지 않았으면 타이머 설정 안 함
    if (!isAuthenticated()) {
      return;
    }

    // 새 타이머 설정
    timeoutRef.current = setTimeout(async () => {
      console.log('[SessionTimeout] 30분 비활동으로 자동 로그아웃');

      // 서버 로그아웃 API 호출 (DB refresh_token_hash 무효화 + 쿠키 삭제)
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
      } catch {
        // 네트워크 실패 시에도 클라이언트 상태는 정리
      }

      // 클라이언트 상태 정리
      logout();
      router.push('/');
    }, SESSION_TIMEOUT_MS);
  }, [isAuthenticated, logout, router]);

  useEffect(() => {
    // 초기 타이머 시작
    resetTimer();

    // 활동 이벤트 리스너 등록
    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      resetTimer();
    };

    // 모든 활동 이벤트에 리스너 추가
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    // 정리
    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [resetTimer]);
}
