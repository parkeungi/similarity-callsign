'use client';

import React, { useMemo, useCallback } from 'react';
import { Action, ActionListResponse, Callsign } from '@/types/action';

interface AirlineActionHistoryTabProps {
  actionsData: ActionListResponse | undefined;
  actionsLoading: boolean;
  actionPage: number;
  actionLimit: number;
  actionSearchInput: string;
  actionStatusFilter: 'all' | 'pending' | 'in_progress' | 'completed';
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: () => void;
  onStatusFilterChange: (status: 'all' | 'pending' | 'in_progress' | 'completed') => void;
  onActionClick: (action: Action) => void;
}

export function AirlineActionHistoryTab({
  actionsData,
  actionsLoading,
  actionPage,
  actionLimit,
  actionSearchInput,
  actionStatusFilter,
  onPageChange,
  onLimitChange,
  onSearchInputChange,
  onSearchSubmit,
  onStatusFilterChange,
  onActionClick,
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
      const dateA = new Date(a.updated_at || a.created_at || '').getTime();
      const dateB = new Date(b.updated_at || b.created_at || '').getTime();
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
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'in_progress':
        return 'bg-rose-100 text-rose-700 border-rose-300';
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        onSearchSubmit();
      }
    },
    [onSearchSubmit]
  );

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

      {/* 검색 및 필터 바 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3">
          {/* 검색 */}
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
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* 상태 필터 */}
          <select
            value={actionStatusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as 'all' | 'pending' | 'in_progress' | 'completed')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium"
          >
            <option value="all">모든 상태</option>
            <option value="pending">미조치</option>
            <option value="in_progress">진행중</option>
            <option value="completed">완료</option>
          </select>

          {/* 페이지 크기 */}
          <select
            value={actionLimit}
            onChange={(e) => {
              onLimitChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-medium"
          >
            <option value={10}>10개/페이지</option>
            <option value={20}>20개/페이지</option>
            <option value={50}>50개/페이지</option>
            <option value={100}>100개/페이지</option>
          </select>
        </div>
      </div>

      {/* 조치이력 테이블 */}
      {actionsLoading ? (
        <div className="bg-white rounded-lg p-12 text-center text-gray-500">
          <p className="text-sm">데이터를 불러오는 중입니다...</p>
        </div>
      ) : pagedActions.length > 0 ? (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-bold text-gray-700">처리일자</th>
                  <th className="px-6 py-3 text-left font-bold text-gray-700">유사호출부호</th>
                  <th className="px-6 py-3 text-left font-bold text-gray-700">조치유형</th>
                  <th className="px-6 py-3 text-left font-bold text-gray-700">담당자</th>
                  <th className="px-6 py-3 text-left font-bold text-gray-700">상태</th>
                  <th className="px-6 py-3 text-center font-bold text-gray-700">상세</th>
                </tr>
              </thead>
              <tbody>
                {pagedActions.map((action, idx) => (
                  <tr
                    key={`${action.id}-${idx}`}
                    className="border-b border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-3 text-gray-900 font-medium">
                      {action.updated_at
                        ? new Date(action.updated_at).toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          })
                        : '-'}
                    </td>
                    <td className="px-6 py-3 font-mono font-bold text-gray-900">
                      {action.callsign_pair || '-'}
                    </td>
                    <td className="px-6 py-3 text-gray-700">
                      {action.action_type || '-'}
                    </td>
                    <td className="px-6 py-3 text-gray-700">
                      {action.manager_name || '-'}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-block px-3 py-1 rounded text-xs font-bold border ${getStatusColor(action.status)}`}
                      >
                        {getStatusLabel(action.status)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => onActionClick(action)}
                        className="text-blue-600 hover:text-blue-800 font-semibold text-sm"
                      >
                        보기
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
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
  );
}
