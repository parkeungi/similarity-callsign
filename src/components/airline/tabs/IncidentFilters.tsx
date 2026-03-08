'use client';

import React from 'react';
import {
  DateRangeFilterState,
  PaginationState,
  SearchState,
  ExportConfig
} from '@/types/airline';

type ActionStatusFilter = 'all' | 'no_action' | 'in_progress' | 'completed';
type SortOrder = 'risk' | 'count' | 'latest' | 'priority';

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
}: IncidentFiltersProps) {
  // Props에서 필요한 값들 추출
  const { startDate, endDate, activeRange, onStartDateChange, onEndDateChange, onApplyQuickRange } = dateFilter;
  const { limit: incidentsLimit, onLimitChange } = pagination;
  const { input: incidentsSearchInput, onChange: onSearchInputChange, onSubmit: onSearchSubmit } = search;
  const { isLoading: isExporting, onExport } = exportConfig;

  const showSort = Boolean(sortOrder && onSortOrderChange);
  const showStatusFilter = Boolean(actionStatusFilter && onActionStatusFilterChange);

  return (
    <div className="w-full rounded-none border border-gray-200 bg-white px-5 py-4 shadow-sm space-y-3">
      {/* 첫 번째 행: 조회기간 + 빠른 선택 + 조회 */}
      <div className="flex w-full items-center gap-3">
        <div className="flex items-center gap-3 rounded-none border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <input
            type="date"
            value={startDate}
            onChange={onStartDateChange}
            className="w-[120px] border-none bg-transparent p-0 text-sm font-semibold text-gray-900 outline-none focus:ring-0"
          />
          <span className="text-sm font-bold text-gray-300">~</span>
          <input
            type="date"
            value={endDate}
            onChange={onEndDateChange}
            className="w-[120px] border-none bg-transparent p-0 text-sm font-semibold text-gray-900 outline-none focus:ring-0"
          />
        </div>

        <div className="flex h-10 overflow-hidden rounded-none border border-gray-200 shadow-sm">
          {(['today', '1w', '2w', '1m'] as const).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => onApplyQuickRange(range)}
              className={`px-4 text-[13px] font-black tracking-tight transition-colors ${
                activeRange === range
                  ? 'bg-[#0f1b40] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              } ${range !== '1m' ? 'border-r border-gray-200' : ''}`}
            >
              {range === 'today' ? '오늘' : range === '1w' ? '1주' : range === '2w' ? '2주' : '1개월'}
            </button>
          ))}
        </div>

        <button
          onClick={onSearchSubmit}
          className="h-10 rounded-none bg-[#0f1b40] px-6 text-[13px] font-black uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-[#0b142f]"
        >
          조회
        </button>
      </div>

      {/* 두 번째 행: 검색 + 정렬 + LIMIT + 상태 + 엑셀 (한 줄) */}
      <div className="flex w-full items-center gap-3">
        {/* 검색 입력창 */}
        <div className="relative flex-1 group">
          <div className="pointer-events-none absolute inset-y-0 left-5 flex items-center text-gray-400 group-focus-within:text-[#0f1b40]">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="항공사명 또는 편명(호출부호)을 입력하여 검색하세요"
            value={incidentsSearchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSearchSubmit();
            }}
            className="w-full rounded-none border border-gray-200 py-3 pl-14 pr-5 text-sm font-semibold text-gray-900 shadow-sm outline-none transition focus:border-[#0f1b40] focus:ring-2 focus:ring-[#0f1b40]/10"
          />
        </div>

        {/* 정렬 */}
        {showSort && (
          <div className="flex h-10 items-center gap-2 rounded-none border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">정렬</span>
            <select
              value={sortOrder}
              onChange={(e) => onSortOrderChange?.(e.target.value as SortOrder)}
              className="border-none bg-transparent text-sm font-semibold text-gray-800 outline-none"
            >
              <option value="priority">우선순위순 (위험도 → 유사도 → 발생)</option>
              <option value="latest">최신순</option>
              <option value="count">발생건수순</option>
              <option value="risk">오류가능성순</option>
            </select>
          </div>
        )}

        {/* LIMIT */}
        <div className="flex h-10 items-center gap-2 rounded-none border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">LIMIT</span>
          <select
            value={incidentsLimit}
            onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
            className="border-none bg-transparent text-sm font-semibold text-gray-800 outline-none"
          >
            <option value="10">10건</option>
            <option value="30">30건</option>
            <option value="50">50건</option>
            <option value="100">100건</option>
          </select>
        </div>

        {/* 상태 */}
        {showStatusFilter && (
          <div className="flex h-10 items-center gap-2 rounded-none border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">상태</span>
            <select
              value={actionStatusFilter}
              onChange={(e) => onActionStatusFilterChange?.(e.target.value as ActionStatusFilter)}
              className="border-none bg-transparent text-sm font-semibold text-gray-800 outline-none"
            >
              <option value="all">전체</option>
              <option value="in_progress">진행중</option>
              <option value="completed">조치완료</option>
            </select>
          </div>
        )}

        {/* 엑셀 다운로드 */}
        <button
          type="button"
          onClick={onExport}
          disabled={isExporting || allFilteredIncidentsCount === 0}
          className={`flex h-10 items-center gap-2 rounded-none border px-5 text-[13px] font-bold shadow-sm transition-colors ${
            isExporting || allFilteredIncidentsCount === 0
              ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
              : 'border-green-700 bg-green-700 text-white hover:bg-green-800'
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>{isExporting ? '추출 중...' : '엑셀 다운로드'}</span>
        </button>
      </div>
    </div>
  );
}
