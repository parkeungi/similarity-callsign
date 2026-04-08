// 발생현황 필터 UI - 정렬(priority/risk/count/latest/ai_score)·상태·위험도·날짜범위 드롭다운, 부모에 onChange 콜백
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  DateRangeFilterState,
  PaginationState,
  SearchState,
  ExportConfig
} from '@/types/airline';

type ActionStatusFilter = 'all' | 'no_action' | 'in_progress' | 'completed' | 'redetected';
type SortOrder = 'risk' | 'count' | 'latest' | 'priority' | 'ai_score';

interface UploadBatchProps {
  uploads: { id: string; uploaded_at: string; file_name: string; success_count: number }[];
  selectedId: string;
  onChange: (id: string) => void;
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

  // 조회 모드: 엑셀기준 / 기간선택
  const hasBatch = !!(uploadBatch && uploadBatch.uploads.length > 0);
  const [viewMode, setViewMode] = useState<'batch' | 'date'>('batch');

  // 년월 합산 필터 상태 ("YYYY-MM")
  const [selectedYM, setSelectedYM] = useState<string>('');

  const availableYMs = useMemo(() => {
    const uploads = uploadBatch?.uploads ?? [];
    return [...new Set(uploads.map(u => u.uploaded_at.slice(0, 7)))]
      .sort((a, b) => b.localeCompare(a));
  }, [uploadBatch?.uploads]);

  const filteredUploads = useMemo(() => {
    const uploads = uploadBatch?.uploads ?? [];
    if (!selectedYM) return uploads;
    return uploads.filter(u => u.uploaded_at.startsWith(selectedYM));
  }, [uploadBatch?.uploads, selectedYM]);

  // 최초 진입 시 최신 년월 자동 초기화
  useEffect(() => {
    const uploads = uploadBatch?.uploads;
    if (!uploads || uploads.length === 0) return;
    if (!selectedYM) setSelectedYM(uploads[0].uploaded_at.slice(0, 7));
  }, [uploadBatch?.uploads]);

  // 엑셀기준 모드에서 년월 변경 시 최신 업로드 자동 선택
  const firstFilteredUploadId = filteredUploads[0]?.id ?? '';
  useEffect(() => {
    if (viewMode !== 'batch') return;
    if (!uploadBatch || !firstFilteredUploadId) return;
    uploadBatch.onChange(firstFilteredUploadId);
  }, [firstFilteredUploadId, viewMode]);

  const handleViewModeChange = (mode: 'batch' | 'date') => {
    setViewMode(mode);
    if (mode === 'date' && uploadBatch) {
      uploadBatch.onChange(''); // 배치 해제 → uploadBatchActive = false
    }
    // 'batch'로 전환 시: 위 useEffect가 자동 선택
  };

  return (
    <div className="w-full border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
      <div className="flex w-full items-center gap-2">

        {/* 엑셀기준 / 기간선택 토글 */}
        {hasBatch && (
          <div className="flex h-9 rounded border border-gray-200 overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => handleViewModeChange('batch')}
              className={`px-3 text-xs font-semibold transition-colors ${viewMode === 'batch' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              엑셀기준
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

        {/* 엑셀기준 모드: 년월 + 업로드 선택 */}
        {viewMode === 'batch' && hasBatch && (
          <>
            <select
              value={selectedYM}
              onChange={(e) => setSelectedYM(e.target.value)}
              className="h-9 border border-gray-200 bg-white px-2.5 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-400 rounded shrink-0"
            >
              {availableYMs.length === 0 && <option value="">--</option>}
              {availableYMs.map(ym => (
                <option key={ym} value={ym}>{ym.slice(2, 4) + ym.slice(5, 7)}</option>
              ))}
            </select>
            <select
              value={uploadBatch!.selectedId}
              onChange={(e) => uploadBatch!.onChange(e.target.value)}
              className="h-9 border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 outline-none focus:ring-2 focus:ring-indigo-400 rounded shrink-0 min-w-[190px]"
            >
              {filteredUploads.map((u) => (
                <option key={u.id} value={u.id}>{u.uploaded_at.slice(5, 10)} — {u.file_name} ({u.success_count}건)</option>
              ))}
            </select>
            {uploadBatch!.selectedId && (
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
