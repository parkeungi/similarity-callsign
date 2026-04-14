// 발생현황 필터 UI - 정렬(priority/risk/count/latest/ai_score)·상태·위험도·날짜범위 드롭다운, 부모에 onChange 콜백
'use client';

import React, { useEffect } from 'react';
import {
  DateRangeFilterState,
  PaginationState,
  SearchState,
  ExportConfig
} from '@/types/airline';

type ActionStatusFilter = 'all' | 'no_action' | 'in_progress' | 'completed' | 'redetected';
type SortOrder = 'risk' | 'count' | 'latest' | 'priority' | 'ai_score';

interface UploadBatchProps {
  availableYMs: string[];
  selectedYM: string;
  onYMChange: (ym: string) => void;
  repeatedCount: number;
  newCount: number;
}

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
  showAiRecommend?: boolean;
  onAiRecommendToggle?: () => void;
  uploadBatchActive?: boolean;
  viewMode?: 'batch' | 'date';
  onViewModeChange?: (mode: 'batch' | 'date') => void;
  uploadBatch?: UploadBatchProps;
  showExcel?: boolean;
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
  uploadBatchActive,
  viewMode = 'batch',
  onViewModeChange,
  uploadBatch,
  showExcel = true,
}: IncidentFiltersProps) {
  // Props에서 필요한 값들 추출
  const { startDate, endDate, activeRange, onStartDateChange, onEndDateChange, onApplyQuickRange } = dateFilter;
  const { limit: incidentsLimit, onLimitChange } = pagination;
  const { input: incidentsSearchInput, onChange: onSearchInputChange, onSubmit: onSearchSubmit } = search;
  const { isLoading: isExporting, onExport } = exportConfig;

  const showSort = Boolean(sortOrder && onSortOrderChange);
  const showStatusFilter = Boolean(actionStatusFilter && onActionStatusFilterChange);

  // 조회 모드: 월별 / 기간선택
  // uploadBatch prop이 전달된 경우 항상 토글 표시 (로딩 중 포함)
  const hasBatch = uploadBatch !== undefined;
  const isLoadingBatch = hasBatch && uploadBatch!.availableYMs.length === 0;

  // 최초 진입 시 최신 년월 자동 초기화
  useEffect(() => {
    const yms = uploadBatch?.availableYMs;
    if (!yms || yms.length === 0) return;
    if (!uploadBatch!.selectedYM) uploadBatch!.onYMChange(yms[0]);
  }, [uploadBatch?.availableYMs, uploadBatch?.selectedYM, uploadBatch?.onYMChange]);

  const handleViewModeChange = (mode: 'batch' | 'date') => {
    onViewModeChange?.(mode);
  };

  return (
    <div className="w-full border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
      <div className="flex w-full items-center gap-2">

        {/* 월별 / 기간선택 토글 */}
        {hasBatch && (
          <div className="flex h-9 rounded border border-gray-200 overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => handleViewModeChange('batch')}
              className={`px-3 text-xs font-semibold transition-colors ${viewMode === 'batch' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              월별
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('date')}
              className={`px-3 text-xs font-semibold transition-colors border-l border-gray-200 ${viewMode === 'date' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              기간선택
            </button>
          </div>
        )}

        {/* 월별 모드: 년월 선택 */}
        {viewMode === 'batch' && hasBatch && (
          <>
            <select
              value={uploadBatch!.selectedYM}
              onChange={(e) => uploadBatch!.onYMChange(e.target.value)}
              disabled={isLoadingBatch}
              className="h-9 border border-gray-200 bg-white px-2.5 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-400 rounded shrink-0 disabled:opacity-50"
            >
              {isLoadingBatch
                ? <option value="">로딩 중...</option>
                : <>
                    {!uploadBatch!.selectedYM && <option value="" disabled>년월 선택</option>}
                    {uploadBatch!.availableYMs.map((ym) => (
                      <option key={ym} value={ym}>{`${ym.slice(0, 4)}년 ${parseInt(ym.slice(5, 7), 10)}월`}</option>
                    ))}
                  </>
              }
            </select>
            {!isLoadingBatch && uploadBatch!.selectedYM && (
              <span className="text-xs text-indigo-500 shrink-0">
                신규 <strong>{uploadBatch!.newCount}</strong>건 · 이전 <strong>{uploadBatch!.repeatedCount}</strong>건
              </span>
            )}
          </>
        )}

        {/* 기간선택 모드: 날짜 범위 */}
        {viewMode === 'date' && (
          <div className="flex items-center gap-1 border border-gray-200 bg-white px-2 h-9 shrink-0">
            <input
              type="date"
              value={startDate}
              onChange={onStartDateChange}
              className="w-[105px] border-none bg-transparent p-0 text-xs font-semibold text-gray-900 outline-none focus:ring-0"
            />
            <span className="text-xs text-gray-300">~</span>
            <input
              type="date"
              value={endDate}
              onChange={onEndDateChange}
              className="w-[105px] border-none bg-transparent p-0 text-xs font-semibold text-gray-900 outline-none focus:ring-0"
            />
          </div>
        )}

        {/* 상태 필터 */}
        {showStatusFilter && (
          <select
            value={actionStatusFilter}
            onChange={(e) => onActionStatusFilterChange?.(e.target.value as ActionStatusFilter)}
            className="h-9 border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none shrink-0"
          >
            <option value="all">전체</option>
            <option value="in_progress">조치필요</option>
            <option value="completed">조치완료</option>
            <option value="redetected">재검출(미확인)</option>
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
            {/* <option value="risk">오류가능성순</option> */}
          </select>
        )}

        {/* LIMIT */}
        <select
          value={incidentsLimit}
          onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
          className="h-9 border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none shrink-0"
        >
          <option value="10">10건</option>
          <option value="20">20건</option>
          <option value="30">30건</option>
          <option value="50">50건</option>
        </select>

        <div className="flex-1" />

        {/* 엑셀 */}
        {showExcel && (
          <button
            type="button"
            onClick={onExport}
            disabled={isExporting || allFilteredIncidentsCount === 0}
            className={`h-7 px-2.5 text-[11px] font-bold shrink-0 transition-colors rounded ${
              isExporting || allFilteredIncidentsCount === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isExporting ? '...' : 'EXCEL'}
          </button>
        )}

      </div>
    </div>
  );
}
