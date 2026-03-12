// 유사호출부호 목록 탭 - Incident[] 테이블 렌더링, 위험도·유사성 배지, Excel(xlsx) 내보내기 기능, 정렬·필터 지원
'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { Callsign } from '@/types/action';
import * as XLSX from 'xlsx';
import { DateRangeFilterState } from '@/types/airline';
import { ActionDetailModal } from '@/components/airline/ActionDetailModal';

interface AirlineCallsignListTabProps {
  callsigns: Callsign[];
  isLoading: boolean;
  dateFilter: DateRangeFilterState;
  onStartDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEndDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onApplyQuickRange: (type: 'today' | '1w' | '2w' | '1m') => void;
}

export function AirlineCallsignListTab({
  callsigns,
  isLoading,
  dateFilter,
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
  const [searchQuery, setSearchQuery] = useState('');

  // API가 이미 airline_code로 필터링하므로 모든 데이터가 현재 항공사의 호출부호
  const airlineCallsigns = useMemo(() => {
    return callsigns || [];
  }, [callsigns]);

  // 날짜 필터링
  const dateFilteredCallsigns = useMemo(() => {
    if (!dateFilter.startDate || !dateFilter.endDate) return airlineCallsigns;

    const start = new Date(dateFilter.startDate);
    const end = new Date(dateFilter.endDate);
    end.setHours(23, 59, 59, 999);

    return airlineCallsigns.filter((cs) => {
      const uploadDate = cs.uploaded_at ? new Date(cs.uploaded_at) : null;
      if (!uploadDate) return true;
      return uploadDate >= start && uploadDate <= end;
    });
  }, [airlineCallsigns, dateFilter.startDate, dateFilter.endDate]);

  // 검색 필터링
  const searchFilteredCallsigns = useMemo(() => {
    if (!searchQuery.trim()) return dateFilteredCallsigns;
    const q = searchQuery.trim().toLowerCase();
    return dateFilteredCallsigns.filter(cs =>
      (cs.callsign_pair && cs.callsign_pair.toLowerCase().includes(q)) ||
      (cs.error_type && cs.error_type.toLowerCase().includes(q)) ||
      (cs.action_type && cs.action_type.toLowerCase().includes(q)) ||
      (cs.risk_level && cs.risk_level.toLowerCase().includes(q))
    );
  }, [dateFilteredCallsigns, searchQuery]);

  // 상태 필터링
  const statusFilteredCallsigns = useMemo(() => {
    if (statusFilter === 'all') return searchFilteredCallsigns;
    if (statusFilter === 'completed') {
      return searchFilteredCallsigns.filter(cs => cs.action_status === 'completed');
    }
    if (statusFilter === 'pending') {
      // 조치필요 = 완료되지 않은 모든 항목 (in_progress + no_action)
      return searchFilteredCallsigns.filter(cs => cs.action_status !== 'completed');
    }
    return searchFilteredCallsigns;
  }, [searchFilteredCallsigns, statusFilter]);

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
      total: searchFilteredCallsigns.length,
      completed: searchFilteredCallsigns.filter(cs => cs.action_status === 'completed').length,
      pending: searchFilteredCallsigns.filter(cs => cs.action_status !== 'completed' && cs.action_status !== 'no_action').length,
      notStarted: searchFilteredCallsigns.filter(cs => cs.action_status === 'no_action').length,
    };
  }, [searchFilteredCallsigns]);

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

      const formatDate = (d: string | null | undefined) =>
        d ? new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';

      const formatErrorTypeCounts = (cs: typeof sortedCallsigns[0]) => {
        if (cs.error_type_counts && Object.keys(cs.error_type_counts).length > 0) {
          return Object.entries(cs.error_type_counts)
            .map(([type, count]) => `${type} ${count}건`)
            .join(', ');
        }
        if (cs.occurrences && cs.occurrences.length > 0) {
          const counts: Record<string, number> = {};
          cs.occurrences.forEach((o: any) => {
            const t = o.errorType || o.error_type || '오류미발생';
            counts[t] = (counts[t] || 0) + 1;
          });
          return Object.entries(counts)
            .map(([type, count]) => `${type} ${count}건`)
            .join(', ');
        }
        return '-';
      };

      const formatOccurrenceDates = (cs: typeof sortedCallsigns[0]) => {
        if (cs.occurrence_dates) {
          return cs.occurrence_dates
            .split(',')
            .map((d: string) => d.trim())
            .filter(Boolean)
            .join(', ');
        }
        if (cs.occurrences && cs.occurrences.length > 0) {
          return cs.occurrences
            .map((o: any) => o.occurred_at || o.date || '')
            .filter(Boolean)
            .join(', ');
        }
        return '-';
      };

      const data = sortedCallsigns.map(cs => ({
        '등록일': cs.uploaded_at
          ? new Date(cs.uploaded_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
          : '-',
        '호출부호': cs.callsign_pair,
        '오류유형': cs.error_type || '-',
        '세부오류': cs.sub_error || '-',
        '위험도': cs.risk_level || '-',
        '유사도': cs.similarity || '-',
        '관할섹터': cs.sector || '-',
        '발생건수': cs.occurrence_count ?? 0,
        '최초발생일': formatDate(cs.first_occurred_at),
        '최근발생일': formatDate(cs.last_occurred_at),
        '발생이력': formatOccurrenceDates(cs),
        '오류유형별건수': formatErrorTypeCounts(cs),
        '조치유형': cs.action_type || '-',
        '상태': getActionStatusMeta(cs.action_status).label,
        '조치완료일': formatDate(cs.action_completed_at),
        '조치내용': cs.action_description || '-',
        '관제권고': cs.atc_recommendation || '-',
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);

      // 컬럼 너비 자동 조정
      const colWidths = Object.keys(data[0] || {}).map(key => {
        const maxLen = Math.max(
          key.length,
          ...data.map(row => String((row as any)[key] || '').length)
        );
        return { wch: Math.min(Math.max(maxLen + 2, 8), 50) };
      });
      worksheet['!cols'] = colWidths;

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
      {/* 필터 바 - 한 줄 */}
      <div className="w-full border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex w-full items-center gap-2">
          {/* 날짜 범위 */}
          <div className="flex items-center gap-1.5 border border-gray-200 bg-white px-3 h-9 shrink-0">
            <input
              type="date"
              value={dateFilter.startDate}
              onChange={onStartDateChange}
              className="w-[110px] border-none bg-transparent p-0 text-sm font-semibold text-gray-900 outline-none focus:ring-0"
            />
            <span className="text-sm text-gray-300">~</span>
            <input
              type="date"
              value={dateFilter.endDate}
              onChange={onEndDateChange}
              className="w-[110px] border-none bg-transparent p-0 text-sm font-semibold text-gray-900 outline-none focus:ring-0"
            />
          </div>

          {/* 빠른 기간 */}
          <div className="flex h-9 overflow-hidden border border-gray-200 shrink-0">
            {(['today', '1w', '2w', '1m'] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => onApplyQuickRange(range)}
                className={`px-3 text-[13px] font-bold transition-colors ${
                  dateFilter.activeRange === range ? 'bg-[#0f1b40] text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                } ${range !== '1m' ? 'border-r border-gray-200' : ''}`}
              >
                {range === 'today' ? '오늘' : range === '1w' ? '1주' : range === '2w' ? '2주' : '1개월'}
              </button>
            ))}
          </div>

          {/* 정렬 */}
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as any); setPage(1); }}
            className="h-9 border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 outline-none shrink-0"
          >
            <option value="priority">우선순위순</option>
            <option value="latest">최근발생일순</option>
            <option value="oldest">오래된순</option>
            <option value="risk">위험도순</option>
            <option value="occurrence">발생횟수순</option>
          </select>

          <div className="flex-1" />

          {/* 검색 */}
          <div className="relative shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="호출부호, 오류유형 검색"
              className="h-9 w-[200px] border border-gray-200 bg-white pl-8 pr-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setPage(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* 엑셀 */}
          <button
            onClick={handleExportExcel}
            disabled={isExporting || sortedCallsigns.length === 0}
            className="h-9 px-4 text-[13px] font-bold bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 shrink-0 transition-colors"
          >
            {isExporting ? '추출 중...' : 'EXCEL'}
          </button>
        </div>
      </div>

      {/* 통계 - 가로 한줄 바 */}
      <div className="bg-white border border-gray-200 shadow-sm">
        <div className="flex divide-x divide-gray-100">
          {[
            { label: '전체', value: stats.total, color: '#6366f1', filter: 'all' as const },
            { label: '조치완료', value: stats.completed, color: '#10b981', filter: 'completed' as const },
            { label: '조치필요', value: stats.pending + stats.notStarted, color: '#ef4444', filter: 'pending' as const },
          ].map(({ label, value, color, filter }) => (
            <button
              key={label}
              onClick={() => { setStatusFilter(filter); setPage(1); }}
              className={`flex-1 px-5 py-3 text-left transition-all hover:bg-gray-50 ${statusFilter === filter ? 'bg-gray-50' : ''}`}
              style={{ borderLeft: `3px solid ${color}` }}
            >
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className="text-2xl font-black text-gray-900">{value}</div>
            </button>
          ))}
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
              <table className="text-sm table-fixed min-w-full">
                <colgroup>
                  <col className="w-[90px]" />
                  <col className="w-[180px]" />
                  <col className="w-[110px]" />
                  <col className="w-[90px]" />
                  <col className="w-[90px]" />
                  <col className="w-[60px]" />
                  <col className="w-[100px]" />
                  <col className="w-[130px]" />
                  <col className="w-[80px]" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-5 text-left text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      등록일
                    </th>
                    <th className="px-4 py-5 text-left text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      호출부호
                    </th>
                    <th className="px-4 py-5 text-left text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      오류유형
                    </th>
                    <th className="px-4 py-5 text-left text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      위험도
                    </th>
                    <th className="px-4 py-5 text-left text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      유사도
                    </th>
                    <th className="px-4 py-5 text-center text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      발생
                    </th>
                    <th className="px-4 py-5 text-left text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      최근발생일
                    </th>
                    <th className="px-4 py-5 text-left text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                      조치유형
                    </th>
                    <th className="px-4 py-5 text-left text-[12px] font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
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
                        <td className="px-4 py-4 text-gray-500 font-medium text-[13px]">
                          {callsign.uploaded_at
                            ? new Date(callsign.uploaded_at).toLocaleDateString('ko-KR', {
                                month: 'long',
                                day: 'numeric',
                              })
                            : '-'}
                        </td>

                        {/* 호출부호 */}
                        <td className="px-4 py-4 font-bold text-gray-800">{callsign.callsign_pair}</td>

                        {/* 오류유형 */}
                        <td className="px-4 py-4 text-gray-600 font-medium">{callsign.error_type || '-'}</td>

                        {/* 위험도 */}
                        <td className="px-4 py-4">
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
                        <td className="px-4 py-4">
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
                        <td className="px-4 py-4 font-bold text-gray-800 text-center">
                          {callsign.occurrence_count ?? 0}
                        </td>

                        {/* 최근 발생일 */}
                        <td className="px-4 py-4 text-gray-600 font-medium text-[13px]">
                          {callsign.last_occurred_at
                            ? new Date(callsign.last_occurred_at).toLocaleDateString('ko-KR', {
                                month: 'long',
                                day: 'numeric',
                              })
                            : '-'}
                        </td>

                        {/* 조치유형 */}
                        <td className="px-4 py-4 text-gray-600 font-semibold">{callsign.action_type || '-'}</td>

                        {/* 상태 */}
                        <td className="px-4 py-4">
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
              <div className="py-6 flex items-center justify-center gap-1 border-t border-gray-200">
                <button onClick={() => setPage(1)} disabled={page === 1}
                  className="w-9 h-9 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 disabled:text-gray-200 transition-all">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 3h1.5v10H3V3zm3.5 5L12 3v10L6.5 8z"/></svg>
                </button>
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                  className="w-9 h-9 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 disabled:text-gray-200 transition-all">
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><path d="M8.5 1L1.5 7l7 6"/></svg>
                </button>
                {(() => {
                  const half = 2;
                  let start = Math.max(1, page - half);
                  let end = Math.min(totalPages, start + 4);
                  if (end - start < 4) start = Math.max(1, end - 4);
                  return Array.from({ length: end - start + 1 }, (_, i) => start + i).map((p) => (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-9 h-9 flex items-center justify-center rounded text-sm font-bold transition-all ${
                        p === page ? 'bg-[#0A2C5A] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
                      }`}>
                      {p}
                    </button>
                  ));
                })()}
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                  className="w-9 h-9 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 disabled:text-gray-200 transition-all">
                  <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor"><path d="M1.5 1l7 6-7 6"/></svg>
                </button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  className="w-9 h-9 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 disabled:text-gray-200 transition-all">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13 3h-1.5v10H13V3zM9.5 8L4 3v10l5.5-5z"/></svg>
                </button>
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
