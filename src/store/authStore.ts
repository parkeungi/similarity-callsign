/**
 * 인증 상태 관리 (Zustand) - Hybrid 세션 패턴 (XSS 안전)
 *
 * Option 4: Hybrid 세션 관리
 * - accessToken: 메모리 + sessionStorage (새로고침 후 유지)
 * - refreshToken: httpOnly 쿠키에만 저장 (XSS 불가능)
 * - tokenExpiresAt: 토큰 만료 시간 (자동 갱신)
 * - lastActivityTime: 마지막 활동 시간 (비활동 감시 30분)
 *
 * 🔒 보안:
 * 1. Ctrl+Shift+R에서도 sessionStorage에 accessToken 남음 (새로고침 유지)
 * 2. refreshToken으로 자동 토큰 갱신 (만료 시)
 * 3. 30분 비활동 시 자동 로그아웃
 * 4. localStorage 미사용 (XSS 방어)
 */

import { create } from 'zustand';
import { User } from '@/types/user';

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  tokenExpiresAt: number | null; // 토큰 만료 시간 (timestamp)
  lastActivityTime: number | null; // 마지막 활동 시간 (비활동 감시용)

  // 액션
  setAuth: (user: User, accessToken: string, expiresIn?: number) => void;
  setAccessToken: (token: string, expiresIn?: number) => void;
  setUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (value: boolean) => void;
  logout: () => Promise<void>;
  fetchUserInfo: () => Promise<User | null>;
  initializeAuth: () => Promise<void>;

  // 세션 관리
  recordActivity: () => void; // 사용자 활동 기록
  checkInactivity: () => boolean; // 30분 비활동 여부 확인
  checkTokenExpiry: () => Promise<boolean>; // 토큰 만료 여부 및 갱신

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
  tokenExpiresAt: null,
  lastActivityTime: null,

  setAuth: (user, accessToken, expiresIn = 3600) => {
    // ✅ accessToken: 메모리 + sessionStorage (새로고침 후 유지)
    const now = Date.now();
    const expiresAt = now + (expiresIn * 1000); // 초 → 밀리초

    // sessionStorage에 저장 (Ctrl+Shift+R에서도 유지)
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('accessToken', accessToken);
      sessionStorage.setItem('tokenExpiresAt', expiresAt.toString());
      sessionStorage.setItem('lastActivityTime', now.toString());
    }

    set({
      user,
      accessToken,
      tokenExpiresAt: expiresAt,
      lastActivityTime: now,
      isLoading: false,
    });
  },

  setAccessToken: (token, expiresIn = 3600) => {
    // ✅ accessToken: 메모리 + sessionStorage 동시 저장
    const now = Date.now();
    const expiresAt = now + (expiresIn * 1000);

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('accessToken', token);
      sessionStorage.setItem('tokenExpiresAt', expiresAt.toString());
    }

    set({
      accessToken: token,
      tokenExpiresAt: expiresAt,
    });
  },

  setUser: (user) => {
    // 메모리에만 저장
    set({ user });
  },

  setLoading: (loading) =>
    set({ isLoading: loading }),

  setInitialized: (value) =>
    set({ isInitialized: value }),

  // 페이지 로드 시 초기화: sessionStorage → refreshToken → 로그아웃 순서
  initializeAuth: async () => {
    try {
      const state = get();

      // 이미 초기화되었으면 스킵
      if (state.isInitialized) {
        return;
      }

      set({ isLoading: true });

      // 1단계: sessionStorage에서 accessToken 확인 (새로고침 후 유지)
      if (typeof window !== 'undefined') {
        const storedToken = sessionStorage.getItem('accessToken');
        const storedExpiresAt = sessionStorage.getItem('tokenExpiresAt');
        const storedActivityTime = sessionStorage.getItem('lastActivityTime');

        if (storedToken && storedExpiresAt) {
          const now = Date.now();
          const expiresAt = parseInt(storedExpiresAt);
          const lastActivityTime = storedActivityTime ? parseInt(storedActivityTime) : now;

          // 토큰이 아직 유효하고, 30분 비활동이 아니면 복구
          const isTokenValid = now < expiresAt;
          const isNotInactive = (now - lastActivityTime) < (30 * 60 * 1000); // 30분

          if (isTokenValid && isNotInactive) {
            // sessionStorage에서 복구: 메모리에 복원하고 사용자 정보 백그라운드 로드
            set({
              accessToken: storedToken,
              tokenExpiresAt: expiresAt,
              lastActivityTime,
              isInitialized: true,
              isLoading: false,
            });

            // 백그라운드에서 사용자 정보 갱신 (실패해도 진행)
            get().fetchUserInfo().catch(() => {});
            return;
          }

          // 토큰 만료 또는 비활동: sessionStorage 정리
          sessionStorage.removeItem('accessToken');
          sessionStorage.removeItem('tokenExpiresAt');
          sessionStorage.removeItem('lastActivityTime');
        }
      }

      // 2단계: refreshToken(httpOnly 쿠키)으로 새로운 accessToken 획득
      const refreshResponse = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // 🔒 쿠키 자동 포함
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        const now = Date.now();
        const expiresAt = now + ((data.expiresIn || 3600) * 1000);

        // sessionStorage에 새로운 토큰 저장
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('accessToken', data.accessToken);
          sessionStorage.setItem('tokenExpiresAt', expiresAt.toString());
          sessionStorage.setItem('lastActivityTime', now.toString());
        }

        set({
          user: data.user,
          accessToken: data.accessToken,
          tokenExpiresAt: expiresAt,
          lastActivityTime: now,
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

    // ✅ 메모리 + sessionStorage 정리
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('tokenExpiresAt');
      sessionStorage.removeItem('lastActivityTime');
    }

    set({
      user: null,
      accessToken: null,
      tokenExpiresAt: null,
      lastActivityTime: null,
      isLoading: false,
    });
  },

  // 사용자 활동 기록 (비활동 감시용)
  recordActivity: () => {
    const now = Date.now();

    if (typeof window !== 'undefined') {
      sessionStorage.setItem('lastActivityTime', now.toString());
    }

    set({ lastActivityTime: now });
  },

  // 30분 비활동 확인
  checkInactivity: () => {
    const state = get();

    if (!state.lastActivityTime) {
      return true; // 활동 시간이 없으면 비활동 상태
    }

    const now = Date.now();
    const inactiveTime = now - state.lastActivityTime;
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30분

    return inactiveTime > INACTIVITY_TIMEOUT;
  },

  // 토큰 만료 확인 및 자동 갱신
  checkTokenExpiry: async () => {
    const state = get();

    if (!state.tokenExpiresAt) {
      return false; // 토큰 없음
    }

    const now = Date.now();
    const timeUntilExpiry = state.tokenExpiresAt - now;
    const REFRESH_THRESHOLD = 5 * 60 * 1000; // 만료 5분 전 갱신

    // 토큰이 아직 유효하면 true 반환
    if (timeUntilExpiry > REFRESH_THRESHOLD) {
      return true;
    }

    // 토큰이 만료되었거나 곧 만료: refreshToken으로 갱신
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const newExpiresAt = now + ((data.expiresIn || 3600) * 1000);

        // sessionStorage 업데이트
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('accessToken', data.accessToken);
          sessionStorage.setItem('tokenExpiresAt', newExpiresAt.toString());
        }

        set({
          accessToken: data.accessToken,
          user: data.user,
          tokenExpiresAt: newExpiresAt,
        });

        return true;
      }

      // 갱신 실패: 로그아웃
      await get().logout();
      return false;
    } catch (error) {
      console.error('[AuthStore] 토큰 갱신 오류:', error);
      await get().logout();
      return false;
    }
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
