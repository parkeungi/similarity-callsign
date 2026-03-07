'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Callsign } from '@/types/action';
import * as XLSX from 'xlsx';
import { ActionDetailModal } from '../ActionDetailModal';

interface AirlineCallsignListTabProps {
  callsigns: Callsign[];
  isLoading: boolean;
  startDate: string;
  endDate: string;
  activeRange: 'custom' | 'today' | '1w' | '2w' | '1m';
  onStartDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEndDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onApplyQuickRange: (type: 'today' | '1w' | '2w' | '1m') => void;
}

export function AirlineCallsignListTab({
  callsigns,
  isLoading,
  startDate,
  endDate,
  activeRange,
  onStartDateChange,
  onEndDateChange,
  onApplyQuickRange,
}: AirlineCallsignListTabProps) {
  const { user } = useAuthStore((s) => ({ user: s.user }));
  const airlineId = user?.airline?.id;

  // 상태
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'risk' | 'occurrence' | 'priority'>('priority');
  const [isExporting, setIsExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [selectedCallsign, setSelectedCallsign] = useState<Callsign | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // API가 이미 airline_code로 필터링하므로 모든 데이터가 현재 항공사의 호출부호
  const airlineCallsigns = useMemo(() => {
    return callsigns || [];
  }, [callsigns]);

  // 날짜 필터링
  const dateFilteredCallsigns = useMemo(() => {
    if (!startDate || !endDate) return airlineCallsigns;

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return airlineCallsigns.filter((cs) => {
      const uploadDate = cs.uploaded_at ? new Date(cs.uploaded_at) : null;
      if (!uploadDate) return true;
      return uploadDate >= start && uploadDate <= end;
    });
  }, [airlineCallsigns, startDate, endDate]);

  // 상태 필터링
  const statusFilteredCallsigns = useMemo(() => {
    if (statusFilter === 'all') return dateFilteredCallsigns;
    if (statusFilter === 'completed') {
      return dateFilteredCallsigns.filter(cs => cs.action_status === 'completed');
    }
    if (statusFilter === 'pending') {
      // 조치필요 = 완료되지 않은 모든 항목 (in_progress + no_action)
      return dateFilteredCallsigns.filter(cs => cs.action_status !== 'completed');
    }
    return dateFilteredCallsigns;
  }, [dateFilteredCallsigns, statusFilter]);

  // 상태별 배지 색상
  const getActionStatusMeta = (status?: string) => {
    const normalized = (status || 'no_action').toLowerCase();
    switch (normalized) {
      case 'completed':
        return {
          label: '완료',
          bubble: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        };
      case 'in_progress':
        return {
          label: '조치중',
          bubble: 'bg-blue-50 text-blue-600 border-blue-100',
        };
      case 'pending':
        return {
          label: '미조치',
          bubble: 'bg-amber-50 text-amber-600 border-amber-100',
        };
      case 'no_action':
      default:
        return {
          label: '미등록',
          bubble: 'bg-slate-50 text-slate-600 border-slate-100',
        };
    }
  };

  // 통계 계산
  const stats = useMemo(() => {
    return {
      total: dateFilteredCallsigns.length,
      completed: dateFilteredCallsigns.filter(cs => cs.action_status === 'completed').length,
      pending: dateFilteredCallsigns.filter(cs => cs.action_status !== 'completed' && cs.action_status !== 'no_action').length,
      notStarted: dateFilteredCallsigns.filter(cs => cs.action_status === 'no_action').length,
    };
  }, [dateFilteredCallsigns]);

  // 정렬 로직
  const sortedCallsigns = useMemo(() => {
    const sorted = [...statusFilteredCallsigns];
    const riskOrder = { '매우높음': 3, '높음': 2, '낮음': 1, '중간': 1 };
    const similarityOrder = { '매우높음': 3, '높음': 2, '낮음': 1 };

    switch (sortBy) {
      case 'priority':
        return sorted.sort((a, b) => {
          // 1순위: 위험도 (높을수록 우선)
          const riskA = riskOrder[a.risk_level as keyof typeof riskOrder] || 0;
          const riskB = riskOrder[b.risk_level as keyof typeof riskOrder] || 0;
          if (riskB !== riskA) return riskB - riskA;

          // 2순위: 유사도 (높을수록 우선)
          const simA = similarityOrder[a.similarity as keyof typeof similarityOrder] || 0;
          const simB = similarityOrder[b.similarity as keyof typeof similarityOrder] || 0;
          if (simB !== simA) return simB - simA;

          // 3순위: 발생건 (많을수록 우선)
          return (b.occurrence_count || 0) - (a.occurrence_count || 0);
        });
      case 'latest':
        return sorted.sort((a, b) => {
          const dateA = a.last_occurred_at ? new Date(a.last_occurred_at).getTime() : 0;
          const dateB = b.last_occurred_at ? new Date(b.last_occurred_at).getTime() : 0;
          return dateB - dateA;
        });
      case 'oldest':
        return sorted.sort((a, b) => {
          const dateA = a.first_occurred_at ? new Date(a.first_occurred_at).getTime() : 0;
          const dateB = b.first_occurred_at ? new Date(b.first_occurred_at).getTime() : 0;
          return dateA - dateB;
        });
      case 'risk':
        return sorted.sort((a, b) =>
          (riskOrder[b.risk_level as keyof typeof riskOrder] || 0) - (riskOrder[a.risk_level as keyof typeof riskOrder] || 0)
        );
      case 'occurrence':
        return sorted.sort((a, b) => (b.occurrence_count || 0) - (a.occurrence_count || 0));
      default:
        return sorted;
    }
  }, [statusFilteredCallsigns, sortBy]);

  // 페이지네이션
  const limit = 10;
  const totalPages = Math.max(1, Math.ceil(sortedCallsigns.length / limit));
  const pagedCallsigns = useMemo(() => {
    const start = (page - 1) * limit;
    return sortedCallsigns.slice(start, start + limit);
  }, [sortedCallsigns, page, limit]);

  const startItem = sortedCallsigns.length === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, sortedCallsigns.length);

  // 엑셀 다운로드
  const handleExportExcel = useCallback(async () => {
    try {
      setIsExporting(true);
      const data = sortedCallsigns.map(cs => ({
        '등록일': cs.uploaded_at
          ? new Date(cs.uploaded_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
          : '-',
        '호출부호': cs.callsign_pair,
        '오류유형': cs.error_type || '-',
        '위험도': cs.risk_level,
        '유사도': cs.similarity || '-',
        '발생': cs.occurrence_count ?? 0,
        '최근발생일': cs.last_occurred_at
          ? new Date(cs.last_occurred_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
          : '-',
        '조치유형': cs.action_type || '-',
        '상태': getActionStatusMeta(cs.action_status).label,
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '호출부호 목록');
      XLSX.writeFile(workbook, `호출부호_목록_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('엑셀 다운로드 오류:', error);
    } finally {
      setIsExporting(false);
    }
  }, [sortedCallsigns]);

  return (
    <div className="space-y-6">
      {/* 통계 정보 */}
      <div className="space-y-2 mb-4">
        <div className="text-2xl font-black text-gray-800">
          {stats.total} <span className="text-gray-500 text-base">(유사호출부호 쌍)</span>
        </div>
        <p className="text-xs text-gray-500">
          ※ 조치별 건수는 조치 현황 기준이며, 전체 유사호출부호 쌍 수와 일치하지 않을 수 있습니다.
        </p>
      </div>

      {/* 통계 카드 - 클릭 가능 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 전체 보기 */}
        <button
          onClick={() => {
            setStatusFilter('all');
            setPage(1);
          }}
          className={`rounded-lg p-6 shadow-sm transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-blue-50 border-2 border-blue-600 ring-2 ring-blue-200'
              : 'bg-white border border-gray-200 hover:border-blue-300 hover:shadow-md'
          }`}
        >
          <div className="text-center">
            <div className={`text-4xl font-bold ${statusFilter === 'all' ? 'text-blue-600' : 'text-blue-600'}`}>
              {stats.total}
            </div>
            <div className={`text-sm mt-2 ${statusFilter === 'all' ? 'text-blue-600 font-bold' : 'text-gray-600'}`}>
              전체
            </div>
          </div>
        </button>

        {/* 조치완료 */}
        <button
          onClick={() => {
            setStatusFilter('completed');
            setPage(1);
          }}
          className={`rounded-lg p-6 shadow-sm transition-all cursor-pointer ${
            statusFilter === 'completed'
              ? 'bg-emerald-50 border-2 border-emerald-600 ring-2 ring-emerald-200'
              : 'bg-white border border-gray-200 hover:border-emerald-300 hover:shadow-md'
          }`}
        >
          <div className="text-center">
            <div className={`text-4xl font-bold ${statusFilter === 'completed' ? 'text-emerald-600' : 'text-emerald-600'}`}>
              {stats.completed}
            </div>
            <div className={`text-sm mt-2 ${statusFilter === 'completed' ? 'text-emerald-600 font-bold' : 'text-gray-600'}`}>
              조치완료
            </div>
          </div>
        </button>

        {/* 조치필요 */}
        <button
          onClick={() => {
            setStatusFilter('pending');
            setPage(1);
          }}
          className={`rounded-lg p-6 shadow-sm transition-all cursor-pointer ${
            statusFilter === 'pending'
              ? 'bg-rose-50 border-2 border-rose-600 ring-2 ring-rose-200'
              : 'bg-white border border-gray-200 hover:border-rose-300 hover:shadow-md'
          }`}
        >
          <div className="text-center">
            <div className={`text-4xl font-bold ${statusFilter === 'pending' ? 'text-rose-600' : 'text-rose-600'}`}>
              {stats.pending + stats.notStarted}
            </div>
            <div className={`text-sm mt-2 ${statusFilter === 'pending' ? 'text-rose-600 font-bold' : 'text-gray-600'}`}>
              조치필요
            </div>
          </div>
        </button>
      </div>

      {/* 필터 바 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* 날짜 범위 */}
          <div className="bg-gray-50 border border-gray-300 rounded-none px-3 py-2 flex items-center gap-2">
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

          {/* Quick Range 버튼들 */}
          <div className="flex rounded-none border border-gray-200 overflow-hidden">
            {(['today', '1w', '2w', '1m'] as const).map((range) => {
              const labels: Record<typeof range, string> = {
                'today': '오늘',
                '1w': '1주',
                '2w': '2주',
                '1m': '1개월',
              };
              return (
                <button
                  key={range}
                  type="button"
                  onClick={() => onApplyQuickRange(range)}
                  className={`px-4 py-2.5 text-[13px] font-black tracking-tight transition-all border-r border-gray-200 last:border-r-0 ${
                    activeRange === range
                      ? 'bg-[#00205b] text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {labels[range]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 호출부호 목록 헤더 */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-gray-700">조치 목록</div>
        <div className="flex items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as any);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <option value="priority">우선순위순 (위험도 → 유사도 → 발생)</option>
            <option value="latest">최근발생일순</option>
            <option value="oldest">오래된순</option>
            <option value="risk">위험도순</option>
            <option value="occurrence">발생횟수순</option>
          </select>
          <button
            onClick={handleExportExcel}
            disabled={isExporting || sortedCallsigns.length === 0}
            className="px-4 py-2 bg-emerald-600 text-white font-bold rounded text-sm hover:bg-emerald-700 disabled:bg-gray-300 transition-colors"
          >
            {isExporting ? '다운로드 중...' : '엑셀'}
          </button>
        </div>
      </div>

      {/* 호출부호 목록 테이블 */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">
            <p className="text-sm">데이터를 불러오는 중입니다...</p>
          </div>
        ) : sortedCallsigns.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-5 text-left text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      등록일
                    </th>
                    <th className="px-6 py-5 text-left text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      호출부호
                    </th>
                    <th className="px-6 py-5 text-left text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      오류유형
                    </th>
                    <th className="px-6 py-5 text-left text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      위험도
                    </th>
                    <th className="px-6 py-5 text-left text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      유사도
                    </th>
                    <th className="px-6 py-5 text-center text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      발생
                    </th>
                    <th className="px-6 py-5 text-left text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      최근발생일
                    </th>
                    <th className="px-6 py-5 text-left text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      조치유형
                    </th>
                    <th className="px-6 py-5 text-left text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      상태
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pagedCallsigns.map((callsign) => {
                    // 항공사 API는 이미 필터링되어 있으므로 action_status 직접 사용
                    const actionStatus = callsign.action_status;
                    const statusMeta = getActionStatusMeta(actionStatus);

                    return (
                      <tr
                        key={callsign.id}
                        className="hover:bg-blue-50 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedCallsign(callsign);
                          setIsDetailModalOpen(true);
                        }}
                      >
                        {/* 등록일 */}
                        <td className="px-6 py-5 text-gray-500 font-medium text-[13px]">
                          {callsign.uploaded_at
                            ? new Date(callsign.uploaded_at).toLocaleDateString('ko-KR', {
                                month: 'long',
                                day: 'numeric',
                              })
                            : '-'}
                        </td>

                        {/* 호출부호 */}
                        <td className="px-6 py-5 font-bold text-gray-800">{callsign.callsign_pair}</td>

                        {/* 오류유형 */}
                        <td className="px-6 py-5 text-gray-600 font-medium">{callsign.error_type || '-'}</td>

                        {/* 위험도 */}
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap ${
                              callsign.risk_level === '매우높음'
                                ? 'bg-rose-50 text-rose-600 border border-rose-300'
                                : callsign.risk_level === '높음'
                                ? 'bg-orange-50 text-orange-600 border border-orange-300'
                                : 'bg-emerald-50 text-emerald-600 border border-emerald-300'
                            }`}
                          >
                            {callsign.risk_level}
                          </span>
                        </td>

                        {/* 유사도 */}
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap ${
                              callsign.similarity === '매우높음'
                                ? 'bg-rose-50 text-rose-600'
                                : callsign.similarity === '높음'
                                ? 'bg-orange-50 text-orange-600'
                                : 'bg-gray-50 text-gray-600'
                            }`}
                          >
                            {callsign.similarity || '-'}
                          </span>
                        </td>

                        {/* 발생횟수 */}
                        <td className="px-6 py-5 font-bold text-gray-800 text-center">
                          {callsign.occurrence_count ?? 0}
                        </td>

                        {/* 최근 발생일 */}
                        <td className="px-6 py-5 text-gray-600 font-medium text-[13px]">
                          {callsign.last_occurred_at
                            ? new Date(callsign.last_occurred_at).toLocaleDateString('ko-KR', {
                                month: 'long',
                                day: 'numeric',
                              })
                            : '-'}
                        </td>

                        {/* 조치유형 */}
                        <td className="px-6 py-5 text-gray-600 font-semibold">{callsign.action_type || '-'}</td>

                        {/* 상태 */}
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold border whitespace-nowrap ${statusMeta.bubble}`}
                          >
                            {statusMeta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="px-6 py-6 border-t border-gray-200">
                {/* 정보 텍스트 */}
                <div className="text-center mb-4">
                  <span className="text-[12px] font-bold text-gray-600">
                    총 <span className="text-gray-800 font-black">{dateFilteredCallsigns.length}</span>건 중 <span className="text-blue-600">{startItem}-{endItem}</span>
                  </span>
                </div>

                {/* 페이지네이션 버튼 */}
                <div className="flex items-center justify-center gap-1">
                  {/* 첫 페이지 */}
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    title="첫 페이지"
                    className="px-3 py-2 rounded border border-gray-300 text-gray-600 font-bold text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 disabled:border-gray-200 disabled:text-gray-300 disabled:bg-gray-50 transition-all"
                  >
                    ⏮
                  </button>

                  {/* 이전 */}
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-2 rounded border border-gray-300 text-gray-600 font-bold text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 disabled:border-gray-200 disabled:text-gray-300 disabled:bg-gray-50 transition-all"
                  >
                    ◀
                  </button>

                  {/* 페이지 번호 표시 */}
                  <div className="px-4 py-2 mx-1 rounded border border-blue-300 bg-blue-50">
                    <span className="text-sm font-black text-blue-600">
                      {page} <span className="text-gray-400 font-bold">/ {totalPages}</span>
                    </span>
                  </div>

                  {/* 다음 */}
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-2 rounded border border-gray-300 text-gray-600 font-bold text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 disabled:border-gray-200 disabled:text-gray-300 disabled:bg-gray-50 transition-all"
                  >
                    ▶
                  </button>

                  {/* 마지막 페이지 */}
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    title="마지막 페이지"
                    className="px-3 py-2 rounded border border-gray-300 text-gray-600 font-bold text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 disabled:border-gray-200 disabled:text-gray-300 disabled:bg-gray-50 transition-all"
                  >
                    ⏭
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-12 text-center text-gray-500">
            <p className="text-sm">호출부호 목록이 없습니다.</p>
          </div>
        )}
      </div>

      {/* 상세보기 모달 */}
      {isDetailModalOpen && selectedCallsign && (
        <ActionDetailModal
          callsign={selectedCallsign}
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          onEdit={() => {
            // 부모 컴포넌트로 이벤트 전파를 위해 나중에 구현
            setIsDetailModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
