// 공지사항 관리 페이지 - AnnouncementTable+AnnouncementFormModal 렌더링, useAnnouncements 훅
'use client';

import { useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { AnnouncementTable } from '@/components/announcements/AnnouncementTable';
import { AnnouncementFormModal } from '@/components/announcements/AnnouncementFormModal';
import { AnnouncementDetailModal } from '@/components/announcements/AnnouncementDetailModal';
import { AdminAnnouncementResponse, Announcement } from '@/types/announcement';

/**
 * /admin/announcements - 관리자 공지사항 관리 페이지
 *
 * 기능:
 * - 공지사항 생성/수정/삭제
 * - 전체 공지사항 조회
 * - 필터: 긴급도, 상태, 기간
 * - 읽음 통계 (viewCount)
 *
 * 인증 및 관리자 권한 체크는 admin 레이아웃/미들웨어에서 처리합니다.
 */
export default function AdminAnnouncementsPage() {
  const { user } = useAuthStore();
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<
    AdminAnnouncementResponse | Announcement | null
  >(null);
  const [editAnnouncement, setEditAnnouncement] = useState<
    AdminAnnouncementResponse | Announcement | null
  >(null);

  // 상세 모달에서 수정 버튼 클릭 시
  const handleEditFromDetail = (announcement: AdminAnnouncementResponse | Announcement) => {
    setSelectedAnnouncement(null);
    setEditAnnouncement(announcement);
    setShowFormModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <div className="bg-white border-b">
        <div className="w-full px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">공지사항 관리</h1>
              <p className="text-gray-600 mt-2">
                모든 항공사의 공지사항을 관리하세요.
              </p>
            </div>
            <button
              onClick={() => {
                setEditAnnouncement(null);
                setShowFormModal(true);
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-medium transition"
            >
              + 공지사항 작성
            </button>
          </div>
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="w-full px-4 py-6">
        {/* 테이블 */}
        <AnnouncementTable
          isAdmin={true}
          onSelectAnnouncement={setSelectedAnnouncement}
        />
      </div>

      {/* 작성/수정 모달 */}
      {showFormModal && (
        <AnnouncementFormModal
          announcement={editAnnouncement || undefined}
          onClose={() => {
            setShowFormModal(false);
            setEditAnnouncement(null);
          }}
          onSuccess={() => {
            setShowFormModal(false);
            setEditAnnouncement(null);
          }}
        />
      )}

      {/* 상세 모달 */}
      {selectedAnnouncement && (
        <AnnouncementDetailModal
          announcement={selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
          isAdmin={true}
          onEdit={handleEditFromDetail}
        />
      )}
    </div>
  );
}
