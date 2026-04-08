// 관리자 조치 필터 - 상태(pending/in_progress/completed)·항공사·날짜범위 드롭다운, onChange 콜백
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Airline } from '@/hooks/useAirlines';
import { FileUploadItem } from '@/hooks/useFileUploads';

type ActionStatus = '' | 'pending' | 'in_progress' | 'completed';

interface AdminActionsFiltersProps {
  airlines: Airline[];
  airlinesLoading: boolean;
  selectedAirlineId: string;
  selectedStatus: ActionStatus;
  dateFrom: string;
  dateTo: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onAirlineChange: (value: string) => void;
  onStatusChange: (value: ActionStatus) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onReset: () => void;
  onOpenCreate: () => void;
  onExport: () => void;
  canCreate: boolean;
  canExport: boolean;
  summary?: {
    total: number;
    selectedStatusLabel?: string;
    filteredCount?: number;
  };
  // 업로드 배치 선택
  fileUploads?: FileUploadItem[];
  fileUploadsLoading?: boolean;
  selectedFileUploadId?: string;
  onFileUploadChange?: (id: string) => void;
  viewMode?: 'batch' | 'date';
  onViewModeChange?: (mode: 'batch' | 'date') => void;
}

export function AdminActionsFilters({
  airlines,
  airlinesLoading,
  selectedAirlineId,
  selectedStatus,
  dateFrom,
  dateTo,
  searchQuery,
  onSearchChange,
  onAirlineChange,
  onStatusChange,
  onDateFromChange,
  onDateToChange,
  onReset,
  onOpenCreate,
  onExport,
  canCreate,
  canExport,
  summary,
  fileUploads,
  fileUploadsLoading,
  selectedFileUploadId,
  onFileUploadChange,
  viewMode: viewModeProp = 'batch',
  onViewModeChange,
}: AdminActionsFiltersProps) {
  const hasBatch = !!(fileUploads && fileUploads.length > 0);

  // 년월 합산 필터
  const [selectedYM, setSelectedYM] = useState<string>('');

  const availableYMs = useMemo(() => {
    const uploads = fileUploads ?? [];
    return [...new Set(uploads.map(u => u.uploaded_at.slice(0, 7)))]
      .sort((a, b) => b.localeCompare(a));
  }, [fileUploads]);

  const filteredUploads = useMemo(() => {
    const uploads = fileUploads ?? [];
    if (!selectedYM) return uploads;
    return uploads.filter(u => u.uploaded_at.startsWith(selectedYM));
  }, [fileUploads, selectedYM]);

  // 최초 진입 시 최신 년월 자동 초기화
  useEffect(() => {
    if (!fileUploads || fileUploads.length === 0) return;
    if (!selectedYM) setSelectedYM(fileUploads[0].uploaded_at.slice(0, 7));
  }, [fileUploads]);

  // 엑셀기준 모드에서 년월 변경 시 최신 업로드 자동 선택
  const firstFilteredUploadId = filteredUploads[0]?.id ?? '';
  useEffect(() => {
    if (viewModeProp !== 'batch') return;
    if (!firstFilteredUploadId) return;
    onFileUploadChange?.(firstFilteredUploadId);
  }, [firstFilteredUploadId, viewModeProp]);

  const handleViewModeChange = (mode: 'batch' | 'date') => {
    onViewModeChange?.(mode);
    if (mode === 'date') onFileUploadChange?.('');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      {/* 필터 1줄: 토글 + 엑셀/기간 컨트롤 + 항공사 + 상태 + 초기화 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* 엑셀기준 / 기간선택 토글 */}
        {hasBatch && (
          <div className="flex h-9 rounded border border-gray-200 overflow-hidden shrink-0">
            <button type="button" onClick={() => handleViewModeChange('batch')}
              className={`px-3 text-xs font-semibold transition-colors ${viewModeProp === 'batch' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              엑셀기준
            </button>
            <button type="button" onClick={() => handleViewModeChange('date')}
              className={`px-3 text-xs font-semibold transition-colors border-l border-gray-200 ${viewModeProp === 'date' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              기간선택
            </button>
          </div>
        )}

        {/* 엑셀기준 모드: 년월 + 업로드 선택 */}
        {viewModeProp === 'batch' && hasBatch && (
          <>
            <select value={selectedYM} onChange={(e) => setSelectedYM(e.target.value)}
              disabled={fileUploadsLoading}
              className="h-9 px-2.5 border border-gray-200 bg-white text-sm font-semibold text-gray-700 rounded outline-none focus:ring-2 focus:ring-indigo-400 shrink-0 disabled:bg-gray-100">
              {availableYMs.length === 0 && <option value="">--</option>}
              {availableYMs.map(ym => (
                <option key={ym} value={ym}>{`${ym.slice(0, 4)}년 ${parseInt(ym.slice(5, 7))}월`}</option>
              ))}
            </select>
            <select value={selectedFileUploadId || ''} onChange={(e) => onFileUploadChange?.(e.target.value)}
              disabled={fileUploadsLoading}
              className="h-9 px-3 border border-gray-200 bg-white text-sm font-medium text-gray-800 rounded outline-none focus:ring-2 focus:ring-indigo-400 min-w-[200px] shrink-0 disabled:bg-gray-100">
              {filteredUploads.map((u) => (
                <option key={u.id} value={u.id}>{u.uploaded_at.slice(5, 10)} — {u.file_name} ({u.success_count}건)</option>
              ))}
            </select>
          </>
        )}

        {/* 기간선택 모드: 날짜 범위 */}
        {viewModeProp === 'date' && (
          <>
            <input type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)}
              className="h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-gray-400 text-sm">~</span>
            <input type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)}
              className="h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </>
        )}

        <div className="w-px h-5 bg-gray-200 shrink-0" />

        {/* 항공사 */}
        <select value={selectedAirlineId} onChange={(e) => onAirlineChange(e.target.value)}
          disabled={airlinesLoading}
          className="h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed">
          <option value="">모든 항공사</option>
          {airlines.map((airline) => (
            <option key={airline.id} value={airline.id}>{airline.code} - {airline.name_ko}</option>
          ))}
        </select>

        {/* 상태 */}
        <select value={selectedStatus} onChange={(e) => onStatusChange(e.target.value as ActionStatus)}
          className="h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">전체</option>
          <option value="in_progress">조치필요</option>
          <option value="completed">조치완료</option>
        </select>

        <button onClick={onReset}
          className="h-9 px-4 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium text-sm">
          초기화
        </button>
      </div>

      <div className="flex gap-2 items-center">
        <button
          onClick={onOpenCreate}
          disabled={!canCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          조치 등록
        </button>
        <div className="flex-1" />
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="호출부호, 조치유형, 담당자 검색"
            className="h-9 w-[240px] border border-gray-300 rounded-lg bg-white pl-9 pr-8 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={onExport}
          disabled={!canExport}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          Excel 내보내기
        </button>
      </div>

      {summary && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            발생건수: <span className="font-semibold">{summary.total}</span>건
            {summary.selectedStatusLabel && ' / '}
            {summary.selectedStatusLabel && (
              <>
                {summary.selectedStatusLabel}: <span className="font-semibold">{summary.filteredCount ?? 0}건</span>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
