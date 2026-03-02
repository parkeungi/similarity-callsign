/**
 * 인증 상태 관리 (Zustand) - 하이브리드 패턴
 * - accessToken: localStorage + 메모리에 저장 (새로고침 시 자동 복원)
 * - refreshToken: httpOnly 쿠키에만 저장 (서버 자동 포함)
 * - user: 메모리에만 저장 (accessToken 로드 후 복원)
 */

import { create } from 'zustand';
import { User } from '@/types/user';

const STORAGE_KEY = 'auth_token';

// localStorage 헬퍼 함수
const getTokenFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const saveTokenToStorage = (token: string): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    console.warn('[AuthStore] localStorage 저장 실패');
  }
};

const removeTokenFromStorage = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    console.warn('[AuthStore] localStorage 삭제 실패');
  }
};

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
    // accessToken을 메모리 + localStorage에 저장
    set({ user, accessToken, isLoading: false });
    saveTokenToStorage(accessToken);
  },

  setAccessToken: (token) => {
    // accessToken을 메모리 + localStorage에 저장
    set({ accessToken: token });
    saveTokenToStorage(token);
  },

  setUser: (user) => {
    // 메모리에만 저장
    set({ user });
  },

  setLoading: (loading) =>
    set({ isLoading: loading }),

  setInitialized: (value) =>
    set({ isInitialized: value }),

  // 페이지 로드 시 초기화: localStorage 토큰 복원 또는 refreshToken으로 갱신
  initializeAuth: async () => {
    try {
      const state = get();

      // 이미 초기화되었으면 스킵
      if (state.isInitialized) {
        return;
      }

      set({ isLoading: true });

      // 1️⃣ localStorage에서 accessToken 복원 시도 (빠른 복원)
      const storedToken = getTokenFromStorage();
      if (storedToken) {
        set({
          accessToken: storedToken,
          isInitialized: true,
          isLoading: false,
        });
        console.log('[AuthStore] 초기화 완료: localStorage에서 accessToken 복원');

        // 백그라운드에서 user 정보도 복원 (새로고침 시 user가 null인 문제 해결)
        get().fetchUserInfo().catch(() => {
          // user 복원 실패는 무시 (API 요청 시 자동 갱신됨)
        });
        return;
      }

      // 2️⃣ localStorage 토큰이 없으면 refreshToken으로 갱신
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // 쿠키 포함
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        set({
          user: data.user,
          accessToken: data.accessToken,
          isInitialized: true,
          isLoading: false,
        });
        saveTokenToStorage(data.accessToken);
        console.log('[AuthStore] 초기화 완료: refreshToken으로 토큰 갱신');
      } else {
        // refreshToken이 유효하지 않으면 로그아웃
        await get().logout();
        set({ isInitialized: true, isLoading: false });
        console.log('[AuthStore] 초기화 완료: refreshToken 유효하지 않음');
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
    // 쿠키 정리를 위한 API 호출 (완료 대기)
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('로그아웃 API 호출 실패:', error);
    }

    // 메모리 + localStorage에서 정리
    set({ user: null, accessToken: null, isLoading: false });
    removeTokenFromStorage();
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
