// 관리자 레이아웃 - JWT role=admin 검증, AdminSidebar+Header 렌더링, 비관리자 /airline로 리다이렉트
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { AdminSidebar } from '@/components/layout/AdminSidebar';
import { useAuthStore } from '@/store/authStore';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const user = useAuthStore((s) => s.user);
    const isSessionRestoring = useAuthStore((s) => s.isSessionRestoring);
    const router = useRouter();

    // 세션 복원 완료 후, 관리자가 아니면 홈으로 리다이렉트
    useEffect(() => {
        if (isSessionRestoring) return;
        if (user === null) {
            router.push('/');
        } else if (user.role !== 'admin') {
            router.push('/');
        }
    }, [user, isSessionRestoring, router]);

    // 세션 복원 중이거나 관리자가 아니면 로딩(리다이렉트 대기) 표시
    if (isSessionRestoring || !user || user.role !== 'admin') {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <Header />
            <div className="flex flex-1 min-h-0 overflow-hidden bg-gray-50">
                <div className="flex w-full max-w-[1440px] mx-auto min-h-0">
                    {/* 사이드바는 스크롤 없이 고정 */}
                    <AdminSidebar />

                    {/* 메인 콘텐츠 영역은 자체 스크롤 */}
                    <div className="flex-1 overflow-y-auto">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
