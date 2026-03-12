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
          (action.callsign_pair || action.callsign?.callsign_pair)?.toLowerCase().includes(q) ||
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

      {/* 통계 - 가로 한줄 바 */}
      <div className="bg-white border border-gray-200 shadow-sm">
        <div className="flex divide-x divide-gray-100">
          {[
            { label: '전체', value: stats.total, color: '#6366f1' },
            { label: '조치완료', value: stats.completed, color: '#10b981' },
            { label: '조치필요', value: stats.pending + stats.inProgress, color: '#ef4444' },
            { label: '진행중', value: stats.inProgress, color: '#f97316' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="flex-1 px-5 py-3 hover:bg-gray-50 transition-all"
              style={{ borderLeft: `3px solid ${color}` }}
            >
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className="text-2xl font-black text-gray-900">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 필터 바 - 한 줄 */}
      <div className="w-full border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex w-full items-center gap-2">
          {/* 날짜 범위 */}
          <div className="flex items-center gap-1.5 border border-gray-200 bg-white px-3 h-9 shrink-0">
            <input
              type="date"
              value={startDate}
              onChange={onStartDateChange}
              className="w-[110px] border-none bg-transparent p-0 text-sm font-semibold text-gray-900 outline-none focus:ring-0"
            />
            <span className="text-sm text-gray-300">~</span>
            <input
              type="date"
              value={endDate}
              onChange={onEndDateChange}
              className="w-[110px] border-none bg-transparent p-0 text-sm font-semibold text-gray-900 outline-none focus:ring-0"
            />
          </div>

          {/* 빠른 기간 */}
          <div className="flex h-9 overflow-hidden border border-gray-200 shrink-0">
            {(['today', '1w', '2w', '1m'] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => onApplyQuickRange(range)}
                className={`px-3 text-[13px] font-bold transition-colors ${
                  activeRange === range ? 'bg-[#0f1b40] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                } ${range !== '1m' ? 'border-r border-gray-200' : ''}`}
              >
                {range === 'today' ? '오늘' : range === '1w' ? '1주' : range === '2w' ? '2주' : '1개월'}
              </button>
            ))}
          </div>

          {/* 상태 필터 */}
          <select
            value={actionStatusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as 'all' | 'pending' | 'in_progress' | 'completed')}
            className="h-9 border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none shrink-0"
          >
            <option value="all">전체</option>
            <option value="pending">미조치</option>
            <option value="in_progress">진행중</option>
            <option value="completed">완료</option>
          </select>

          {/* LIMIT */}
          <select
            value={actionLimit}
            onChange={(e) => { onLimitChange(Number(e.target.value)); onPageChange(1); }}
            className="h-9 border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none shrink-0"
          >
            <option value={9}>9건</option>
            <option value={18}>18건</option>
            <option value={27}>27건</option>
            <option value={54}>54건</option>
          </select>

          {/* 검색 */}
          <div className="relative flex-1 group">
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={actionSearchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="호출부호, 조치유형 검색..."
              className="w-full h-9 border border-gray-200 pl-9 pr-4 text-sm font-semibold text-gray-900 outline-none transition focus:border-[#0f1b40]"
            />
          </div>

          {/* 엑셀 */}
          <button
            onClick={onExport}
            className="h-9 px-4 text-[13px] font-bold bg-green-600 text-white hover:bg-green-700 shrink-0 transition-colors"
          >
            EXCEL
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
                    className={`bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-all border-2 ${
                      action.status === 'completed' ? 'border-blue-200' : 'border-red-400'
                    }`}
                  >
                    {/* 헤더: 호출부호 + 버튼 */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const pair = action.callsign_pair || action.callsign?.callsign_pair;
                          const parts = pair?.split(' | ') || [];
                          return (
                            <>
                              <span className="font-mono font-bold text-sm text-blue-600">
                                {parts[0] || pair || '-'}
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
              <div className="py-6 flex items-center justify-center gap-1">
                <button onClick={() => onPageChange(1)} disabled={actionPage === 1}
                  className="w-9 h-9 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 disabled:text-gray-200 transition-all">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 3h1.5v10H3V3zm3.5 5L12 3v10L6.5 8z"/></svg>
                </button>
                <button onClick={() => onPageChange(Math.max(1, actionPage - 1))} disabled={actionPage === 1}
                  className="w-9 h-9 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 disabled:text-gray-200 transition-all">
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><path d="M8.5 1L1.5 7l7 6"/></svg>
                </button>
                {(() => {
                  const half = 2;
                  let start = Math.max(1, actionPage - half);
                  let end = Math.min(totalPages, start + 4);
                  if (end - start < 4) start = Math.max(1, end - 4);
                  return Array.from({ length: end - start + 1 }, (_, i) => start + i).map((p) => (
                    <button key={p} onClick={() => onPageChange(p)}
                      className={`w-9 h-9 flex items-center justify-center rounded text-sm font-bold transition-all ${
                        p === actionPage ? 'bg-[#0A2C5A] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
                      }`}>
                      {p}
                    </button>
                  ));
                })()}
                <button onClick={() => onPageChange(Math.min(totalPages, actionPage + 1))} disabled={actionPage >= totalPages}
                  className="w-9 h-9 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 disabled:text-gray-200 transition-all">
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><path d="M1.5 1l7 6-7 6"/></svg>
                </button>
                <button onClick={() => onPageChange(totalPages)} disabled={actionPage === totalPages}
                  className="w-9 h-9 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 disabled:text-gray-200 transition-all">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13 3h-1.5v10H13V3zM9.5 8L4 3v10l5.5-5z"/></svg>
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
