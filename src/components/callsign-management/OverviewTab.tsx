'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { useCallsignsWithActions } from '@/hooks/useActions';
import { useAirlines } from '@/hooks/useAirlines';
import { useAuthStore } from '@/store/authStore';
import { StatCard } from './StatCard';
import { Callsign } from '@/types/action';

interface StatsResponse {
  total: number;
  veryHigh: number;
  high: number;
  low: number;
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
  const pageSizeOptions = [10, 30, 50, 100];
  const accessToken = useAuthStore((s) => s.accessToken);

  // 모달 상태
  const [selectedCallsignForDetail, setSelectedCallsignForDetail] = useState<Callsign | null>(null);
  const [isCallsignDetailModalOpen, setIsCallsignDetailModalOpen] = useState(false);

  const airlinesQuery = useAirlines();
  const callsignsQuery = useCallsignsWithActions({
    riskLevel: selectedRiskLevel || undefined,
    airlineId: selectedAirlineId || undefined,
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
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const params = new URLSearchParams();
      if (selectedRiskLevel) params.append('riskLevel', selectedRiskLevel);
      if (selectedAirlineId) params.append('airlineId', selectedAirlineId);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const response = await fetch(`/api/callsigns/stats?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

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
    low: 0,
  };

  const rows = callsignsQuery.data?.data ?? [];
  const pagination = callsignsQuery.data?.pagination;
  const summary = callsignsQuery.data?.summary;
  const totalItems = pagination?.total ?? 0;
  const totalPagesFromApi = pagination?.totalPages ?? 0;
  const computedTotalPages = totalPagesFromApi > 0 ? totalPagesFromApi : 1;
  const startItem = totalItems === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = totalItems === 0 ? 0 : Math.min(page * limit, totalItems);

  // 상태별 필터링
  const filteredRows = useMemo(() => {
    if (selectedStatusFilter === 'all') return rows;
    return rows.filter(r => r.final_status === selectedStatusFilter);
  }, [rows, selectedStatusFilter]);

  // 필터 적용 여부 확인
  const hasFilters = selectedRiskLevel || selectedAirlineId || selectedActionStatus;

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

  // 호출부호 상세정보 메타데이터 계산
  const callsignDetailMeta = useMemo(() => {
    if (!selectedCallsignForDetail) return null;
    return {
      occurrenceCount: selectedCallsignForDetail.occurrence_count ?? 0,
      firstOccurredAt: selectedCallsignForDetail.first_occurred_at ?? null,
      lastOccurredAt: selectedCallsignForDetail.last_occurred_at ?? null,
      similarity: selectedCallsignForDetail.similarity ?? '-',
      riskLevel: selectedCallsignForDetail.risk_level ?? '-',
      myCallsign: selectedCallsignForDetail.my_callsign ?? '-',
      otherCallsign: selectedCallsignForDetail.other_callsign ?? '-',
      errorType: selectedCallsignForDetail.error_type ?? '-',
      subError: selectedCallsignForDetail.sub_error ?? '-',
    };
  }, [selectedCallsignForDetail]);

  const handleReset = () => {
    setSelectedRiskLevel('');
    setSelectedAirlineId('');
    setSelectedActionStatus('');
    setSelectedActionType('');
    setSelectedStatusFilter('all');
    setDateFrom(getDefaultDateFrom());
    setDateTo(getDefaultDateTo());
    setPage(1);
  };

  // 상태별 카운팅 - 전체 데이터 기반 (페이지네이션 무시)
  const statusCounts = useMemo(() => {
    // summary가 있으면 (필터 적용 여부 관계없이) API 계산값 사용
    if (summary) {
      return {
        all: summary.total,
        complete: summary.completed,
        partial: summary.partial ?? 0,
        in_progress: summary.in_progress,
      };
    }

    // summary 없음: 전체 데이터 기반 카운팅 (fallback)
    return {
      all: totalItems,
      complete: rows.filter(r => r.final_status === 'complete').length,
      partial: rows.filter(r => r.final_status === 'partial').length,
      in_progress: rows.filter(r => r.final_status === 'in_progress').length,
    };
  }, [summary, totalItems, rows]);

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
      {/* 상태별 카드 (클릭 가능) - 라벨 없음 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* 발생건수 */}
        <button
          onClick={() => {
            setSelectedStatusFilter('all');
            setPage(1);
          }}
          className={`rounded-lg p-6 transition-all cursor-pointer text-center ${
            selectedStatusFilter === 'all'
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
          className={`rounded-lg p-6 transition-all cursor-pointer text-center ${
            selectedStatusFilter === 'complete'
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
          className={`rounded-lg p-6 transition-all cursor-pointer text-center ${
            selectedStatusFilter === 'partial'
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
          className={`rounded-lg p-6 transition-all cursor-pointer text-center ${
            selectedStatusFilter === 'in_progress'
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

      {/* 필터 영역 */}
      <div className="bg-slate-50/50 px-4 py-3 rounded-xl border border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* 드롭다운 및 날짜 (좌측) */}
        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
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
              <option value="낮음">낮음</option>
            </select>
            <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>

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
              <option value="편명 변경">편명 변경</option>
              <option value="브리핑 시행">브리핑 시행</option>
              <option value="모니터링 강화">모니터링 강화</option>
              <option value="절차 개선">절차 개선</option>
              <option value="시스템 개선">시스템 개선</option>
              <option value="기타">기타</option>
            </select>
            <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>

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

      {/* 호출부호 테이블 영역 */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 overflow-hidden">
        {filteredRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100/80">
                  <th className="px-6 py-5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    호출부호
                  </th>
                  <th className="px-6 py-5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    위험도
                  </th>
                  <th className="px-6 py-5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    유사도
                  </th>
                  <th className="px-6 py-5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    오류유형
                  </th>
                  <th className="px-6 py-5 text-center text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    발생
                  </th>
                  <th className="px-6 py-5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    최근발생일
                  </th>
                  <th className="px-6 py-5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    조치유형
                  </th>
                  <th className="px-6 py-5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    처리일자
                  </th>
                  <th className="px-6 py-5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    자사 조치
                  </th>
                  <th className="px-6 py-5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    타사 조치
                  </th>
                  <th className="px-6 py-5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    상태
                  </th>
                  <th className="px-6 py-5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
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
                    {/* 호출부호 */}
                    <td className="px-6 py-5 font-bold text-slate-800 whitespace-nowrap text-[15px]">{callsign.callsign_pair}</td>

                    {/* 위험도 */}
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-black tracking-wide whitespace-nowrap ${callsign.risk_level === '매우높음'
                          ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-500/20'
                          : callsign.risk_level === '높음'
                            ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-500/20'
                            : 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20'
                          }`}
                      >
                        {callsign.risk_level}
                      </span>
                    </td>

                    {/* 유사도 */}
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap ${callsign.similarity === '매우높음'
                          ? 'bg-rose-50 text-rose-600'
                          : callsign.similarity === '높음'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-slate-50 text-slate-600'
                          }`}
                      >
                        {callsign.similarity || '-'}
                      </span>
                    </td>

                    {/* 오류유형 */}
                    <td className="px-6 py-5 text-slate-600 font-medium whitespace-nowrap">{callsign.error_type || '-'}</td>

                    {/* 발생횟수 */}
                    <td className="px-6 py-5 font-bold text-slate-800 whitespace-nowrap text-center text-[15px]">{callsign.occurrence_count ?? 0}</td>

                    {/* 최근 발생일 */}
                    <td className="px-6 py-5 text-slate-500 font-medium whitespace-nowrap text-[13px]">
                      {callsign.last_occurred_at
                        ? new Date(callsign.last_occurred_at).toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                        })
                        : '-'}
                    </td>

                    {/* 조치유형 */}
                    <td className="px-6 py-5 text-slate-600 font-semibold whitespace-nowrap">
                      {callsign.action_type || '-'}
                    </td>

                    {/* 처리일자 */}
                    <td className="px-6 py-5 text-slate-500 font-medium whitespace-nowrap text-[13px]">
                      {callsign.action_completed_at
                        ? new Date(callsign.action_completed_at).toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                        })
                        : '-'}
                    </td>

                    {/* 자사 조치 상태 */}
                    <td className="px-6 py-5">
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
                    <td className="px-6 py-5">
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
                    <td className="px-6 py-5">
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
                    <td className="px-6 py-5 text-slate-400 font-medium whitespace-nowrap text-[13px]">
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
          <div className="px-8 py-6 border-t border-slate-100/50 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white">
            <span className="text-[12px] font-bold text-slate-400 tracking-wide">
              총 <span className="text-slate-700">{totalItems}</span>건 중 {startItem}-{endItem}
            </span>
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200/60">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-1.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:shadow-none transition-all"
              >
                이전
              </button>
              <div className="w-px h-4 bg-slate-200"></div>
              <span className="px-3 text-sm font-bold text-slate-700">
                {page} <span className="text-slate-400 mx-1">/</span> {computedTotalPages}
              </span>
              <div className="w-px h-4 bg-slate-200"></div>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page >= computedTotalPages || rows.length === 0}
                className="px-4 py-1.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-white hover:text-indigo-600 hover:shadow-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:shadow-none transition-all"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 호출부호 상세 모달 */}
      {isCallsignDetailModalOpen && selectedCallsignForDetail && callsignDetailMeta && (
        <div
          className="fixed inset-0 bg-black/35 flex items-center justify-center z-50 overflow-y-auto"
          onClick={() => setIsCallsignDetailModalOpen(false)}
        >
          <div
            className="w-[900px] max-w-[95vw] bg-white rounded-xl shadow-2xl p-8 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-gray-900">
                  {selectedCallsignForDetail.callsign_pair}
                </h2>
                <p className="text-sm text-gray-500 mt-2">발생내역 상세정보</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCallsignDetailModalOpen(false)}
                className="text-2xl text-gray-400 hover:text-gray-600 transition"
              >
                ×
              </button>
            </div>

            {/* 상세정보 그리드 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">발생건수</p>
                <p className="text-2xl font-black text-orange-600">{callsignDetailMeta.occurrenceCount}건</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">최초 발생일</p>
                <p className="text-sm font-bold text-gray-900">{formatDisplayDate(callsignDetailMeta.firstOccurredAt)}</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">최근 발생일</p>
                <p className="text-sm font-bold text-gray-900">{formatDisplayDate(callsignDetailMeta.lastOccurredAt)}</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">유사성</p>
                <p className="text-sm font-bold text-gray-900">{callsignDetailMeta.similarity}</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">오류가능성</p>
                <p className="text-sm font-bold text-gray-900">{callsignDetailMeta.riskLevel}</p>
              </div>
            </div>

            {/* 호출부호 정보 */}
            <div className="grid grid-cols-2 gap-6 mb-6 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">자사 호출부호</p>
                <p className="text-lg font-bold text-gray-900">{callsignDetailMeta.myCallsign}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">타사 호출부호</p>
                <p className="text-lg font-bold text-gray-900">{callsignDetailMeta.otherCallsign}</p>
              </div>
            </div>

            {/* 오류 정보 */}
            <div className="grid grid-cols-2 gap-6 p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">오류 유형</p>
                <p className="text-sm font-bold text-gray-900">{callsignDetailMeta.errorType}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">세부 오류</p>
                <p className="text-sm font-bold text-gray-900">{callsignDetailMeta.subError}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
