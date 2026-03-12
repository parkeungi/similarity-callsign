// 인증 API 클라이언트 - login·logout·refresh·getMe·changePassword·forgotPassword 함수, apiFetch 래퍼 사용
/**
 * 인증 관련 API 함수
 * - apiFetch 사용: 401 시 자동 토큰 갱신 인터셉터 적용
 */

import { apiFetch } from '@/lib/api/client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
}

interface ForgotPasswordRequest {
  email: string;
}

/**
 * 비밀번호 변경 API
 */
export async function changePasswordAPI(data: ChangePasswordRequest) {
  const response = await apiFetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    body: JSON.stringify({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
      newPasswordConfirm: data.newPasswordConfirm,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw error;
  }

  return response.json();
}

/**
 * 비밀번호 찾기 API (이메일 발송)
 */
export async function forgotPasswordAPI(data: ForgotPasswordRequest) {
  const response = await apiFetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw error;
  }

  return response.json();
}
