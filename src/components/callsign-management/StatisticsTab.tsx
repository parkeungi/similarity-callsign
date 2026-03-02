'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCallsigns, useAllActions } from '@/hooks/useActions';
import { useAuthStore } from '@/store/authStore';
import { useActionTypeStats, useAirlineDetailStats } from '@/hooks/useAdminStats';
import { StatCard } from './StatCard';
import { ActionTypeDistributionChart } from '@/components/admin/ActionTypeDistributionChart';
import { format, addDays, addMonths, lastDayOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';

interface CallsignStatsResponse {
  total: number;
  veryHigh: number;
  high: number;
  low: number;
}

type PeriodType = 'daily' | 'monthly' | 'yearly';

// 날짜 범위 계산 함수
function getDateRange(period: PeriodType, offset: number): { dateFrom: string; dateTo: string } {
  const now = new Date();

  if (period === 'monthly') {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const first = format(date, 'yyyy-MM-01');
    const last = format(lastDayOfMonth(date), 'yyyy-MM-dd');
    return { dateFrom: first, dateTo: last };
  }

  if (period === 'daily') {
    const date = addDays(now, offset);
    const d = format(date, 'yyyy-MM-dd');
    return { dateFrom: d, dateTo: d };
  }

  if (period === 'yearly') {
    const year = now.getFullYear() + offset;
    return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
  }

  return { dateFrom: '', dateTo: '' };
}

// 표시 텍스트 함수
function getPeriodLabel(period: PeriodType, offset: number): string {
  const now = new Date();

  if (period === 'monthly') {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return format(date, 'yyyy년 M월', { locale: ko });
  }

  if (period === 'daily') {
    const date = addDays(now, offset);
    return format(date, 'yyyy년 M월 d일', { locale: ko });
  }

  if (period === 'yearly') {
    const year = now.getFullYear() + offset;
    return `${year}년`;
  }

  return '';
}

export function StatisticsTab() {
  const [period, setPeriod] = useState<PeriodType>('monthly');
  const [periodOffset, setPeriodOffset] = useState(0);
  const accessToken = useAuthStore((s) => s.accessToken);

  // 날짜 범위 계산
  const dateRange = useMemo(() => getDateRange(period, periodOffset), [period, periodOffset]);
  const periodLabel = useMemo(() => getPeriodLabel(period, periodOffset), [period, periodOffset]);

  // 전체 호출부호 통계 (위험도별)
  const callsignStatsQuery = useQuery<CallsignStatsResponse>({
    queryKey: ['callsigns-stats', dateRange.dateFrom, dateRange.dateTo],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const params = new URLSearchParams();
      params.append('dateFrom', dateRange.dateFrom);
      params.append('dateTo', dateRange.dateTo);

      const response = await fetch(`/api/callsigns/stats?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('통계 조회 실패');
      }

      return (await response.json()) as CallsignStatsResponse;
    },
    enabled: !!accessToken,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // 조치 건수 및 상태별 집계
  const totalActionsQuery = useAllActions({ page: 1, limit: 1, dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo });
  const pendingActionsQuery = useAllActions({ page: 1, limit: 1, status: 'pending', dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo });
  const inProgressActionsQuery = useAllActions({ page: 1, limit: 1, status: 'in_progress', dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo });
  const completedActionsQuery = useAllActions({ page: 1, limit: 1, status: 'completed', dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo });

  // 항공사별 상세 통계 (서버 집계)
  const airlineDetailStatsQuery = useAirlineDetailStats(dateRange);

  // 조치 유형별 분포
  const actionTypeStatsQuery = useActionTypeStats(dateRange);

  // KPI 데이터 계산
  const totalCallsigns = callsignStatsQuery.data?.total ?? 0;
  const riskStats = callsignStatsQuery.data || { total: 0, veryHigh: 0, high: 0, low: 0 };
  const actionCounts = {
    total: totalActionsQuery.data?.pagination.total ?? 0,
    pending: pendingActionsQuery.data?.pagination.total ?? 0,
    inProgress: inProgressActionsQuery.data?.pagination.total ?? 0,
    completed: completedActionsQuery.data?.pagination.total ?? 0,
  };

  const isLoading =
    callsignStatsQuery.isLoading ||
    totalActionsQuery.isLoading ||
    pendingActionsQuery.isLoading ||
    inProgressActionsQuery.isLoading ||
    completedActionsQuery.isLoading ||
    airlineDetailStatsQuery.isLoading;

  if (isLoading) {
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
      {/* 시간 범위 선택 UI */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          {/* 주기 선택 버튼 */}
          <div className="flex gap-3">
            {(['daily', 'monthly', 'yearly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPeriod(p);
                  setPeriodOffset(0);
                }}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                  period === p
                    ? 'bg-indigo-500 text-white shadow-lg'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p === 'daily' ? '일별' : p === 'monthly' ? '월별' : '년간'}
              </button>
            ))}
          </div>

          {/* 이전/다음 네비게이션 */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={() => setPeriodOffset(periodOffset - 1)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="이전"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="min-w-[140px] text-center">
              <p className="text-lg font-bold text-slate-800">{periodLabel}</p>
            </div>

            <button
              onClick={() => setPeriodOffset(periodOffset + 1)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="다음"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <StatCard label="총 호출부호" value={totalCallsigns} color="text-gray-900" />
        <StatCard label="미조치" value={actionCounts.pending} color="text-amber-600" />
        <StatCard label="진행중" value={actionCounts.inProgress} color="text-blue-600" />
        <StatCard label="완료" value={actionCounts.completed} color="text-emerald-600" />
      </div>

      {/* 위험도별 현황 */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 p-8">
        <h3 className="text-xl font-black text-slate-800 mb-8 tracking-tight">위험도별 현황</h3>
        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-end mb-3">
              <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wide">매우높음</span>
              <span className="text-sm font-black text-rose-600">{riskStats.veryHigh}건</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full transition-all duration-1000 ease-out relative"
                style={{
                  width: `${totalCallsigns > 0 ? (riskStats.veryHigh / totalCallsigns) * 100 : 0}%`,
                }}
              >
                <div className="absolute inset-0 bg-white/20 w-full rounded-full" style={{ maskImage: 'linear-gradient(to right, transparent, black)' }}></div>
              </div>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-end mb-3">
              <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wide">높음</span>
              <span className="text-sm font-black text-amber-500">{riskStats.high}건</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-out relative"
                style={{
                  width: `${totalCallsigns > 0 ? (riskStats.high / totalCallsigns) * 100 : 0}%`,
                }}
              >
                <div className="absolute inset-0 bg-white/20 w-full rounded-full" style={{ maskImage: 'linear-gradient(to right, transparent, black)' }}></div>
              </div>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-end mb-3">
              <span className="text-[13px] font-bold text-slate-500 uppercase tracking-wide">낮음</span>
              <span className="text-sm font-black text-emerald-500">{riskStats.low}건</span>
            </div>
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out relative"
                style={{
                  width: `${totalCallsigns > 0 ? (riskStats.low / totalCallsigns) * 100 : 0}%`,
                }}
              >
                <div className="absolute inset-0 bg-white/20 w-full rounded-full" style={{ maskImage: 'linear-gradient(to right, transparent, black)' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 항공사별 상세 통계 */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 overflow-hidden">
        {/* 헤더 */}
        <div className="px-8 py-7 border-b border-slate-100/80 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">항공사별 상세 통계</h3>
          </div>
        </div>

        {/* 테이블 */}
        {airlineDetailStatsQuery.data && airlineDetailStatsQuery.data.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white border-b border-slate-100">
                  <th className="px-8 py-5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider">
                    항공사
                  </th>
                  <th className="px-8 py-5 text-center text-[12px] font-bold text-slate-400 uppercase tracking-wider">
                    호출부호
                  </th>
                  <th className="px-8 py-5 text-center text-[12px] font-bold text-slate-400 uppercase tracking-wider">
                    조치 현황
                  </th>
                  <th className="px-8 py-5 text-center text-[12px] font-bold text-slate-400 uppercase tracking-wider">
                    조치율
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {airlineDetailStatsQuery.data.map((stat) => (
                  <tr key={stat.airline_id} className="group hover:bg-slate-50/80 transition-colors">
                    <td className="px-8 py-5 font-bold text-slate-800 text-[15px]">{stat.airline_code}</td>
                    <td className="px-8 py-5 text-center font-semibold text-slate-500">
                      {stat.total_callsigns}개
                    </td>
                    <td className="px-8 py-5 text-center font-medium">
                      <span className="text-indigo-500 font-bold px-1">{stat.in_progress_actions}건</span>
                      <span className="text-slate-300 px-1">/</span>
                      <span className="text-emerald-500 font-bold px-1">{stat.completed_actions}건</span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-bold ${stat.completion_rate > 80 ? 'bg-emerald-50 text-emerald-600' :
                          stat.completion_rate > 40 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                        {stat.completion_rate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-8 py-16 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path></svg>
            </div>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No Data</p>
          </div>
        )}
      </div>

      {/* 조치 유형별 분포 */}
      <ActionTypeDistributionChart dateRange={dateRange} />
    </div>
  );
}
