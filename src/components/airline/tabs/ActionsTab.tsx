'use client';

import React, { useCallback } from 'react';
import { Action, ActionListResponse, Callsign } from '@/types/action';
import { ActionStatus } from '@/types/airline';

interface ActionsTabProps {
  actionsData: ActionListResponse | undefined;
  actionsLoading: boolean;
  callsignsData: Callsign[];
  // Filters
  actionPage: number;
  actionLimit: number;
  actionSearch: string;
  actionSearchInput: string;
  actionStatusFilter: 'all' | ActionStatus;
  // Handlers
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: () => void;
  onStatusFilterChange: (status: 'all' | ActionStatus) => void;
  onActionClick: (action: Action) => void;
  onCallsignClick: (callsign: Callsign) => void;
  onCreateAction: (callsignId?: string) => void;
}

export function ActionsTab({
  actionsData,
  actionsLoading,
  callsignsData,
  actionPage,
  actionLimit,
  actionSearch,
  actionSearchInput,
  actionStatusFilter,
  onPageChange,
  onLimitChange,
  onSearchInputChange,
  onSearchSubmit,
  onStatusFilterChange,
  onActionClick,
  onCallsignClick,
  onCreateAction,
}: ActionsTabProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        onSearchSubmit();
      }
    },
    [onSearchSubmit]
  );

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

  const getStatusStyles = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'text-orange-700 bg-orange-50 border border-orange-200';
      case 'in_progress':
        return 'text-rose-700 bg-rose-50 border border-rose-200';
      case 'completed':
        return 'text-emerald-600 bg-emerald-50 border border-emerald-200';
      default:
        return 'text-gray-600 bg-gray-50 border border-gray-200';
    }
  };

  return (
    <>
      {/* 검색 및 필터 상단 바 */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="flex-1 relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
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
            placeholder="조치이력 내 유사호출부호, 조치유형 등을 검색하세요..."
            value={actionSearchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-none text-sm font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-700/20 focus:border-rose-700 transition-all placeholder:text-gray-300"
          />
          <button
            onClick={onSearchSubmit}
            className="absolute right-2 top-2 bottom-2 px-6 bg-[#00205b] text-white text-[11px] font-black rounded-none shadow-none hover:bg-[#001540] transition-all uppercase tracking-widest"
          >
            Search
          </button>
        </div>

        <div className="bg-white/50 backdrop-blur-sm rounded-none p-1.5 shadow-sm border border-gray-100 flex items-center gap-2">
          <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-3">
            Limit
          </span>
          <select
            value={actionLimit}
            onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
            className="bg-transparent text-sm font-black text-gray-700 focus:outline-none cursor-pointer pr-4"
          >
            <option value="10">10 Rows</option>
            <option value="30">30 Rows</option>
            <option value="50">50 Rows</option>
            <option value="100">100 Rows</option>
          </select>
        </div>
      </div>

      {/* 상태 필터 탭 - 미조치는 조치대상 탭에서만 관리 */}
      <div className="flex flex-wrap items-center gap-2 mb-8 bg-white/50 backdrop-blur-sm rounded-none p-1.5 shadow-sm border border-gray-100">
        <button
          onClick={() => onStatusFilterChange('all')}
          className={`flex-1 min-w-[100px] px-6 py-2.5 rounded-none text-xs font-black tracking-tight transition-all ${
            actionStatusFilter === 'all'
              ? 'bg-[#00205b] text-white shadow-none'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
        >
          전체
        </button>
        <button
          onClick={() => onStatusFilterChange('in_progress')}
          className={`flex-1 min-w-[100px] px-6 py-2.5 rounded-none text-xs font-black tracking-tight transition-all ${
            actionStatusFilter === 'in_progress'
              ? 'bg-rose-700 text-white shadow-none'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
        >
          진행중
        </button>
        <button
          onClick={() => onStatusFilterChange('completed')}
          className={`flex-1 min-w-[100px] px-6 py-2.5 rounded-none text-xs font-black tracking-tight transition-all ${
            actionStatusFilter === 'completed'
              ? 'bg-emerald-600 text-white shadow-none'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}
        >
          완료
        </button>
        {actionsData && (
          <div className="px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest border-l border-gray-200 ml-2">
            Total {actionsData.pagination.total} Cases
          </div>
        )}
      </div>

      {/* 조치 이력 테이블 */}
      {actionsLoading ? (
        <div className="p-20 text-center text-gray-400 font-bold animate-pulse">
          데이터 분석 중...
        </div>
      ) : actionsData && actionsData.data.length > 0 ? (
        <div className="bg-white rounded-none shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/30">
                  <th className="px-8 py-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest w-12">
                    No.
                  </th>
                  <th className="px-8 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">
                    Registered
                  </th>
                  <th className="px-8 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">
                    Callsign Pair
                  </th>
                  <th className="px-8 py-4 text-left text-[11px] font-black text-gray-400 uppercase tracking-widest">
                    Type
                  </th>
                  <th className="px-8 py-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest">
                    Status
                  </th>
                  <th className="px-8 py-4 text-center text-[11px] font-black text-gray-400 uppercase tracking-widest">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {actionsData.data.map((action, index) => {
                  const isVirtual = action.is_virtual ?? action.isVirtual ?? false;
                  const registeredDate = action.registered_at
                    ? new Date(action.registered_at).toLocaleDateString('ko-KR')
                    : '-';
                  const rowNumber = (actionPage - 1) * actionLimit + index + 1;

                  return (
                    <tr
                      key={action.id}
                      className="group hover:bg-primary/[0.02] transition-colors cursor-pointer"
                      onClick={(e) => {
                        // 편집/등록 버튼 클릭은 무시
                        if ((e.target as HTMLElement).closest('button')) return;

                        const targetId =
                          action.callsign_id || action.callsignId || action.callsign?.id;
                        const detailFromCallsigns = callsignsData.find(
                          (cs) => cs.id === targetId
                        );
                        const detailPayload = detailFromCallsigns || action.callsign;
                        if (detailPayload) {
                          onCallsignClick(detailPayload);
                        }
                      }}
                    >
                      <td className="px-8 py-5 text-sm font-bold text-gray-500 text-center">
                        {rowNumber}
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-gray-500">
                        {registeredDate}
                      </td>
                      <td className="px-8 py-5 text-sm font-black text-gray-900 tracking-tight">
                        {action.callsign?.callsign_pair || '-'}
                      </td>
                      <td className="px-8 py-5 text-sm font-bold text-gray-700">
                        {action.action_type || (isVirtual ? '조치 등록 필요' : '-')}
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span
                          className={`inline-flex px-3 py-1 rounded-none text-[10px] font-black tracking-widest ${getStatusStyles(
                            action.status
                          )}`}
                        >
                          {getStatusLabel(action.status)}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <button
                          onClick={() =>
                            isVirtual
                              ? onCreateAction(action.callsign_id || action.callsignId)
                              : onActionClick(action)
                          }
                          className={`px-4 py-2 text-white text-[9px] font-black rounded-none shadow-none transition-all uppercase tracking-wider ${
                            isVirtual ? 'bg-[#00205b] hover:bg-[#001540]' : 'bg-rose-700 hover:bg-rose-800'
                          }`}
                        >
                          {isVirtual ? '등록' : '편집'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {actionsData.pagination.totalPages > 1 && (
            <div className="px-8 py-6 border-t border-gray-50 flex justify-center items-center gap-2">
              <button
                onClick={() => onPageChange(Math.max(1, actionPage - 1))}
                disabled={actionPage === 1}
                className="p-2 rounded-none border border-gray-200 text-gray-400 hover:text-rose-700 hover:border-rose-700 disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-gray-200 transition-all font-black text-xs"
              >
                PREV
              </button>

              <div className="flex gap-1 mx-4">
                {Array.from(
                  { length: Math.min(5, actionsData.pagination.totalPages) },
                  (_, i) => {
                    const startPage = Math.max(
                      1,
                      Math.min(
                        actionPage - 2,
                        actionsData.pagination.totalPages - 4
                      )
                    );
                    const pageNum = startPage + i;
                    if (pageNum > actionsData.pagination.totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => onPageChange(pageNum)}
                        className={`w-10 h-10 rounded-none text-xs font-black transition-all border border-transparent ${
                          pageNum === actionPage
                            ? 'bg-rose-700 text-white shadow-none'
                            : 'text-gray-400 hover:text-gray-900 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                )}
              </div>

              <button
                onClick={() =>
                  onPageChange(
                    Math.min(actionsData.pagination.totalPages, actionPage + 1)
                  )
                }
                disabled={actionPage === actionsData.pagination.totalPages}
                className="p-2 rounded-none border border-gray-200 text-gray-400 hover:text-rose-700 hover:border-rose-700 disabled:opacity-30 disabled:hover:text-gray-400 disabled:hover:border-gray-200 transition-all font-black text-xs"
              >
                NEXT
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-none p-20 text-center shadow-sm border border-gray-100">
          <div className="text-4xl mb-4">📑</div>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">
            No action history found
          </p>
        </div>
      )}
    </>
  );
}
