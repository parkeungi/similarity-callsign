// 사용자 관리 페이지 - UsersClient 컴포넌트 래핑(서버→클라이언트 분리)
import AdminUsersPageClient from "./client";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tabParam = params.tab;

  return <AdminUsersPageClient initialTab={tabParam} />;
}
