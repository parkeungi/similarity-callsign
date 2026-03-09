'use client';

import React, { useState, useMemo } from 'react';
import { useAnnouncementHistory, useViewAnnouncement } from '@/hooks/useAnnouncements';
import {
  ANNOUNCEMENT_LEVEL_META,
  ANNOUNCEMENT_STATUS_META,
} from '@/types/airline';
import { formatAnnouncementPeriod, truncateText } from '@/hooks/useDateRangeFilter';
import { Announcement } from '@/types/announcement';
import { ChevronDown } from 'lucide-react';

interface AirlineAnnouncementListProps {
  title?: string;
  subtitle?: string;
  showSearch?: boolean;
  showLevelFilter?: boolean;
  showStatusFilter?: boolean;
  onViewAll?: () => void;
  defaultLimit?: number;
  initialStatus?: 'active' | 'expired' | 'all';
}

// 공지사항 히스토리는 status, isViewed 필드가 포함됨
type AnnouncementWithStatus = Announcement & {
  status?: 'active' | 'expired';
  isViewed?: boolean;
};

export function AirlineAnnouncementList({
  title = '공지사항',
  subtitle,
  showSearch = true,
  showLevelFilter = true,
  showStatusFilter = false,
  onViewAll,
  defaultLimit = 10,
  initialStatus = 'all',
}: AirlineAnnouncementListProps) {
  const viewAnnouncement = useViewAnnouncement();

  // 필터 및 페이지네이션 상태
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'warning' | 'info' | 'success' | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'expired' | 'all'>(initialStatus);
  const [currentPage, setCurrentPage] = useState(1);
  const [markingAsRead, setMarkingAsRead] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // API 쿼리 파라미터 구성
  const filters = useMemo(
    () => ({
      level: levelFilter !== 'all' ? levelFilter : undefined,
      status: (statusFilter !== 'all' ? statusFilter : 'all') as 'active' | 'expired' | 'all',
      search: search || undefined,
      page: currentPage,
      limit: defaultLimit,
    }),
    [levelFilter, statusFilter, search, currentPage, defaultLimit]
  );

  // 데이터 조회
  const { data, isLoading, error } = useAnnouncementHistory(filters);

  // 검색 실행
  const handleSearch = () => {
    setSearch(searchInput);
    setCurrentPage(1);
  };

  // 엔터키로 검색
  const handleSearchKeydown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 필터 변경 시 페이지 1로 리셋
  const handleLevelFilterChange = (level: 'warning' | 'info' | 'success' | 'all') => {
    setLevelFilter(level);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (status: 'active' | 'expired' | 'all') => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  // 공지사항 읽음 처리
  const handleMarkAsRead = async (announcementId: string) => {
    setMarkingAsRead(announcementId);
    try {
      await viewAnnouncement.mutateAsync(announcementId);
    } catch (error) {
      console.error('Failed to mark announcement as read:', error);
    } finally {
      setMarkingAsRead(null);
    }
  };

  // 데이터 처리
  const announcements = (data?.announcements || []) as AnnouncementWithStatus[];
  const totalPages = data ? Math.ceil(data.total / (data.limit || defaultLimit)) : 1;

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-2">
        <div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight">
            {title}
          </h3>
          {subtitle && <p className="text-sm text-slate-500 mt-2 font-medium">{subtitle}</p>}
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-all duration-300 shadow-sm"
          >
            전체 보기
          </button>
        )}
      </div>

      {/* 검색 및 필터 바 */}
      {(showSearch || showLevelFilter || showStatusFilter) && (
        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100 flex flex-col lg:flex-row gap-5">
          {showSearch && (
            <div className="flex-1 flex gap-3">
              <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                <input
                  type="text"
                  placeholder="제목, 내용으로 검색..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeydown}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm text-slate-800 placeholder:text-slate-400"
                />
              </div>
              <button
                type="button"
                onClick={handleSearch}
                className="px-6 py-3 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-all shadow-md hover:shadow-lg focus:ring-2 focus:ring-indigo-500/50 focus:outline-none whitespace-nowrap"
              >
                검색
              </button>
            </div>
          )}

          {/* Filters */}
          {(showLevelFilter || showStatusFilter) && (
            <div className="flex flex-wrap items-center gap-4 lg:pl-5 lg:border-l lg:border-slate-200/80">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:block">Filters</span>

              {showLevelFilter && (
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                  {[
                    { id: 'all', label: '전체' },
                    { id: 'warning', label: '긴급', activeClass: 'bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 font-bold' },
                    { id: 'info', label: '일반', activeClass: 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 font-bold' },
                    { id: 'success', label: '완료', activeClass: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 font-bold' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => handleLevelFilterChange(f.id as any)}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${levelFilter === f.id
                          ? (f.activeClass || 'bg-slate-800 text-white hover:bg-slate-700')
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}

              {showStatusFilter && (
                <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                  {[
                    { id: 'all', label: '전체' },
                    { id: 'active', label: '진행중', activeClass: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 font-bold' },
                    { id: 'expired', label: '종료', activeClass: 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-700 font-bold' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => handleStatusFilterChange(f.id as any)}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${statusFilter === f.id
                          ? (f.activeClass || 'bg-slate-800 text-white hover:bg-slate-700')
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 콘텐츠 영역 */}
      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="relative w-12 h-12 mb-5">
            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-600 font-bold">공지사항을 불러오는 중입니다</p>
          <p className="text-slate-400 text-sm mt-1 font-medium">잠시만 기다려주세요</p>
        </div>
      ) : error ? (
        <div className="py-24 flex flex-col items-center justify-center bg-white rounded-3xl border border-rose-100 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-slate-800 font-bold">공지사항 조회에 실패했습니다</p>
          <p className="text-slate-500 text-sm mt-1 font-medium">잠시 후 다시 시도해주세요</p>
        </div>
      ) : announcements.length === 0 ? (
        <div className="py-32 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 border-dashed">
          <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-5 border border-slate-100">
            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-slate-700 font-bold">공지사항이 없습니다</p>
          <p className="text-slate-400 text-sm mt-1 font-medium">새로운 공지사항이 등록되면 여기에 표시됩니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((item) => {
            const levelMeta =
              ANNOUNCEMENT_LEVEL_META[
              item.level as keyof typeof ANNOUNCEMENT_LEVEL_META
              ] || ANNOUNCEMENT_LEVEL_META.info;
            const statusKey = (item.status as 'active' | 'expired') || 'active';
            const statusMeta = ANNOUNCEMENT_STATUS_META[statusKey];
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className={`border rounded-2xl overflow-hidden transition-all duration-300 bg-white ${isExpanded
                    ? 'border-indigo-200 shadow-[0_8px_30px_rgb(79,70,229,0.12)] ring-1 ring-indigo-50 relative z-10'
                    : 'border-slate-100 shadow-sm hover:border-indigo-100 hover:shadow-md hover:-translate-y-[2px] relative z-0'
                  }`}
              >
                {/* 헤더 - 항상 표시 */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full px-6 py-5 flex items-center md:items-start lg:items-center flex-col md:flex-row gap-4 hover:bg-slate-50/50 transition-colors duration-300 text-left group"
                >
                  <div className="flex w-full md:w-auto items-center gap-4 flex-1 min-w-0">
                    {/* 레벨 배지 */}
                    <div className="flex-shrink-0">
                      <span className={`inline-flex px-3 py-1.5 rounded-xl text-[11px] font-black tracking-wide ${levelMeta.label === '긴급' ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-500/20' :
                          levelMeta.label === '일반' ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-500/20' :
                            'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20'
                        }`}>
                        {levelMeta.label}
                      </span>
                    </div>

                    {/* 제목과 날짜 (데스크탑) */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5 md:flex-row md:items-center lg:gap-4 md:justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <h4 className={`text-[15px] font-bold line-clamp-1 transition-colors ${isExpanded ? 'text-indigo-900' : 'text-slate-800 group-hover:text-indigo-600'
                          }`}>
                          {item.title}
                        </h4>
                        {!item.isViewed && (
                          <div className="px-2 py-0.5 rounded-md bg-rose-500 text-white text-[9px] font-black tracking-widest uppercase flex-shrink-0 shadow-sm">
                            NEW
                          </div>
                        )}
                      </div>

                      {/* 날짜 배지 */}
                      <div className="hidden md:flex flex-shrink-0">
                        <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-100">
                          {formatAnnouncementPeriod(item.startDate, item.endDate)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 날짜 배지 (모바일) & 확장 액션 */}
                  <div className="flex items-center justify-between w-full md:w-auto gap-4 flex-shrink-0 mt-2 md:mt-0">
                    <div className="flex md:hidden flex-shrink-0">
                      <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                        {formatAnnouncementPeriod(item.startDate, item.endDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold ${statusMeta.label === '진행중' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                        {statusMeta.label}
                      </span>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isExpanded ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600'
                        }`}>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </div>
                </button>

                {/* 내용 - 펼쳤을 때만 표시 (부드러운 확장 애니메이션) */}
                <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden">
                    <div className="px-6 py-6 pb-5 bg-gradient-to-b from-[#f8fafc] to-white border-t border-slate-100">
                      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mb-6">
                        <p className="text-[15px] text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {item.content}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
                        <span className="text-[13px] font-medium text-slate-400 flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                          작성일: <span className="text-slate-600 font-semibold">{new Date(item.createdAt).toLocaleDateString('ko-KR')}</span>
                        </span>

                        {!item.isViewed && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              handleMarkAsRead(item.id);
                            }}
                            disabled={markingAsRead === item.id}
                            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500 text-white text-sm font-bold rounded-xl hover:bg-emerald-600 hover:shadow-lg hover:-translate-y-0.5 active:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:hover:translate-y-0 disabled:shadow-none disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
                          >
                            {markingAsRead === item.id ? (
                              <>
                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>처리 중...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                                <span>공지사항 확인 완료</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {announcements.length > 0 && totalPages > 1 && (
        <div className="mt-12 pt-8 flex flex-col items-center gap-4 border-t border-slate-100/50">
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            </button>

            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
                const pageNum = currentPage > 3 ? currentPage - 2 + idx : idx + 1;
                if (pageNum > totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`min-w-10 h-10 px-2 flex items-center justify-center text-sm font-bold rounded-xl transition-all duration-300 ${currentPage === pageNum
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-600'
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
