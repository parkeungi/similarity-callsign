'use client';

import { AdminAnnouncementResponse, Announcement } from '@/types/announcement';
import { ANNOUNCEMENT_LEVEL_COLORS } from '@/lib/constants';
import { useDeleteAnnouncement } from '@/hooks/useAnnouncements';
import { useState } from 'react';

interface Props {
  announcement: AdminAnnouncementResponse | Announcement;
  onClose: () => void;
  isAdmin?: boolean;
  onEdit?: (announcement: AdminAnnouncementResponse | Announcement) => void;
}

/**
 * AnnouncementDetailModal - 공지사항 상세 보기 모달
 *
 * 기능:
 * - 공지사항 상세 정보 표시 (제목, 내용, 기간, 대상 항공사 등)
 * - 관리자 모드: 수정/삭제 버튼
 * - 모달 오버레이
 */
export function AnnouncementDetailModal({
  announcement,
  onClose,
  isAdmin = false,
  onEdit,
}: Props) {
  const colors = ANNOUNCEMENT_LEVEL_COLORS[announcement.level];
  const isActive =
    new Date(announcement.startDate) <= new Date() &&
    new Date(announcement.endDate) >= new Date();

  const deleteMutation = useDeleteAnnouncement();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm('정말 이 공지사항을 삭제하시겠습니까?')) return;

    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(announcement.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  const targetAirlines = announcement.targetAirlines
    ? announcement.targetAirlines.split(',').map(code => code.trim())
    : null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 shadow-slate-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-slate-800 leading-tight pr-4">{announcement.title}</h2>
            <div className="flex items-center gap-3 mt-3">
              <span
                className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${colors.badge
                  }`}
              >
                {getLevelLabel(announcement.level)}
              </span>
              <span
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                {isActive ? '활성중' : '기한종료'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition-colors flex-shrink-0"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* 콘텐츠 */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
          {/* 메타정보 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-center">
              <span className="text-xs font-medium text-slate-500 mb-1.5">시작일</span>
              <div className="text-sm font-bold text-slate-800">
                {new Date(announcement.startDate).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })}
              </div>
            </div>
            <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-center">
              <span className="text-xs font-medium text-slate-500 mb-1.5">종료일</span>
              <div className="text-sm font-bold text-slate-800">
                {new Date(announcement.endDate).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })}
              </div>
            </div>
            <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-center">
              <span className="text-xs font-medium text-slate-500 mb-1.5">작성일</span>
              <div className="text-sm font-bold text-slate-800">
                {new Date(announcement.createdAt).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                })}
              </div>
            </div>
            {isAdmin && (
              <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-center">
                <span className="text-xs font-medium text-slate-500 mb-1.5">조회수</span>
                <div className="text-sm font-bold text-blue-600">
                  {(announcement as AdminAnnouncementResponse).viewCount || 0}명
                </div>
              </div>
            )}
          </div>

          {/* 부분 구분선 */}
          <div className="h-px w-full bg-slate-100"></div>

          {/* 대상 항공사 */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              대상항공사
            </h3>
            {targetAirlines && targetAirlines.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {targetAirlines.map(code => (
                  <span
                    key={code}
                    className="inline-flex items-center bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md text-xs font-bold border border-blue-200"
                  >
                    {code}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm font-medium text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 inline-block">👨‍✈️ 모든 항공사 대상</p>
            )}
          </div>

          {/* 내용 */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              상세 내용
            </h3>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed min-h-[120px]">
              {announcement.content}
            </div>
          </div>

          {/* 작성자 정보 (관리자만) */}
          {isAdmin && (
            <div className="mt-2 bg-slate-50/50 rounded-lg p-3 text-[11px] font-medium text-slate-500 border border-slate-100 flex flex-col gap-1">
              <p>
                <span className="text-slate-400 mr-2">작성자:</span> {announcement.createdByEmail || announcement.createdBy}
              </p>
              {announcement.updatedBy && (
                <p>
                  <span className="text-slate-400 mr-2">최종 수정:</span> {announcement.updatedBy}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-2 justify-end rounded-b-xl">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors shadow-sm focus:outline-none"
          >
            닫기
          </button>
          {isAdmin && (
            <>
              <button
                onClick={() => onEdit?.(announcement)}
                className="px-5 py-2 bg-white border border-blue-200 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                수정
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-5 py-2 bg-rose-600 rounded-lg text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 긴급도 라벨
 */
function getLevelLabel(level: string): string {
  switch (level) {
    case 'warning':
      return '경고';
    case 'success':
      return '완료';
    case 'info':
    default:
      return '일반';
  }
}
