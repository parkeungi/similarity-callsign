'use client';

import React from 'react';
import { DateRangeType } from '@/types/airline';

interface IncidentFiltersProps {
  startDate: string;
  endDate: string;
  activeRange: DateRangeType;
  isExporting: boolean;
  incidentsLimit: number;
  incidentsSearchInput: string;
  allFilteredIncidentsCount: number;
  actionStatusFilter: 'all' | 'no_action' | 'in_progress' | 'completed';

  onSearchInputChange: (value: string) => void;
  onSearchSubmit: () => void;
  onLimitChange: (limit: number) => void;
  onStartDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEndDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onApplyQuickRange: (type: 'today' | '1w' | '2w' | '1m') => void;
  onActionStatusFilterChange: (filter: 'all' | 'no_action' | 'in_progress' | 'completed') => void;
  onExport: () => void;
}

export function IncidentFilters({
  startDate,
  endDate,
  activeRange,
  isExporting,
  incidentsLimit,
  incidentsSearchInput,
  allFilteredIncidentsCount,
  actionStatusFilter,
  onSearchInputChange,
  onSearchSubmit,
  onLimitChange,
  onStartDateChange,
  onEndDateChange,
  onApplyQuickRange,
  onActionStatusFilterChange,
  onExport,
}: IncidentFiltersProps) {
  return (
    <div className="flex flex-col gap-4 bg-gray-50/30 p-4 border border-gray-100 rounded-none w-full">
      {/* 상단 로우: 필터 옵션 */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* 기간 필터 그룹 */}
          <div className="flex items-center gap-2">
            {/* 날짜 범위 캘린더 */}
            <div className="bg-white border border-gray-200 shadow-sm rounded-none px-3 py-2 flex items-center gap-2 hover:border-blue-400 transition-colors">
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

            {/* Quick Range 간편 선택 버튼 */}
            <div className="flex rounded-none border border-gray-200 shadow-sm overflow-hidden h-full">
              {(['today', '1w', '2w', '1m', 'search'] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => {
                    if (range === 'search') {
                      onSearchSubmit();
                    } else {
                      onApplyQuickRange(range as 'today' | '1w' | '2w' | '1m');
                    }
                  }}
                  className={`px-4 py-2.5 text-[13px] font-black tracking-tight transition-all border-r border-gray-200 last:border-r-0 ${range === 'search'
                    ? 'bg-[#00205b] text-white hover:bg-[#001540] min-w-[60px]'
                    : activeRange === range
                      ? 'bg-gray-800 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                >
                  {range === 'search' ? '조회' : range === 'today' ? '오늘' : range === '1w' ? '1주' : range === '2w' ? '2주' : '1개월'}
                </button>
              ))}
            </div>
          </div>

          {/* 분류 필터 그룹 */}
          <div className="flex items-center gap-2">
            {/* 조치 상태 필터 */}
            <div className="bg-white backdrop-blur-sm rounded-none px-3 py-2.5 shadow-sm border border-gray-200 flex items-center gap-2 hover:border-blue-400 transition-colors">
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                Status
              </span>
              <select
                value={actionStatusFilter}
                onChange={(e) => onActionStatusFilterChange(e.target.value as any)}
                className="bg-transparent text-sm font-black text-gray-700 focus:outline-none cursor-pointer border-none p-0 w-[80px]"
              >
                <option value="all">전체 상태</option>
                <option value="no_action">조치 등록</option>
                <option value="completed">완료 됨</option>
              </select>
            </div>

            {/* Limit 선택 */}
            <div className="bg-white backdrop-blur-sm rounded-none px-3 py-2.5 shadow-sm border border-gray-200 flex items-center gap-2 hover:border-blue-400 transition-colors">
              <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                Limit
              </span>
              <select
                value={incidentsLimit}
                onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
                className="bg-transparent text-sm font-black text-gray-700 focus:outline-none cursor-pointer border-none p-0 w-[50px]"
              >
                <option value="10">10건</option>
                <option value="30">30건</option>
                <option value="50">50건</option>
                <option value="100">100건</option>
              </select>
            </div>
          </div>
        </div>

        {/* Excel 내보내기 버튼 */}
        <button
          type="button"
          onClick={onExport}
          disabled={isExporting || allFilteredIncidentsCount === 0}
          className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-none font-bold shadow-sm transition-all text-[13px] border ${isExporting || allFilteredIncidentsCount === 0
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            : 'bg-green-700 border-green-700 text-white hover:bg-green-800 hover:border-green-800'
            }`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          <span className="whitespace-nowrap tracking-wide">
            {isExporting ? '엑셀 추출 중...' : '엑셀 다운로드'}
          </span>
        </button>
      </div>

      {/* 하단 로우: 검색 바 */}
      <div className="relative w-full max-w-3xl group">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-gray-400 group-focus-within:text-[#00205b] transition-colors">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
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
          className="w-full pl-14 pr-24 py-3.5 bg-white border border-gray-200 rounded-none text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00205b]/20 focus:border-[#00205b] transition-all placeholder:text-gray-400"
        />
        <button
          onClick={onSearchSubmit}
          className="absolute right-2 top-2 bottom-2 px-8 bg-[#00205b] text-white text-[12px] font-black rounded-none shadow-sm hover:bg-[#001540] transition-all uppercase tracking-widest"
        >
          Search
        </button>
      </div>
    </div>
  );
}
