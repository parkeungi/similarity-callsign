// 비밀번호 초기화 관리 페이지 - PasswordResetSection 렌더링, 사용자 선택 후 임시 비밀번호 발급
import AdminUsersPageClient from '../users/client';

/**
 * /admin/password-reset 라우트는 사용자 관리 탭 UI를 재사용한다.
 */
export default function AdminPasswordResetPage() {
  return <AdminUsersPageClient initialTab="password" />;
}

