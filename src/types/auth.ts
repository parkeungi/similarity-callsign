// 인증 타입 - LoginRequest·LoginResponse·TokenPayload(userId·airlineId·role)·RefreshResponse, JWT 페이로드 구조
import { User } from './user';

/**
 * 토큰 갱신 응답 타입
 */
export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * 인증 상태 타입
 */
export interface AuthState {
  // ✅ CRITICAL FIX: any 제거 → User 명시적 타입
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * 로그인 요청 타입
 */
export interface LoginRequest {
  email: string;
  password: string;
}
