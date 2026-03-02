/**
 * 인증 상태 관리 (Zustand) - 메모리 전용 패턴 (XSS 안전)
 * - accessToken: 메모리에만 저장 (localStorage 제거 - XSS 방어)
 * - refreshToken: httpOnly 쿠키에만 저장 (서버 자동 포함, XSS 불가능)
 * - user: 메모리에만 저장
 *
 * 🔒 보안: 새로고침 시 refreshToken으로 새로운 accessToken 획득
 */

import { create } from 'zustand';
import { User } from '@/types/user';

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  // 액션
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (value: boolean) => void;
  logout: () => Promise<void>;
  fetchUserInfo: () => Promise<User | null>;
  initializeAuth: () => Promise<void>;

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
  isInitialized: false,

  setAuth: (user, accessToken) => {
    // ✅ accessToken은 메모리에만 저장 (XSS 방어)
    set({ user, accessToken, isLoading: false });
  },

  setAccessToken: (token) => {
    // ✅ accessToken은 메모리에만 저장 (XSS 방어)
    set({ accessToken: token });
  },

  setUser: (user) => {
    // 메모리에만 저장
    set({ user });
  },

  setLoading: (loading) =>
    set({ isLoading: loading }),

  setInitialized: (value) =>
    set({ isInitialized: value }),

  // 페이지 로드 시 초기화: refreshToken으로 새로운 accessToken 획득
  initializeAuth: async () => {
    try {
      const state = get();

      // 이미 초기화되었으면 스킵
      if (state.isInitialized) {
        return;
      }

      set({ isLoading: true });

      // refreshToken(httpOnly 쿠키)으로 새로운 accessToken 획득
      // (accessToken은 메모리 전용이므로 새로고침 시 초기화됨)
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // 🔒 쿠키 자동 포함
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        set({
          user: data.user,
          accessToken: data.accessToken,
          isInitialized: true,
          isLoading: false,
        });
      } else {
        // refreshToken이 유효하지 않으면 로그아웃
        await get().logout();
        set({ isInitialized: true, isLoading: false });
      }
    } catch (error) {
      console.error('[AuthStore] 초기화 오류:', error);
      await get().logout();
      set({ isInitialized: true, isLoading: false });
    }
  },

  // 서버에서 현재 사용자 정보 가져오기
  fetchUserInfo: async () => {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include', // 쿠키 포함
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          set({ user: data.user });
          return data.user;
        }
      }

      // 서버에서 사용자 정보를 가져올 수 없으면 로그아웃
      await get().logout();
      return null;
    } catch (error) {
      console.error('사용자 정보 가져오기 실패:', error);
      await get().logout();
      return null;
    }
  },

  logout: async () => {
    // 쿠키 정리를 위한 API 호출
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('로그아웃 API 호출 실패:', error);
    }

    // ✅ 메모리에서만 정리 (localStorage 사용 안 함)
    set({ user: null, accessToken: null, isLoading: false });
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

// 훅 형태로도 export (컴포넌트에서 사용)
export const useAuthStore = authStore;
