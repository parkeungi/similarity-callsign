// 공지사항 팝업 - 로그인 직후 미확인 공지 자동 표시, localStorage로 확인 여부 관리
'use client';

import { useState, useCallback } from 'react';
import { X, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { useViewAnnouncement } from '@/hooks/useAnnouncements';
import { Announcement } from '@/types/announcement';

interface AnnouncementWithStatus extends Announcement {
  isViewed?: boolean;
  status?: 'active' | 'expired';
}

interface AnnouncementPopupProps {
  announcements: AnnouncementWithStatus[];
  onClose: () => void;
  onAllRead: () => void;
}

export function AnnouncementPopup({
  announcements,
  onClose,
  onAllRead,
}: AnnouncementPopupProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const viewMutation = useViewAnnouncement();

  // 아코디언 토글
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 개별 읽음 처리
  const handleMarkAsRead = useCallback(
    async (announcementId: string) => {
      try {
        await viewMutation.mutateAsync(announcementId);
      } catch (error) {
        console.error('[AnnouncementPopup] 읽음 처리 실패:', error);
      }
    },
    [viewMutation]
  );

  // 모두 확인 처리
  const handleMarkAllAsRead = useCallback(async () => {
    setIsProcessing(true);
    try {
      const unreadAnnouncements = announcements.filter((a) => !a.isViewed);
      // 순차적으로 각 공지사항을 읽음 처리
      for (const announcement of unreadAnnouncements) {
        await viewMutation.mutateAsync(announcement.id);
      }
      onAllRead();
    } catch (error) {
      console.error('[AnnouncementPopup] 모두 확인 처리 실패:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [announcements, onAllRead, viewMutation]);

  const unreadCount = announcements.filter((a) => !a.isViewed).length;

  // 레벨별 배지 아이콘 및 색상
  const getLevelIcon = (level: 'warning' | 'info' | 'success') => {
    switch (level) {
      case 'warning':
        return <AlertCircle className="w-4 h-4" />;
      case 'success':
        return <CheckCircle className="w-4 h-4" />;
      case 'info':
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getLevelColor = (level: 'warning' | 'info' | 'success') => {
    switch (level) {
      case 'warning':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'success':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'info':
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const getLevelBadgeColor = (level: 'warning' | 'info' | 'success') => {
    switch (level) {
      case 'warning':
        return 'bg-red-100 text-red-700';
      case 'success':
        return 'bg-green-100 text-green-700';
      case 'info':
      default:
        return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="w-[600px] max-w-[95vw] max-h-[80vh] bg-white rounded-xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              확인하지 않은 공지사항
            </h2>
            <p className="text-sm text-gray-500 mt-1">{unreadCount}건</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xl text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 공지사항 목록 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {announcements.map((announcement) => {
            const isExpanded = expandedIds.has(announcement.id);
            const isRead = announcement.isViewed;

            return (
              <div
                key={announcement.id}
                className={`border rounded-lg transition ${
                  isRead
                    ? 'bg-gray-50 border-gray-200'
                    : `${getLevelColor(announcement.level)} border-current`
                }`}
              >
                {/* 제목 영역 */}
                <div className="px-4 py-3 cursor-pointer" onClick={() => toggleExpand(announcement.id)}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${getLevelBadgeColor(
                            announcement.level
                          )}`}
                        >
                          {getLevelIcon(announcement.level)}
                          {announcement.level === 'warning'
                            ? '중요'
                            : announcement.level === 'success'
                              ? '완료'
                              : '안내'}
                        </span>
                        {isRead && (
                          <span className="text-xs font-medium text-gray-500 bg-gray-200 px-2 py-1 rounded">
                            확인함
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-gray-900">
                        {announcement.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(announcement.startDate).toLocaleDateString(
                          'ko-KR'
                        )}{' '}
                        ~{' '}
                        {new Date(announcement.endDate).toLocaleDateString(
                          'ko-KR'
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-600 transition flex-shrink-0"
                    >
                      <svg
                        className={`w-5 h-5 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 14l-7 7m0 0l-7-7m7 7V3"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* 내용 영역 (아코디언) */}
                {isExpanded && (
                  <div className="px-4 py-3 border-t border-current/20 bg-white/50">
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap mb-4">
                      {announcement.content}
                    </div>

                    {/* 개별 읽음 버튼 */}
                    {!isRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(announcement.id)}
                        disabled={viewMutation.isPending}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition"
                      >
                        <CheckCircle className="w-3 h-3" />
                        확인했음
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg font-semibold text-sm hover:bg-gray-50 transition"
          >
            나중에 확인
          </button>
          <button
            type="button"
            onClick={handleMarkAllAsRead}
            disabled={isProcessing || unreadCount === 0}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 disabled:bg-gray-400 transition"
          >
            {isProcessing ? '처리 중...' : '모두 확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
