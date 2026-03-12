// 공지사항 상세 조회 페이지 - GET /api/announcements/[id] 호출, 제목·내용·첨부파일 표시
'use client';

import { useAuthStore } from '@/store/authStore';
import { useAnnouncement, useViewAnnouncement } from '@/hooks/useAnnouncements';
import { redirect, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';

/**
 * /announcements/[id] - 공지사항 상세 페이지
 *
 * 기능:
 * - 단일 공지사항 조회
 * - 읽음 상태 자동 기록
 * - 긴급도 배지 표시
 * - 뒤로가기 버튼
 */
export default function AnnouncementDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { user, accessToken } = useAuthStore();
  const router = useRouter();
  const { data: announcement, isLoading, error } = useAnnouncement(params.id);
  const viewMutation = useViewAnnouncement();
  const viewRecorded = useRef(false);

  // 미인증 사용자 리다이렉트
  if (!accessToken || !user) {
    redirect('/');
  }

  // 관리자는 /admin/announcements로 리다이렉트
  if (user.role === 'admin') {
    redirect('/admin/announcements');
  }

  // 공지사항 로드 후 읽음 상태 기록 (한 번만 실행)
  useEffect(() => {
    if (announcement && !announcement.isViewed && !viewRecorded.current) {
      viewRecorded.current = true;
      viewMutation.mutate(params.id);
    }
  }, [announcement, params.id, viewMutation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="w-full px-4 py-8">
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-600">로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !announcement) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="w-full px-4 py-8">
          <div className="bg-white rounded-lg p-8 border border-red-200">
            <p className="text-red-600 font-medium">공지사항을 찾을 수 없습니다.</p>
            <Link
              href="/announcements"
              className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
            >
              <ChevronLeft className="w-4 h-4" />
              목록으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 긴급도 배지 스타일
  const levelStyles = {
    warning: 'bg-red-100 text-red-800 border border-red-300',
    info: 'bg-blue-100 text-blue-800 border border-blue-300',
    success: 'bg-green-100 text-green-800 border border-green-300',
  };

  const levelLabels = {
    warning: '🚨 경고',
    info: '📢 일반',
    success: '✅ 완료',
  };

  // 상태 배지
  const statusLabel = announcement.status === 'active' ? '진행중' : '종료됨';
  const statusColor =
    announcement.status === 'active'
      ? 'bg-green-100 text-green-800'
      : 'bg-gray-100 text-gray-800';

  // 날짜 포맷팅
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <div className="bg-white border-b">
        <div className="w-full px-4 py-6">
          <Link
            href="/announcements"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            목록으로 돌아가기
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{announcement.title}</h1>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="w-full px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          {/* 메타데이터 */}
          <div className="flex flex-wrap items-center gap-3 mb-6 pb-6 border-b">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${levelStyles[announcement.level as keyof typeof levelStyles]}`}>
              {levelLabels[announcement.level as keyof typeof levelLabels]}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}>
              {statusLabel}
            </span>
            <span className="text-gray-500 text-sm">
              {announcement.createdByEmail && `작성자: ${announcement.createdByEmail}`}
            </span>
          </div>

          {/* 시간 정보 */}
          <div className="grid grid-cols-2 gap-4 mb-8 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600 mb-1">시작일</p>
              <p className="font-medium text-gray-900">
                {formatDate(announcement.startDate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">종료일</p>
              <p className="font-medium text-gray-900">
                {formatDate(announcement.endDate)}
              </p>
            </div>
          </div>

          {/* 내용 */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wider">
              내용
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
              {announcement.content}
            </div>
          </div>

          {/* 조회 정보 */}
          {announcement.viewCount !== undefined && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <span className="font-semibold">{announcement.viewCount}명</span>이 이 공지사항을 읽었습니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
