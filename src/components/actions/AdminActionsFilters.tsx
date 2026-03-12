// 관리자 조치 필터 - 상태(pending/in_progress/completed)·항공사·날짜범위 드롭다운, onChange 콜백
"use client";

import { Airline } from '@/hooks/useAirlines';

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
}: AdminActionsFiltersProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">항공사</label>
          <select
            value={selectedAirlineId}
            onChange={(e) => onAirlineChange(e.target.value)}
            disabled={airlinesLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">모든 항공사</option>
            {airlines.map((airline) => (
              <option key={airline.id} value={airline.id}>
                {airline.code} - {airline.name_ko}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">상태</label>
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value as ActionStatus)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">모든 상태</option>
            <option value="pending">대기중</option>
            <option value="in_progress">진행중</option>
            <option value="completed">완료</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">시작 날짜</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">종료 날짜</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-end">
          <button
            onClick={onReset}
            className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
          >
            초기화
          </button>
        </div>
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
            전체: <span className="font-semibold">{summary.total}</span>건
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
