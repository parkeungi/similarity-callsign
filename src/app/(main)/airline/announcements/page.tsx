// 항공사용 공지사항 목록 페이지 - AnnouncementTable 렌더링, GET /api/announcements 호출
'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AirlineAnnouncementList } from '@/components/airline/AirlineAnnouncementList';

/**
 * /airline/announcements - 항공사용 공지사항 전체 목록 페이지
 *
 * 기능:
 * - 자신의 항공사 공지사항 이력 조회
 * - 검색 기능
 * - 필터: 긴급도, 상태
 * - 페이지네이션
 * - 읽음 여부 표시
 */
export default function AirlineAnnouncementsPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();

  // 미인증 사용자 리다이렉트
  if (!accessToken || !user) {
    redirect('/');
  }

  // 관리자는 /admin/announcements로 리다이렉트
  if (user.role === 'admin') {
    redirect('/admin/announcements');
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-semibold">뒤로 가기</span>
          </button>
          <h1 className="text-3xl font-black text-gray-900">공지사항</h1>
          <p className="text-gray-600 mt-2">
            모든 공지사항을 확인하고 검색할 수 있습니다.
          </p>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8">
          <AirlineAnnouncementList
            title="공지사항"
            subtitle="제목 또는 내용으로 검색하고 긴급도, 상태로 필터링할 수 있습니다."
            showSearch={true}
            showLevelFilter={true}
            showStatusFilter={true}
            defaultLimit={10}
            initialStatus="all"
          />
        </div>
      </div>
    </div>
  );
}
