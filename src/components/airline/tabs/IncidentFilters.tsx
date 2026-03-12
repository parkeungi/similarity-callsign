'use client';

import React from 'react';
import {
  DateRangeFilterState,
  PaginationState,
  SearchState,
  ExportConfig
} from '@/types/airline';

type ActionStatusFilter = 'all' | 'no_action' | 'in_progress' | 'completed';
type SortOrder = 'risk' | 'count' | 'latest' | 'priority' | 'ai_score';

interface IncidentFiltersProps {
  dateFilter: DateRangeFilterState & {
    onStartDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onEndDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onApplyQuickRange: (type: 'today' | '1w' | '2w' | '1m') => void;
  };
  pagination: PaginationState;
  search: SearchState;
  exportConfig: ExportConfig;
  allFilteredIncidentsCount: number;
  actionStatusFilter?: ActionStatusFilter;
  sortOrder?: SortOrder;
  onSortOrderChange?: (order: SortOrder) => void;
  onActionStatusFilterChange?: (filter: ActionStatusFilter) => void;
  // AI 추천 토글
  showAiRecommend?: boolean;
  onAiRecommendToggle?: () => void;
}

export function IncidentFilters({
  dateFilter,
  pagination,
  search,
  exportConfig,
  allFilteredIncidentsCount,
  actionStatusFilter,
  sortOrder,
  onSortOrderChange,
  onActionStatusFilterChange,
  showAiRecommend,
  onAiRecommendToggle,
}: IncidentFiltersProps) {
  // Props에서 필요한 값들 추출
  const { startDate, endDate, activeRange, onStartDateChange, onEndDateChange, onApplyQuickRange } = dateFilter;
  const { limit: incidentsLimit, onLimitChange } = pagination;
  const { input: incidentsSearchInput, onChange: onSearchInputChange, onSubmit: onSearchSubmit } = search;
  const { isLoading: isExporting, onExport } = exportConfig;

  const showSort = Boolean(sortOrder && onSortOrderChange);
  const showStatusFilter = Boolean(actionStatusFilter && onActionStatusFilterChange);

  return (
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

        {/* 빠른 기간 선택 */}
        <div className="flex h-9 overflow-hidden border border-gray-200 shrink-0">
          {(['today', '1w', '2w', '1m'] as const).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => onApplyQuickRange(range)}
              className={`px-3 text-[13px] font-bold transition-colors ${
                activeRange === range
                  ? 'bg-[#0f1b40] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              } ${range !== '1m' ? 'border-r border-gray-200' : ''}`}
            >
              {range === 'today' ? '오늘' : range === '1w' ? '1주' : range === '2w' ? '2주' : '1개월'}
            </button>
          ))}
        </div>

        {/* 상태 필터 */}
        {showStatusFilter && (
          <select
            value={actionStatusFilter}
            onChange={(e) => onActionStatusFilterChange?.(e.target.value as ActionStatusFilter)}
            className="h-9 border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none shrink-0"
          >
            <option value="all">전체</option>
            <option value="in_progress">진행중</option>
            <option value="completed">조치완료</option>
          </select>
        )}

        {/* 정렬 */}
        {showSort && (
          <select
            value={sortOrder}
            onChange={(e) => onSortOrderChange?.(e.target.value as SortOrder)}
            className="h-9 border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none shrink-0"
          >
            <option value="priority">우선순위순</option>
            <option value="ai_score">AI분석순</option>
            <option value="latest">최신순</option>
            <option value="count">발생건수순</option>
            <option value="risk">오류가능성순</option>
          </select>
        )}

        {/* AI 추천 토글 버튼 */}
        {onAiRecommendToggle && (
          <button
            type="button"
            onClick={onAiRecommendToggle}
            className={`h-9 px-3 text-[13px] font-bold shrink-0 transition-colors border ${
              showAiRecommend
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-purple-600 border-purple-300 hover:bg-purple-50'
            }`}
          >
            🤖 AI 추천
          </button>
        )}

        {/* LIMIT */}
        <select
          value={incidentsLimit}
          onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
          className="h-9 border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none shrink-0"
        >
          <option value="9">9건</option>
          <option value="18">18건</option>
          <option value="27">27건</option>
          <option value="54">54건</option>
        </select>

        {/* 검색 입력창 */}
        <div className="relative flex-1 group">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="항공사명 또는 편명(호출부호)을 입력하여 검색하세요"
            value={incidentsSearchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSearchSubmit(); }}
            className="w-full h-9 border border-gray-200 pl-9 pr-4 text-sm font-semibold text-gray-900 outline-none transition focus:border-[#0f1b40]"
          />
        </div>

        {/* 엑셀 */}
        <button
          type="button"
          onClick={onExport}
          disabled={isExporting || allFilteredIncidentsCount === 0}
          className={`h-9 px-4 text-[13px] font-bold shrink-0 transition-colors ${
            isExporting || allFilteredIncidentsCount === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {isExporting ? '추출 중...' : 'EXCEL'}
        </button>

      </div>
    </div>
  );
}
