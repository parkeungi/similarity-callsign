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
    await store.logout();
    router.push(ROUTES.HOME);
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
  };
}
