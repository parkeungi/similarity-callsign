// 사용자 서비스 레이아웃 - AppShell(Header+Footer) 래핑, 인증 필요 영역
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useAuthStore } from '@/store/authStore';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  const isSessionRestoring = useAuthStore((s) => s.isSessionRestoring);
  const router = useRouter();

  // 세션 복원 완료 후, 미인증이면 홈으로 리다이렉트
  useEffect(() => {
    if (isSessionRestoring) return;
    if (user === null) {
      router.push('/');
    }
  }, [user, isSessionRestoring, router]);

  // 세션 복원 중이거나 미인증이면 로딩(리다이렉트 대기) 표시
  if (isSessionRestoring || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
