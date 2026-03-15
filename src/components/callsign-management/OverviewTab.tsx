// 발생현황 개요 탭 - StatCard 4종(전체·위험도별)+호출부호 테이블, GET /api/callsigns 호출, 필터·페이지네이션
'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getErrorTypeColor } from '@/lib/error-type-colors';
import * as XLSX from 'xlsx';
import { useCallsignsWithActions } from '@/hooks/useActions';
import { useAirlines } from '@/hooks/useAirlines';
import { useAuthStore } from '@/store/authStore';
import { useActiveActionTypes } from '@/hooks/useActionTypes';
import { apiFetch } from '@/lib/api/client';
import { StatCard } from './StatCard';
import { Callsign } from '@/types/action';
import { AIRLINES } from '@/lib/constants';
import { Pagination } from '@/components/common/Pagination';

const DOMESTIC_AIRLINE_CODES = new Set<string>(AIRLINES.map((a) => a.code));

interface StatsResponse {
  total: number;
  veryHigh: number;
  high: number;
}

const getDefaultDateFrom = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().split('T')[0];
};

const getDefaultDateTo = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

export function OverviewTab() {
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('');
  const [selectedAirlineId, setSelectedAirlineId] = useState<string>('');
  const [selectedActionStatus, setSelectedActionStatus] = useState<string>('');
  const [selectedActionType, setSelectedActionType] = useState<string>('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>(getDefaultDateFrom());
  const [dateTo, setDateTo] = useState<string>(getDefaultDateTo());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const pageSizeOptions = [10, 30, 50, 100];
  const accessToken = useAuthStore((s) => s.accessToken);

  // 모달 상태
  const [selectedCallsignForDetail, setSelectedCallsignForDetail] = useState<Callsign | null>(null);
  const [isCallsignDetailModalOpen, setIsCallsignDetailModalOpen] = useState(false);

  const airlinesQuery = useAirlines();
  const { data: activeActionTypes = [] } = useActiveActionTypes();
  const callsignsQuery = useCallsignsWithActions({
    riskLevel: selectedRiskLevel || undefined,
    airlineId: (selectedAirlineId === 'foreign' || selectedAirlineId === 'foreign_domestic') ? undefined : (selectedAirlineId || undefined),
    airlineFilter: (selectedAirlineId === 'foreign' || selectedAirlineId === 'foreign_domestic') ? selectedAirlineId : undefined,
    // 카드 클릭으로 선택한 필터 (selectedStatusFilter)를 API에 전달
    myActionStatus: selectedStatusFilter !== 'all' ? selectedStatusFilter : (selectedActionStatus || undefined),
    actionType: selectedActionType || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    limit,
  });

  // 전체 통계 조회
  const statsQuery = useQuery({
    queryKey: ['callsigns-stats', selectedRiskLevel],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedRiskLevel) params.append('riskLevel', selectedRiskLevel);
      if (selectedAirlineId) params.append('airlineId', selectedAirlineId);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const response = await apiFetch(`/api/callsigns/stats?${params.toString()}`);

      if (!response.ok) {
        throw new Error('통계 조회 실패');
      }

      return (await response.json()) as StatsResponse;
    },
    enabled: !!accessToken,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // KPI 데이터
  const stats = statsQuery.data || {
    total: 0,
    veryHigh: 0,
    high: 0,
  };

  const rows = callsignsQuery.data?.data ?? [];
  const pagination = callsignsQuery.data?.pagination;
  const summary = callsignsQuery.data?.summary;
  const totalItems = pagination?.total ?? 0;
  const totalPagesFromApi = pagination?.totalPages ?? 0;
  const computedTotalPages = totalPagesFromApi > 0 ? totalPagesFromApi : 1;

  // 상태별 필터링
  const statusFilteredRows = useMemo(() => {
    if (selectedStatusFilter === 'all') return rows;
    return rows.filter(r => r.final_status === selectedStatusFilter);
  }, [rows, selectedStatusFilter]);

  // 검색 필터링
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return statusFilteredRows;
    const q = searchQuery.trim().toLowerCase();
    return statusFilteredRows.filter(r =>
      (r.callsign_pair && r.callsign_pair.toLowerCase().includes(q)) ||
      (r.error_type && r.error_type.toLowerCase().includes(q)) ||
      (r.action_type && r.action_type.toLowerCase().includes(q)) ||
      (r.airline_code && r.airline_code.toLowerCase().includes(q)) ||
      (r.other_airline_code && r.other_airline_code.toLowerCase().includes(q))
    );
  }, [statusFilteredRows, searchQuery]);

  // 필터 적용 여부 확인
  const hasFilters = selectedRiskLevel || selectedAirlineId || selectedActionStatus;

  // 상태 카드 숫자 캐시 (로딩 중에도 유지)
  const cachedStatusCountsRef = useRef<{
    all: number;
    complete: number;
    partial: number;
    in_progress: number;
  } | null>(null);

  useEffect(() => {
    if (!pagination) return;
    if (pagination.totalPages === 0) {
      if (page !== 1) {
        setPage(1);
      }
      return;
    }
    if (page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [pagination, page]);

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
          bubble: 'bg-gray-50 text-gray-600 border-gray-100',
        };
    }
  };

  const formatDisplayDate = useCallback((value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }, []);

  // 호출부호 숫자 부분 추출 (색상 비교용)
  const getCallsignNum = (cs: string) => cs.replace(/^[A-Za-z]+/, '').trim();

  // 호출부호 상세정보 메타데이터 계산
  const callsignDetailMeta = useMemo(() => {
    if (!selectedCallsignForDetail) return null;
    const row = selectedCallsignForDetail as any;
    return {
      occurrenceCount: row.occurrence_count ?? 0,
      firstOccurredAt: row.first_occurred_at ?? null,
      lastOccurredAt: row.last_occurred_at ?? null,
      similarity: row.similarity ?? '-',
      riskLevel: row.risk_level ?? '-',
      myCallsign: row.my_callsign ?? '-',
      otherCallsign: row.other_callsign ?? '-',
      myAirlineCode: row.airline_code ?? '-',
      otherAirlineCode: row.other_airline_code ?? '-',
      errorType: row.error_type ?? '-',
      subError: row.sub_error ?? '-',
      // 발생이력
      actionDescription: row.action_description ?? null,
      errorTypeCounts: (row.error_type_counts as Record<string, number>) ?? {},
      occurrenceDates: row.occurrence_dates ?? null,
      // 자사 조치 상세
      myActionType: row.action_type ?? null,
      myActionDescription: row.my_action_description ?? null,
      myManagerName: row.my_manager_name ?? null,
      myCompletedAt: row.action_completed_at ?? null,
      myActionStatus: row.my_action_status ?? 'no_action',
      // 타사 조치 상세
      otherActionType: row.other_action_type_detail ?? null,
      otherActionDescription: row.other_action_description ?? null,
      otherManagerName: row.other_manager_name ?? null,
      otherCompletedAt: row.other_completed_at ?? null,
      otherActionStatus: row.other_action_status ?? 'no_action',
    };
  }, [selectedCallsignForDetail]);

  const handleReset = () => {
    setSelectedRiskLevel('');
    setSelectedAirlineId('');
    setSelectedActionStatus('');
    setSelectedActionType('');
    setSelectedStatusFilter('all');
    setSearchQuery('');
    setDateFrom(getDefaultDateFrom());
    setDateTo(getDefaultDateTo());
    setPage(1);
  };

  // 상태별 카운팅 - 전체 데이터 기반 (페이지네이션 무시)
  // 카드 숫자 안정화: summary 로딩 중에도 캐시된 값 유지
  const statusCounts = useMemo(() => {
    // summary가 있으면 API 계산값 사용하고 캐시에 저장
    if (summary) {
      const counts = {
        all: summary.total,
        complete: summary.completed,
        partial: summary.partial ?? 0,
        in_progress: summary.in_progress,
      };
      cachedStatusCountsRef.current = counts;
      return counts;
    }

    // 로딩 중: 캐시된 값 반환 (없으면 기본값)
    return cachedStatusCountsRef.current || {
      all: 0,
      complete: 0,
      partial: 0,
      in_progress: 0,
    };
  }, [summary]);

  if (callsignsQuery.isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm font-bold text-gray-400 uppercase tracking-widest">
          Loading Data...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 필터 영역 */}
      <div className="bg-slate-50/50 px-4 py-3 rounded-xl border border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* 드롭다운 및 날짜 (좌측) */}
        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
          {/* 1. 항공사 */}
          <div className="relative w-[130px] flex-shrink-0">
            <select
              value={selectedAirlineId}
              onChange={(e) => {
                setSelectedAirlineId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-sm text-slate-700 appearance-none h-9"
            >
              <option value="">항공사 전체</option>
              {airlinesQuery.data?.map((airline) => (
                <option key={airline.id} value={airline.id}>
                  {airline.code} - {airline.name_ko}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>

          {/* 2. 날짜 */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-[125px] px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-sm text-slate-700 h-9"
            />
            <span className="text-slate-400 font-medium text-sm">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-[125px] px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-sm text-slate-700 h-9"
            />
          </div>

          {/* 3. 조치상태 */}
          <div className="relative w-[120px] flex-shrink-0">
            <select
              value={selectedActionStatus}
              onChange={(e) => {
                setSelectedActionStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-sm text-slate-700 appearance-none h-9"
            >
              <option value="">조치상태 전체</option>
              <option value="complete">완전 완료</option>
              <option value="partial">부분 완료</option>
              <option value="in_progress">진행중</option>
            </select>
            <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>

          {/* 4. 위험도 */}
          <div className="relative w-[110px] flex-shrink-0">
            <select
              value={selectedRiskLevel}
              onChange={(e) => {
                setSelectedRiskLevel(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-sm text-slate-700 appearance-none h-9"
            >
              <option value="">위험도 전체</option>
              <option value="매우높음">매우높음</option>
              <option value="높음">높음</option>
            </select>
            <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>

          {/* 5. 조치유형 */}
          <div className="relative w-[130px] flex-shrink-0">
            <select
              value={selectedActionType}
              onChange={(e) => {
                setSelectedActionType(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-sm text-slate-700 appearance-none h-9"
            >
              <option value="">조치유형 전체</option>
              {activeActionTypes.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>

        {/* 페이지 보기 설정 (우측) */}
        <div className="flex items-center gap-2 pl-1 xl:pl-3 xl:border-l xl:border-slate-200/80 mt-1 xl:mt-0 flex-shrink-0">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
            보기 설정
          </span>
          <div className="relative w-[90px]">
            <select
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="w-full pl-3 pr-6 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px] font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-sm text-slate-700 appearance-none h-9"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}개씩
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </div>
      </div>

      {/* 상태별 카드 (클릭 가능) - 라벨 없음 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* 발생건수 */}
        <button
          onClick={() => {
            setSelectedStatusFilter('all');
            setPage(1);
          }}
          className={`rounded-lg p-6 transition-all cursor-pointer text-center ${selectedStatusFilter === 'all'
              ? 'border-2 border-blue-600 bg-blue-50'
              : 'border-2 border-blue-300 bg-blue-50 hover:border-blue-500'
            }`}
        >
          <div className="text-4xl font-bold text-blue-600">{statusCounts.all}</div>
          <div className="text-sm font-semibold text-blue-600 mt-2">전체 {statusCounts.all}건</div>
        </button>

        {/* 조치완료 */}
        <button
          onClick={() => {
            setSelectedStatusFilter('complete');
            setPage(1);
          }}
          className={`rounded-lg p-6 transition-all cursor-pointer text-center ${selectedStatusFilter === 'complete'
              ? 'border-2 border-green-600 bg-green-50'
              : 'border-2 border-green-300 bg-green-50 hover:border-green-500'
            }`}
        >
          <div className="text-4xl font-bold text-green-600">{statusCounts.complete}</div>
          <div className="text-sm font-semibold text-green-600 mt-2">완료 {statusCounts.complete}건</div>
        </button>

        {/* 부분완료 */}
        <button
          onClick={() => {
            setSelectedStatusFilter('partial');
            setPage(1);
          }}
          className={`rounded-lg p-6 transition-all cursor-pointer text-center ${selectedStatusFilter === 'partial'
              ? 'border-2 border-amber-600 bg-amber-50'
              : 'border-2 border-amber-300 bg-amber-50 hover:border-amber-500'
            }`}
        >
          <div className="text-4xl font-bold text-amber-600">{statusCounts.partial}</div>
          <div className="text-sm font-semibold text-amber-600 mt-2">부분완료 {statusCounts.partial}건</div>
        </button>

        {/* 진행중 */}
        <button
          onClick={() => {
            setSelectedStatusFilter('in_progress');
            setPage(1);
          }}
          className={`rounded-lg p-6 transition-all cursor-pointer text-center ${selectedStatusFilter === 'in_progress'
              ? 'border-2 border-gray-600 bg-gray-100'
              : 'border-2 border-gray-300 bg-gray-50 hover:border-gray-500'
            }`}
        >
          <div className="text-4xl font-bold text-gray-600">{statusCounts.in_progress}</div>
          <div className="text-sm font-semibold text-gray-600 mt-2">진행중 {statusCounts.in_progress}건</div>
        </button>
      </div>

      {/* 필터 결과 요약 카드 */}
      {hasFilters && summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <StatCard label="전체" value={summary.total} color="text-gray-900" />
          <StatCard label="완료" value={summary.completed} color="text-emerald-600" />
          <StatCard label="진행중" value={summary.in_progress} color="text-blue-600" />
        </div>
      )}

      {/* 헤더 및 외부 액션 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h3 className="text-xl font-black text-slate-800 tracking-tight">호출부호 목록</h3>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            양쪽 항공사 조치상태 비교 현황
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="호출부호, 항공사 검색"
              className="h-9 w-[220px] border border-slate-200 rounded-xl bg-white pl-9 pr-8 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setPage(1); }}
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
            onClick={handleReset}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 rounded-xl transition-all shadow-sm"
          >
            초기화
          </button>
          <button
            onClick={() => {
              const excelRows = filteredRows.map((callsign) => ({
                '호출부호 쌍': callsign.callsign_pair,
                '위험도': callsign.risk_level,
                '유사도': callsign.similarity || '-',
                '오류유형': callsign.error_type || '-',
                '발생횟수': callsign.occurrence_count || 0,
                '최근발생일': callsign.last_occurred_at
                  ? new Date(callsign.last_occurred_at).toLocaleDateString('ko-KR')
                  : '-',
                '조치유형': callsign.action_type || '-',
                '처리일자': callsign.action_completed_at
                  ? new Date(callsign.action_completed_at).toLocaleDateString('ko-KR')
                  : '-',
                '자사(코드)': callsign.my_airline_code || '-',
                '자사 조치상태': getActionStatusMeta(callsign.my_action_status).label,
                '타사(코드)': callsign.other_airline_code || '-',
                '타사 조치상태': getActionStatusMeta(callsign.other_action_status).label,
                '조치 상태': callsign.final_status === 'complete' ? '완전 완료' : callsign.final_status === 'partial' ? '부분 완료' : '진행중',
                '등록일': callsign.uploaded_at
                  ? new Date(callsign.uploaded_at).toLocaleDateString('ko-KR')
                  : '-',
              }));
              const ws = XLSX.utils.json_to_sheet(excelRows);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, '호출부호 현황');
              XLSX.writeFile(wb, `호출부호현황_${new Date().toLocaleDateString('ko-KR')}.xlsx`);
            }}
            disabled={filteredRows.length === 0}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-indigo-600/20"
          >
            📊 Excel 저장
          </button>
          <button
            onClick={() => {
              // 새로고침 로직
              callsignsQuery.refetch();
              statsQuery.refetch();
            }}
            className="px-4 py-2 bg-slate-800 text-white text-sm font-bold hover:bg-slate-700 rounded-xl transition-all shadow-md"
          >
            새로고침
          </button>
        </div>
      </div>

      {/* 호출부호 테이블 영역 */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 overflow-hidden">
        {filteredRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100/80">
                  <th className="px-3 py-2.5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    호출부호
                  </th>
                  <th className="px-3 py-2.5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    위험도
                  </th>
                  <th className="px-3 py-2.5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    유사도
                  </th>
                  <th className="px-3 py-2.5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    오류유형
                  </th>
                  <th className="px-3 py-2.5 text-center text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    발생
                  </th>
                  <th className="px-3 py-2.5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    최근발생일
                  </th>
                  <th className="px-3 py-2.5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    조치유형
                  </th>
                  <th className="px-3 py-2.5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    처리일자
                  </th>
                  <th className="px-3 py-2.5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    자사 조치
                  </th>
                  <th className="px-3 py-2.5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    타사 조치
                  </th>
                  <th className="px-3 py-2.5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    상태
                  </th>
                  <th className="px-3 py-2.5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    등록일
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredRows.map((callsign) => (
                  <tr
                    key={callsign.id}
                    className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedCallsignForDetail(callsign);
                      setIsCallsignDetailModalOpen(true);
                    }}
                  >
                    {/* 호출부호 - 외항사는 주황색, 국내항공사는 숫자 동일 시 파란색/다르면 빨간색 */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-[15px] font-bold">
                      {(() => {
                        const myCode = callsign.my_airline_code || callsign.my_callsign?.slice(0, 3) || '';
                        const otherCode = callsign.other_airline_code || callsign.other_callsign?.slice(0, 3) || '';
                        const isMyDomestic = DOMESTIC_AIRLINE_CODES.has(myCode);
                        const isOtherDomestic = DOMESTIC_AIRLINE_CODES.has(otherCode);
                        const myNum = getCallsignNum(callsign.my_callsign || '');
                        const otherNum = getCallsignNum(callsign.other_callsign || '');
                        const isSameNum = myNum && otherNum && myNum === otherNum;
                        const myColor = isMyDomestic ? 'text-blue-600' : 'text-orange-500';
                        const otherColor = isOtherDomestic
                          ? (isSameNum ? 'text-blue-600' : 'text-red-500')
                          : 'text-orange-500';
                        return (
                          <span>
                            <span className={myColor}>{callsign.my_callsign}</span>
                            <span className="text-slate-400"> | </span>
                            <span className={otherColor}>{callsign.other_callsign}</span>
                          </span>
                        );
                      })()}
                    </td>

                    {/* 위험도 */}
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-black tracking-wide whitespace-nowrap ${callsign.risk_level === '매우높음'
                          ? 'bg-red-500 text-white ring-1 ring-red-600/30'
                          : callsign.risk_level === '높음'
                            ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-400/40'
                            : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20'
                          }`}
                      >
                        {callsign.risk_level}
                      </span>
                    </td>

                    {/* 유사도 */}
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap ${callsign.similarity === '매우높음'
                          ? 'bg-red-500 text-white'
                          : callsign.similarity === '높음'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-slate-50 text-slate-600'
                          }`}
                      >
                        {callsign.similarity || '-'}
                      </span>
                    </td>

                    {/* 오류유형 */}
                    <td className="px-3 py-2.5 text-slate-600 font-medium whitespace-nowrap">{callsign.error_type || '-'}</td>

                    {/* 발생횟수 */}
                    <td className="px-3 py-2.5 font-bold text-slate-800 whitespace-nowrap text-center text-[15px]">{callsign.occurrence_count ?? 0}</td>

                    {/* 최근 발생일 */}
                    <td className="px-3 py-2.5 text-slate-500 font-medium whitespace-nowrap text-[13px]">
                      {callsign.last_occurred_at
                        ? new Date(callsign.last_occurred_at).toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                        })
                        : '-'}
                    </td>

                    {/* 조치유형 */}
                    <td className="px-3 py-2.5 text-slate-600 font-semibold whitespace-nowrap">
                      {callsign.action_type || '-'}
                    </td>

                    {/* 처리일자 */}
                    <td className="px-3 py-2.5 text-slate-500 font-medium whitespace-nowrap text-[13px]">
                      {callsign.action_completed_at
                        ? new Date(callsign.action_completed_at).toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                        })
                        : '-'}
                    </td>

                    {/* 자사 조치 상태 */}
                    <td className="px-3 py-2.5">
                      {(() => {
                        const meta = getActionStatusMeta(callsign.my_action_status);
                        return (
                          <div className="flex flex-col gap-1.5 justify-center">
                            <span className="text-[10px] font-bold text-slate-400">{callsign.my_airline_code}</span>
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-[8px] text-[10px] font-bold border whitespace-nowrap w-fit ${meta.bubble}`}
                            >
                              {meta.label}
                            </span>
                          </div>
                        );
                      })()}
                    </td>

                    {/* 타사 조치 상태 */}
                    <td className="px-3 py-2.5">
                      {(() => {
                        const meta = getActionStatusMeta(callsign.other_action_status);
                        return (
                          <div className="flex flex-col gap-1.5 justify-center">
                            <span className="text-[10px] font-bold text-slate-400">{callsign.other_airline_code || '-'}</span>
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-[8px] text-[10px] font-bold border whitespace-nowrap w-fit ${meta.bubble}`}
                            >
                              {meta.label}
                            </span>
                          </div>
                        );
                      })()}
                    </td>

                    {/* 전체 완료 여부 - 3가지 상태 */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-1.5 justify-center">
                        {callsign.final_status === 'complete' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-[8px] text-[10px] font-bold border bg-emerald-50 text-emerald-600 border-emerald-100 whitespace-nowrap w-fit">
                            ✓ 완전 완료
                          </span>
                        ) : callsign.final_status === 'partial' ? (
                          <>
                            <span className="inline-flex items-center px-2.5 py-1 rounded-[8px] text-[10px] font-bold border bg-amber-50 text-amber-600 border-amber-100 whitespace-nowrap w-fit">
                              ◐ 부분 완료
                            </span>
                            <span className="text-[9px] font-semibold text-slate-400">
                              {callsign.my_action_status === 'completed' && callsign.other_action_status !== 'completed'
                                ? `${callsign.my_airline_code} 완료`
                                : callsign.my_action_status !== 'completed' && callsign.other_action_status === 'completed'
                                  ? `${callsign.other_airline_code} 완료`
                                  : '미조치'}
                            </span>
                          </>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-[8px] text-[10px] font-bold border bg-slate-50 text-slate-600 border-slate-100 whitespace-nowrap w-fit">
                            ○ 진행중
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 등록일 */}
                    <td className="px-3 py-2.5 text-slate-400 font-medium whitespace-nowrap text-[13px]">
                      {callsign.uploaded_at
                        ? new Date(callsign.uploaded_at).toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                        })
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-8 py-32 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No Data</p>
          </div>
        )}

        {/* 페이지네이션 */}
        {filteredRows.length > 0 && (
          <div className="border-t border-slate-100/50 bg-white">
            <Pagination page={page} totalPages={computedTotalPages} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* 호출부호 상세 모달 */}
      {isCallsignDetailModalOpen && selectedCallsignForDetail && callsignDetailMeta && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 overflow-y-auto"
          onClick={() => setIsCallsignDetailModalOpen(false)}
        >
          <div
            className="w-[900px] max-w-[95vw] bg-white rounded-xl shadow-2xl shadow-black/20 border border-gray-200 p-5 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black">
                  {(() => {
                    const myNum = getCallsignNum(selectedCallsignForDetail.my_callsign || '');
                    const otherNum = getCallsignNum(selectedCallsignForDetail.other_callsign || '');
                    const isSameNum = myNum && otherNum && myNum === otherNum;
                    return (
                      <>
                        <span className="text-blue-500">{selectedCallsignForDetail.my_callsign}</span>
                        <span className="text-slate-500"> | </span>
                        <span className={isSameNum ? 'text-blue-500' : 'text-rose-500'}>
                          {selectedCallsignForDetail.other_callsign}
                        </span>
                      </>
                    );
                  })()}
                </h2>
                <p className="text-sm text-gray-500 mt-2">발생내역 상세정보</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCallsignDetailModalOpen(false)}
                className="text-2xl text-gray-400 hover:text-gray-600 transition-colors"
              >
                ×
              </button>
            </div>

            {/* 상세정보 그리드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">발생건수</p>
                <p className="text-xl font-black text-rose-500">{callsignDetailMeta.occurrenceCount}건</p>
              </div>
              <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">최근 발생일</p>
                <p className="text-sm font-bold text-gray-900">{formatDisplayDate(callsignDetailMeta.lastOccurredAt)}</p>
              </div>
              <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">유사성</p>
                <p className="text-sm font-bold text-gray-900">{callsignDetailMeta.similarity}</p>
              </div>
              <div className="px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">오류가능성</p>
                <p className="text-sm font-bold text-gray-900">{callsignDetailMeta.riskLevel}</p>
              </div>
            </div>

            {/* 오류 정보 */}
            <div className="flex items-center gap-6 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">오류유형</span>
                <span className="text-sm font-bold text-gray-900">{callsignDetailMeta.errorType}</span>
              </div>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">세부오류</span>
                <span className="text-sm font-bold text-gray-900">{callsignDetailMeta.subError}</span>
              </div>
            </div>

            {/* 항공사 조치 상세내용 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {/* 자사 조치 */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-bold text-blue-600 mb-3 uppercase tracking-wide">
                  ✈ 자사 조치 ({callsignDetailMeta.myAirlineCode})
                </p>
                {callsignDetailMeta.myActionType ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 w-16 flex-shrink-0">조치유형</span>
                      <span className="text-sm font-bold text-gray-900">{callsignDetailMeta.myActionType}</span>
                    </div>
                    {callsignDetailMeta.myManagerName && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 w-16 flex-shrink-0">담당자</span>
                        <span className="text-sm text-gray-700">{callsignDetailMeta.myManagerName}</span>
                      </div>
                    )}
                    {callsignDetailMeta.myCompletedAt && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 w-16 flex-shrink-0">처리일자</span>
                        <span className="text-sm text-gray-700">{formatDisplayDate(callsignDetailMeta.myCompletedAt)}</span>
                      </div>
                    )}
                    {callsignDetailMeta.myActionDescription && (
                      <div className="mt-2 pt-2 border-t border-blue-200">
                        <span className="text-xs font-semibold text-slate-400 block mb-1">상세내용</span>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{callsignDetailMeta.myActionDescription}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 font-medium">미등록</p>
                )}
              </div>

              {/* 타사 조치 */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">
                  ✈ 타사 조치 ({callsignDetailMeta.otherAirlineCode})
                </p>
                {callsignDetailMeta.otherActionType ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-500 w-16 flex-shrink-0">조치유형</span>
                      <span className="text-sm font-bold text-gray-900">{callsignDetailMeta.otherActionType}</span>
                    </div>
                    {callsignDetailMeta.otherManagerName && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 w-16 flex-shrink-0">담당자</span>
                        <span className="text-sm text-gray-700">{callsignDetailMeta.otherManagerName}</span>
                      </div>
                    )}
                    {callsignDetailMeta.otherCompletedAt && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-500 w-16 flex-shrink-0">처리일자</span>
                        <span className="text-sm text-gray-700">{formatDisplayDate(callsignDetailMeta.otherCompletedAt)}</span>
                      </div>
                    )}
                    {callsignDetailMeta.otherActionDescription && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <span className="text-xs font-semibold text-slate-400 block mb-1">상세내용</span>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{callsignDetailMeta.otherActionDescription}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 font-medium">미등록</p>
                )}
              </div>
            </div>

            {/* 오류유형별 집계 (동적) */}
            {Object.keys(callsignDetailMeta.errorTypeCounts).length > 0 && (() => {
              const entries = Object.entries(callsignDetailMeta.errorTypeCounts).sort((a, b) => b[1] - a[1]);
              return (
                <div className={`grid gap-2 mb-4`} style={{ gridTemplateColumns: `repeat(${Math.min(entries.length, 4)}, minmax(0, 1fr))` }}>
                  {entries.map(([type, count]) => {
                    const p = getErrorTypeColor(type);
                    return (
                      <div key={type} className={`px-3 py-2 ${p.bg} border ${p.border} rounded-lg flex items-center justify-between gap-2`}>
                        <p className={`text-xs font-semibold ${p.label} truncate`}>{type}</p>
                        <p className={`text-sm font-black ${p.label} shrink-0`}>{count}건</p>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* 발생이력 섹션 */}
            {callsignDetailMeta.occurrenceDates && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">🕐 발생이력</p>
                <div className="flex flex-wrap gap-2">
                  {callsignDetailMeta.occurrenceDates
                    .split(',')
                    .filter((d: string) => d.trim())
                    .slice(0, 15)
                    .map((time: string, idx: number) => (
                      <span
                        key={idx}
                        className="inline-block bg-white border border-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-xs font-semibold"
                      >
                        {time.trim()}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
