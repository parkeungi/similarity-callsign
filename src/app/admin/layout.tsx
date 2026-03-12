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
    const router = useRouter();

    // 관리자가 아니면 즉시 홈으로 리다이렉트
    useEffect(() => {
        if (user === null) {
            // user가 null이면 로그인하지 않은 상태 → 홈으로 리다이렉트
            router.push('/');
        } else if (user.role !== 'admin') {
            // user가 있지만 admin이 아니면 홈으로 리다이렉트
            router.push('/');
        }
    }, [user, router]);

    // 관리자가 아니거나 로드 중이면 아무것도 렌더링하지 않음
    if (!user || user.role !== 'admin') {
        return null;
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
