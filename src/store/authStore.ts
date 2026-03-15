// Zustand 인증 스토어 - user·accessToken·isAuthenticated 상태, login·logout·setAccessToken·setUser 액션, 전역 인증 상태 관리
/**
 * 인증 상태 관리 (Zustand) - 보안 강화 버전
 *
 * 보안 정책:
 * - accessToken: 메모리(Zustand)에만 저장 (XSS 방지)
 * - 새로고침 시: httpOnly refreshToken 쿠키로 세션 복구
 * - sessionStorage 사용 금지 (JavaScript 접근 차단)
 */

import { create } from 'zustand';
import { User } from '@/types/user';

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isSessionRestoring: boolean; // 세션 복원 진행 중 여부

  // 액션
  setAuth: (user: User, accessToken: string) => void;
  setUser: (user: User) => void;
  setAccessToken: (accessToken: string) => void;
  setLoading: (loading: boolean) => void;
  setSessionRestoring: (restoring: boolean) => void;
  logout: () => Promise<void>;

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
  isSessionRestoring: true, // 초기값 true: SessionProvider 복원 완료 전까지 레이아웃이 리다이렉트하지 않도록

  setAuth: (user, accessToken) => {
    // 메모리에만 저장 (sessionStorage 사용 금지 - XSS 방지)
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
    // 메모리에만 저장 (sessionStorage 사용 금지 - XSS 방지)
    set({ accessToken });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setSessionRestoring: (restoring) => {
    set({ isSessionRestoring: restoring });
  },

  logout: async () => {
    // 서버에 로그아웃 요청 (refreshToken 쿠키 삭제)
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // 실패해도 클라이언트 상태는 초기화
    }
    // 메모리 상태 초기화
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
