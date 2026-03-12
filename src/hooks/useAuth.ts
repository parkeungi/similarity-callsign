// 인증 편의 훅 - logout(토큰삭제+리다이렉트)·refreshUser(GET /api/auth/me) 함수 export, authStore 연동
/**
 * useAuth 훅
 * - 인증 관련 편의 함수 모음
 * - authStore + API 레이어 조합
 */

'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { ROUTES } from '@/lib/constants';

export function useAuth() {
  const router = useRouter();
  const store = useAuthStore();

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // 서버 오류에 관계없이 클라이언트 초기화
    } finally {
      store.logout();
      router.push(ROUTES.HOME);
    }
  }

  async function refreshUser() {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) throw new Error('Failed to refresh user');
      const user = await response.json();
      store.setUser(user);
      return user;
    } catch {
      return null;
    }
  }

  return {
    user: store.user,
    accessToken: store.accessToken,
    isAuthenticated: store.isAuthenticated(),
    isAdmin: store.isAdmin(),
    isSuspended: store.isSuspended(),
    isActive: store.isActive(),
    isLoading: store.isLoading,
    logout,
    refreshUser,
  };
}
