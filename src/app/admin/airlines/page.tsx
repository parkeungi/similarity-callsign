// 항공사 관리 페이지 - AirlinesAdminSection 렌더링, 항공사 생성·수정·삭제·순서변경
import AdminUsersPageClient from '../users/client';

/**
 * /admin/airlines 라우트는 사용자 관리 탭 화면을 재사용하여
 * 단일 UI 소스에서 항공사 관리 기능을 제공한다.
 */
export default function AirlinesAdminPage() {
  return <AdminUsersPageClient initialTab="airlines" />;
}
