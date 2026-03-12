// 공지사항 입력 모달 - AnnouncementForm 래핑, 생성/수정 모드 분기, POST/PATCH API 호출
'use client';

import { Announcement } from '@/types/announcement';
import { AnnouncementForm } from './AnnouncementForm';

interface Props {
  announcement?: Announcement;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * AnnouncementFormModal - 공지사항 작성/수정 모달
 *
 * AnnouncementForm을 모달 오버레이로 감싼 래퍼
 *
 * 기능:
 * - 신규/수정 모드 지원
 * - 모달 오버레이
 * - 닫기 버튼 (X)
 */
export function AnnouncementFormModal({ announcement, onClose, onSuccess }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div className="bg-slate-900 rounded-none border border-slate-800 shadow-2xl shadow-black/50 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* 헤더 */}
        <div className="sticky top-0 bg-slate-800/50 border-b border-slate-800 px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-slate-100">
            {announcement ? '공지사항 수정' : '공지사항 작성'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* 폼 */}
        <div className="p-6">
          <AnnouncementForm
            announcement={announcement}
            onSuccess={() => {
              onSuccess?.();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
