/**
 * 인증 상태 관리 (Zustand) - 개발 단계 단순 버전
 *
 * 개발 단계에서는 복잡한 세션 관리 불필요:
 * - 로그인 → 작업 → 서비스 재시작 → 로그인 사이클
 * - accessToken: sessionStorage에만 저장 (서비스 재시작 시 초기화)
 */

import { create } from 'zustand';
import { User } from '@/types/user';

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;

  // 액션
  setAuth: (user: User, accessToken: string) => void;
  setUser: (user: User) => void;
  setAccessToken: (accessToken: string) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;

  // 파생 상태
  isAuthenticated: () => boolean;
  isAdmin: () => boolean;
  isSuspended: () => boolean;
  isActive: () => boolean;
}

export const authStore = create<AuthStore>((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: false,

  setAuth: (user, accessToken) => {
    // sessionStorage에 저장 (새로고침 유지용)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('accessToken', accessToken);
    }

    set({
      user,
      accessToken,
      isLoading: false,
    });
  },

  setUser: (user) => {
    set({ user });
  },

  setAccessToken: (accessToken) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('accessToken', accessToken);
    }
    set({ accessToken });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  logout: () => {
    // sessionStorage 정리
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('accessToken');
    }

    set({
      user: null,
      accessToken: null,
      isLoading: false,
    });
  },

  isAuthenticated: () => {
    const { user, accessToken } = get();
    return user !== null && accessToken !== null;
  },

  isAdmin: () => {
    const { user } = get();
    return user?.role === 'admin';
  },

  isSuspended: () => {
    const { user } = get();
    return user?.status === 'suspended';
  },

  isActive: () => {
    const { user } = get();
    return user?.status === 'active';
  },
}));

export const useAuthStore = authStore;
