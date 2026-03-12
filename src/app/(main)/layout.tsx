// 사용자 서비스 레이아웃 - AppShell(Header+Footer) 래핑, 인증 필요 영역
import { AppShell } from '@/components/layout/AppShell';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
