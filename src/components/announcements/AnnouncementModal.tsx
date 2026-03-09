'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useActiveAnnouncements, useViewAnnouncement } from '@/hooks/useAnnouncements';
import { ANNOUNCEMENT_LEVEL_COLORS } from '@/lib/constants';

/**
 * AnnouncementModal - 활성 공지사항 팝업
 *
 * 특징:
 * - 로그인 후 활성 공지사항 팝업으로 표시
 * - 기간 내 공지사항만 자동 필터
 * - Session Storage로 닫음 상태 관리 (탭 닫으면 초기화)
 * - 첫 번째 미닫음 공지사항만 표시
 * - 닫기 버튼으로 세션 내 재표시 안 함
 */
export function AnnouncementModal() {
  const { data } = useActiveAnnouncements();
  const { mutate: recordView } = useViewAnnouncement();

  // 팝업 닫음 상태 (Session Storage)
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  // Session Storage에서 닫음 상태 복원
  useEffect(() => {
    setMounted(true);
    const saved = sessionStorage.getItem('dismissedAnnouncements');
    if (saved) {
      try {
        setDismissed(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse dismissed announcements:', e);
      }
    }
  }, []);

  if (!mounted) return null;

  // 표시할 공지사항 찾기 (첫 번째 미닫음)
  const announcements = data?.announcements || [];
  const toShow = announcements.find(a => !dismissed.includes(a.id));

  if (!toShow) return null; // 표시할 공지사항 없음

  const handleDismiss = () => {
    const updated = [...dismissed, toShow.id];
    setDismissed(updated);
    sessionStorage.setItem('dismissedAnnouncements', JSON.stringify(updated));

    // 읽음 상태 기록
    recordView(toShow.id);
  };

  const handleDetail = () => {
    handleDismiss();
    // 상세 조회는 컴포넌트 외부에서 라우팅으로 처리
  };

  // 긴급도별 색상
  const colors = ANNOUNCEMENT_LEVEL_COLORS[toShow.level];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <div
        className={`bg-slate-900 rounded-none shadow-2xl shadow-black/50 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-slate-800 ${colors.border}`}
      >
        {/* 헤더 */}
        <div className={`px-6 py-4 border-b border-slate-800 flex items-center justify-between ${colors.bg}`}>
          <div>
            <h2 className={`text-lg font-bold mb-1 flex items-center gap-2 ${colors.text}`}>
              <span>{getAnnouncementEmoji(toShow.level)}</span>
              <span>{toShow.title}</span>
            </h2>
            <p className="text-xs font-medium text-slate-400 opacity-80">
              {new Date(toShow.startDate).toLocaleDateString('ko-KR')} ~{' '}
              {new Date(toShow.endDate).toLocaleDateString('ko-KR')}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className={`opacity-70 hover:opacity-100 transition-opacity p-1.5 rounded-none ${colors.text} hover:bg-black/20`}
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
            {toShow.content}
          </p>
        </div>

        {/* 버튼 */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-800/50 flex gap-2 justify-end">
          <button
            onClick={handleDismiss}
            className="px-5 py-2 bg-slate-800 border border-slate-700 rounded-none text-sm font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors shadow-sm focus:outline-none"
          >
            닫기
          </button>
          <Link
            href={`/announcements/${toShow.id}`}
            onClick={handleDetail}
            className="px-5 py-2 bg-blue-600 rounded-none border border-blue-500 text-sm font-bold text-white hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            자세히 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * 긴급도별 이모지
 */
function getAnnouncementEmoji(level: string): string {
  switch (level) {
    case 'warning':
      return '🚨';
    case 'success':
      return '✅';
    case 'info':
    default:
      return '📢';
  }
}
