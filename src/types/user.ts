// 사용자 타입 - User(id·email·name·role·airline_id·status)·UserRole('admin'|'user'), users 테이블 매핑
/**
 * 항공사 인터페이스
 */
export interface Airline {
  id: string;
  code: string;
  name_ko: string;
  name_en?: string;
  created_at: string;
}

/**
 * 사용자 인터페이스 (PostgreSQL 데이터베이스)
 */
export interface User {
  id: string;
  email: string;
  password?: string; // 응답에는 포함되지 않음
  airline_id: string;
  airline?: Airline;
  status: 'active' | 'suspended';
  role: 'admin' | 'user';

  // 비밀번호 정책 추적
  is_default_password: boolean;
  password_change_required: boolean;
  last_password_changed_at?: string;

  // 기타 필드
  last_login_at?: string;
  created_at: string;
  updated_at: string;

  // API 응답용 camelCase 필드 (선택사항)
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 로그인 응답 타입
 */
export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * 회원가입 요청 타입
 */
export interface SignupRequest {
  email: string;
  password: string;
  passwordConfirm: string;
}

/**
 * 비밀번호 변경 요청 타입
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
}

/**
 * 비밀번호 찾기 요청 타입
 */
export interface ForgotPasswordRequest {
  email: string;
}

/**
 * API 에러 응답 타입
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}
