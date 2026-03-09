'use client';

import React, { useMemo, useCallback } from 'react';
import { Action, ActionListResponse } from '@/types/action';

interface AirlineActionHistoryTabProps {
  actionsData: ActionListResponse | undefined;
  actionsLoading: boolean;
  actionPage: number;
  actionLimit: number;
  actionSearchInput: string;
  actionStatusFilter: 'all' | 'pending' | 'in_progress' | 'completed';
  startDate: string;
  endDate: string;
  activeRange: 'today' | '1w' | '2w' | '1m' | '';
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: () => void;
  onStatusFilterChange: (status: 'all' | 'pending' | 'in_progress' | 'completed') => void;
  onActionClick: (action: Action) => void;
  onStartDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEndDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onApplyQuickRange: (type: 'today' | '1w' | '2w' | '1m') => void;
  onExport: () => void;
}

export function AirlineActionHistoryTab({
  actionsData,
  actionsLoading,
  actionPage,
  actionLimit,
  actionSearchInput,
  actionStatusFilter,
  startDate,
  endDate,
  activeRange,
  onPageChange,
  onLimitChange,
  onSearchInputChange,
  onSearchSubmit,
  onStatusFilterChange,
  onActionClick,
  onStartDateChange,
  onEndDateChange,
  onApplyQuickRange,
  onExport,
}: AirlineActionHistoryTabProps) {
  // 필터링된 데이터
  const filteredActions = useMemo(() => {
    if (!actionsData?.data) return [];

    let filtered = actionsData.data;

    // 상태 필터
    if (actionStatusFilter !== 'all') {
      filtered = filtered.filter((action) => action.status === actionStatusFilter);
    }

    // 검색어 필터 (호출부호 또는 조치유형)
    if (actionSearchInput.trim()) {
      const q = actionSearchInput.trim().toLowerCase();
      filtered = filtered.filter(
        (action) =>
          action.callsign_pair?.toLowerCase().includes(q) ||
          action.action_type?.toLowerCase().includes(q) ||
          action.description?.toLowerCase().includes(q)
      );
    }

    // 최신순 정렬
    return filtered.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.registered_at || '').getTime();
      const dateB = new Date(b.updated_at || b.registered_at || '').getTime();
      return dateB - dateA;
    });
  }, [actionsData, actionStatusFilter, actionSearchInput]);

  // 페이징
  const totalPages = Math.max(1, Math.ceil(filteredActions.length / actionLimit));
  const pagedActions = useMemo(() => {
    const start = (actionPage - 1) * actionLimit;
    return filteredActions.slice(start, start + actionLimit);
  }, [filteredActions, actionPage, actionLimit]);

  // 통계
  const stats = useMemo(() => {
    if (!actionsData?.data) return { total: 0, pending: 0, inProgress: 0, completed: 0 };

    const actions = actionsData.data;
    return {
      total: actions.length,
      pending: actions.filter((a) => a.status === 'pending').length,
      inProgress: actions.filter((a) => a.status === 'in_progress').length,
      completed: actions.filter((a) => a.status === 'completed').length,
    };
  }, [actionsData]);

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending':
        return '미조치';
      case 'in_progress':
        return '진행중';
      case 'completed':
        return '완료';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'bg-amber-50 text-amber-600 border-amber-300';
      case 'in_progress':
        return 'bg-rose-50 text-rose-600 border-rose-300';
      case 'completed':
        return 'bg-emerald-50 text-emerald-600 border-emerald-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getCardBorderColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return '#16a34a'; // 초록
      case 'in_progress':
        return '#dc2626'; // 빨강
      case 'pending':
        return '#f59e0b'; // 주황
      default:
        return '#d1d5db'; // 회색
    }
  };

  const getButtonConfig = (status: string): { label: string; bgColor: string } => {
    if (status === 'completed') {
      return { label: '조치완료', bgColor: 'bg-emerald-600 hover:bg-emerald-700' };
    }
    return { label: '조치등록', bgColor: 'bg-blue-600 hover:bg-blue-700' };
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        onSearchSubmit();
      }
    },
    [onSearchSubmit]
  );

  // 발생이력 파싱 헬퍼 함수
  const parseOccurrenceDates = (occurrenceDates: string | undefined): string[] => {
    if (!occurrenceDates) return [];
    return occurrenceDates.split(',').filter((d) => d.trim());
  };

  // 발생이력 시간 포맷팅
  const formatOccurrenceTime = (str: string): string => {
    // API가 이미 'MM-DD HH:MM' 형태로 반환하면 그대로 사용
    if (/^\d{2}-\d{2}/.test(str.trim())) return str.trim();
    try {
      const d = new Date(str);
      if (isNaN(d.getTime())) return str;
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${mm}-${dd} ${hh}:${mi}`;
    } catch {
      return str;
    }
  };

  return (
    <div className="space-y-6">
      {/* 통계 카드 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-gray-600 mb-4 uppercase tracking-widest">
          📋 조치이력 요약
        </h3>

        <div className="grid grid-cols-4 gap-3">
          {/* 전체 */}
          <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50 cursor-pointer hover:shadow-md transition-shadow">
            <div className="text-xs font-bold text-blue-600 uppercase mb-2">전체</div>
            <div className="text-2xl font-black text-blue-700">{stats.total}</div>
          </div>

          {/* 미조치 */}
          <div className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50 cursor-pointer hover:shadow-md transition-shadow">
            <div className="text-xs font-bold text-orange-600 uppercase mb-2">미조치</div>
            <div className="text-2xl font-black text-orange-700">{stats.pending}</div>
          </div>

          {/* 진행중 */}
          <div className="border-2 border-rose-200 rounded-lg p-4 bg-rose-50 cursor-pointer hover:shadow-md transition-shadow">
            <div className="text-xs font-bold text-rose-600 uppercase mb-2">진행중</div>
            <div className="text-2xl font-black text-rose-700">{stats.inProgress}</div>
          </div>

          {/* 완료 */}
          <div className="border-2 border-emerald-200 rounded-lg p-4 bg-emerald-50 cursor-pointer hover:shadow-md transition-shadow">
            <div className="text-xs font-bold text-emerald-600 uppercase mb-2">완료</div>
            <div className="text-2xl font-black text-emerald-700">{stats.completed}</div>
          </div>
        </div>
      </div>

      {/* 날짜 및 필터 바 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        {/* 첫 줄: 날짜 + 퀵 버튼 + LIMIT + 다운로드 */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* 날짜 범위 */}
          <div className="bg-gray-50 border border-gray-300 rounded-none px-3 py-2 flex items-center gap-2 hover:border-blue-400 transition-colors">
            <input
              type="date"
              value={startDate}
              onChange={onStartDateChange}
              className="bg-transparent border-none p-0 text-sm font-bold text-gray-900 focus:ring-0 cursor-pointer outline-none"
            />
            <span className="text-gray-300 font-bold mx-1">~</span>
            <input
              type="date"
              value={endDate}
              onChange={onEndDateChange}
              className="bg-transparent border-none p-0 text-sm font-bold text-gray-900 focus:ring-0 cursor-pointer outline-none"
            />
          </div>

          {/* Quick Range 버튼들 */}
          <div className="flex rounded-none border border-gray-200 overflow-hidden h-full">
            {(['today', '1w', '2w', '1m'] as const).map((range) => {
              const labels: Record<typeof range, string> = {
                'today': '오늘',
                '1w': '1주',
                '2w': '2주',
                '1m': '1개월',
              };
              return (
                <button
                  key={range}
                  type="button"
                  onClick={() => onApplyQuickRange(range)}
                  className={`px-4 py-2.5 text-[13px] font-black tracking-tight transition-all border-r border-gray-200 last:border-r-0 ${
                    activeRange === range
                      ? 'bg-[#00205b] text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {labels[range]}
                </button>
              );
            })}
          </div>

          {/* LIMIT 드롭다운 */}
          <select
            value={actionLimit}
            onChange={(e) => {
              onLimitChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-none bg-white text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
          >
            <option value={10}>LIMIT 10건</option>
            <option value={20}>LIMIT 20건</option>
            <option value={50}>LIMIT 50건</option>
            <option value={100}>LIMIT 100건</option>
          </select>

          {/* 엑셀 다운로드 */}
          <button
            onClick={onExport}
            className="ml-auto px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-none hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            ⬇ 엑셀 다운로드
          </button>
        </div>

        {/* 두 번째 줄: 검색 + 상태 필터 + 검색 버튼 */}
        <div className="flex flex-col md:flex-row gap-3 items-center">
          {/* 검색 입력 */}
          <div className="flex-1 relative group">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={actionSearchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="호출부호, 조치유형 검색..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* 상태 필터 */}
          <select
            value={actionStatusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as 'all' | 'pending' | 'in_progress' | 'completed')}
            className="px-4 py-2 border border-gray-300 rounded-none bg-white text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
          >
            <option value="all">모든 상태</option>
            <option value="pending">미조치</option>
            <option value="in_progress">진행중</option>
            <option value="completed">완료</option>
          </select>

          {/* 검색 버튼 */}
          <button
            onClick={onSearchSubmit}
            className="px-6 py-2 bg-[#00205b] text-white text-sm font-black rounded-none hover:bg-[#001540] transition-colors"
          >
            SEARCH
          </button>
        </div>
      </div>

      {/* 조치이력 카드 그리드 */}
      <div className="space-y-4">
        <div className="text-sm font-bold text-gray-600 flex items-center justify-between">
          <span>📋 조치이력 ({filteredActions.length}건)</span>
          <span className="text-xs text-gray-500">{actionPage} / {totalPages} 페이지</span>
        </div>

        {actionsLoading ? (
          <div className="bg-white rounded-lg p-12 text-center text-gray-500">
            <p className="text-sm">데이터를 불러오는 중입니다...</p>
          </div>
        ) : pagedActions.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-4">
              {pagedActions.map((action, idx) => {
                const buttonConfig = getButtonConfig(action.status);
                const occurrenceDates = parseOccurrenceDates(action.occurrence_dates);

                return (
                  <div
                    key={`${action.id}-${idx}`}
                    className="bg-white border-l-4 rounded-lg p-4 shadow-sm hover:shadow-md transition-all"
                    style={{ borderLeftColor: getCardBorderColor(action.status) }}
                  >
                    {/* 헤더: 호출부호 + 버튼 */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const parts = action.callsign_pair?.split(' | ') || [];
                          return (
                            <>
                              <span className="font-mono font-bold text-sm text-blue-600">
                                {parts[0] || action.callsign_pair || '-'}
                              </span>
                              <span className="text-gray-400 text-xs">↔</span>
                              <span className="font-mono font-bold text-sm text-red-600">
                                {parts[1] || ''}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                      <button
                        onClick={() => onActionClick(action)}
                        className={`px-2 py-1 text-white text-xs font-bold rounded transition-colors whitespace-nowrap ${buttonConfig.bgColor}`}
                      >
                        {buttonConfig.label}
                      </button>
                    </div>

                    {/* 정보 테이블 - 발생현황과 동일 */}
                    <div className="grid grid-cols-4 gap-2 text-xs mb-3 pb-3 border-b border-gray-200">
                      <div>
                        <div className="text-gray-500 font-semibold mb-1">발생건수</div>
                        <div className="font-bold text-gray-900">{action.callsign?.occurrence_count || 0}건</div>
                      </div>
                      <div>
                        <div className="text-gray-500 font-semibold mb-1">최근발생일</div>
                        <div className="font-bold text-gray-900">
                          {action.callsign?.last_occurred_at
                            ? new Date(action.callsign.last_occurred_at).toLocaleDateString('ko-KR', {
                                month: '2-digit',
                                day: '2-digit',
                              })
                            : '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 font-semibold mb-1">오류유형</div>
                        <div className="font-bold text-gray-900 text-xs">
                          {action.callsign?.error_type || '-'}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500 font-semibold mb-1">위험도</div>
                        <span className={`inline-block px-1 py-0.5 rounded text-xs font-bold border ${
                          action.callsign?.risk_level === '매우높음' ? 'bg-rose-100 text-rose-700 border-rose-300' :
                          action.callsign?.risk_level === '높음' ? 'bg-orange-100 text-orange-700 border-orange-300' :
                          action.callsign?.risk_level === '중간' ? 'bg-amber-100 text-amber-700 border-amber-300' :
                          'bg-emerald-100 text-emerald-700 border-emerald-300'
                        }`}>
                          {action.callsign?.risk_level === '매우높음' ? '매우높음' :
                           action.callsign?.risk_level === '높음' ? '높음' :
                           action.callsign?.risk_level === '중간' ? '중간' :
                           action.callsign?.risk_level === '낮음' ? '낮음' : '-'}
                        </span>
                      </div>
                    </div>

                    {/* 오류유형 섹션 (동적) */}
                    {action.error_type_counts && Object.keys(action.error_type_counts).length > 0 && (() => {
                      const BADGE_COLORS = [
                        'bg-rose-100 text-rose-700',
                        'bg-orange-100 text-orange-700',
                        'bg-blue-100 text-blue-700',
                        'bg-violet-100 text-violet-700',
                        'bg-emerald-100 text-emerald-700',
                        'bg-gray-100 text-gray-700',
                      ];
                      return (
                        <div className="mb-3 pb-3 border-b border-gray-200">
                          <div className="text-xs font-semibold text-gray-500 mb-2">□오류유형</div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(action.error_type_counts)
                              .sort((a, b) => (b[1] as number) - (a[1] as number))
                              .map(([type, count], idx) => (
                                <span key={type} className={`text-xs px-2 py-1 rounded font-semibold ${BADGE_COLORS[idx % BADGE_COLORS.length]}`}>
                                  {type}({count as number}건)
                                </span>
                              ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* 발생이력 */}
                    {occurrenceDates.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 mb-1">📍 발생이력</div>
                        <div className="flex flex-wrap gap-1">
                          {occurrenceDates.slice(0, 4).map((date, i) => (
                            <span
                              key={i}
                              className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono"
                            >
                              {formatOccurrenceTime(date)}
                            </span>
                          ))}
                          {occurrenceDates.length > 4 && (
                            <span className="text-xs text-gray-500 px-1.5 py-0.5">
                              +{occurrenceDates.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-6">
                <button
                  onClick={() => onPageChange(Math.max(1, actionPage - 1))}
                  disabled={actionPage === 1}
                  className="px-3 py-1 text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:text-gray-300"
                >
                  이전
                </button>
                <span className="text-sm text-gray-600">
                  {actionPage} / {totalPages}
                </span>
                <button
                  onClick={() => onPageChange(Math.min(totalPages, actionPage + 1))}
                  disabled={actionPage === totalPages}
                  className="px-3 py-1 text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:text-gray-300"
                >
                  다음
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-lg p-12 text-center text-gray-500">
            <p className="text-sm">조치이력이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
