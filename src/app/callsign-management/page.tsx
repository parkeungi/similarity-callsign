'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { OverviewTab } from '@/components/callsign-management/OverviewTab';
// import { ActionsTab } from '@/components/callsign-management/ActionsTab';
import { StatisticsTab } from '@/components/callsign-management/StatisticsTab';
import { Sidebar } from '@/components/callsign-management/Sidebar';
import { AdminOccurrenceTab } from '@/components/admin/callsign-management/AdminOccurrenceTab';
import { Header } from '@/components/layout/Header';
import { NanoIcon } from '@/components/ui/NanoIcon';
import {
  BarChart3,
  AlertTriangle,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function CallsignManagementPublicPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, accessToken } = useAuthStore((state) => ({
    user: state.user,
    accessToken: state.accessToken,
  }));
  const activeTab = searchParams.get('tab') || 'overview';

  const menuItems = [
    { id: 'overview', label: '조치현황', icon: BarChart3, color: 'primary' },
    { id: 'occurrences', label: '발생현황', icon: AlertTriangle, color: 'warning' },
    { id: 'stats', label: '통계', icon: TrendingUp, color: 'success' },
    { id: 'upload', label: '엑셀입력', icon: FileSpreadsheet, color: 'orange' },
  ];

  const handleTabChange = (tabId: string) => {
    router.push(`/callsign-management?tab=${tabId}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 왼쪽 메뉴 */}
        <aside className="w-72 bg-white border-r border-gray-200 flex flex-col pt-0 shrink-0 h-screen overflow-y-auto sticky top-0">
          <div className="px-6 py-4 mb-0">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">
              유사호출부호 관리
            </h2>
          </div>
          <nav className="flex-1 px-4 space-y-2">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full group flex items-center gap-4 px-4 py-4 rounded-none text-sm font-bold tracking-tight transition-all text-left border-l-4 ${isActive
                    ? 'bg-navy text-white shadow-[0_10px_20px_rgba(30,58,95,0.2)] border-primary'
                    : 'text-gray-500 hover:bg-gray-50 border-transparent hover:border-gray-200'
                    }`}
                >
                  <NanoIcon
                    icon={item.icon as any}
                    color={item.color as any}
                    size="sm"
                    isActive={isActive}
                  />
                  <span className={`transition-all duration-300 ${isActive ? 'translate-x-1' : 'group-hover:translate-x-1'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* 메인 콘텐츠 영역 */}
        <div className="flex-1 overflow-y-auto">
          <main className="flex-1 w-full px-6 pt-6 pb-10">
            {/* 페이지 헤더 */}
            <div className="flex items-center gap-4 border-b border-slate-200/80 pb-3 mb-5">
              <span className="w-5 h-0.5 bg-primary rounded-full shrink-0" />
              <span className="text-primary font-bold text-xs tracking-widest uppercase shrink-0">
                System Management
              </span>
              <h1 className="text-xl font-black text-slate-800 tracking-tight shrink-0">유사호출부호 관리</h1>
              <span className="text-slate-300">|</span>
              <p className="text-sm text-slate-500 font-medium truncate">
                항공교통본부 관리자 통합 대시보드 - 유사호출부호 업로드 및 항공사 조치 현황
              </p>
            </div>

            {/* 콘텐츠 표시 */}
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'occurrences' && <AdminOccurrenceTab />}
            {/* {activeTab === 'actions' && <ActionsTab />} */}
            {activeTab === 'stats' && <StatisticsTab />}
            {activeTab === 'upload' && <Sidebar />}
          </main>
        </div>
      </div>
      {/* 푸터 */}
      <footer className="py-5 bg-gray-800 text-gray-300 border-t border-gray-700 shrink-0">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-wrap gap-6 items-center justify-center">
            <div className="text-sm font-medium text-white">
              Callsign Safety Management Platform | Korea Airports Corporation
            </div>
            <div className="flex gap-5 text-sm">
              <span className="text-gray-400">Aviation Safety Division</span>
              <div>
                <span className="text-gray-400">T.</span>
                <span className="font-medium ml-1">1588-2311</span>
              </div>
              <div>
                <span className="text-gray-400">E.</span>
                <span className="font-medium ml-1">info@airport.kr</span>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-600 mt-3 pt-3 text-xs text-gray-400 text-center">
            © 2026 Korea Airports Corporation. All Rights Reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
