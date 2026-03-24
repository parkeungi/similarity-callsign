// 발생현황 통계 탭 - recharts 차트(위험도분포·항공사별·월별추세), GET /api/callsigns/stats 데이터 시각화
'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useActionTypeStats, useAirlineDetailStats, useSystemStats } from '@/hooks/useAdminStats';
import { useAllActions } from '@/hooks/useActions';
import { StatCard } from './StatCard';
import { format, addDays, lastDayOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { TimePatternChart } from '@/components/admin/charts/TimePatternChart';
import { SearchStatsSubTab } from './SearchStatsSubTab';

interface CallsignStatsResponse {
  total: number;
  veryHigh: number;
  high: number;
  low: number;
}

type PeriodType = 'daily' | 'monthly' | 'yearly' | 'custom';

const COLORS = {
  rose: '#e11d48',    // 매우높음, Error
  amber: '#d97706',   // 높음, Warning
  emerald: '#059669', // 낮음, Success
  blue: '#2563eb',    // Info
  purple: '#7c3aed',
  indigo: '#4f46e5',
};

// 날짜 범위 계산 함수
function getDateRange(period: PeriodType, offset: number, customFrom?: string, customTo?: string): { dateFrom: string; dateTo: string } {
  const now = new Date();
  if (period === 'custom') {
    return { dateFrom: customFrom || format(now, 'yyyy-MM-dd'), dateTo: customTo || format(now, 'yyyy-MM-dd') };
  }
  if (period === 'monthly') {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    return { dateFrom: format(date, 'yyyy-MM-01'), dateTo: format(lastDayOfMonth(date), 'yyyy-MM-dd') };
  }
  if (period === 'daily') {
    const d = format(addDays(now, offset), 'yyyy-MM-dd');
    return { dateFrom: d, dateTo: d };
  }
  if (period === 'yearly') {
    const year = now.getFullYear() + offset;
    return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
  }
  return { dateFrom: '', dateTo: '' };
}

// 표시 텍스트 함수
function getPeriodLabel(period: PeriodType, offset: number, customFrom?: string, customTo?: string): string {
  const now = new Date();
  if (period === 'custom') {
    if (customFrom === customTo) return format(new Date(customFrom + 'T00:00:00'), 'yyyy년 M월 d일', { locale: ko });
    return `${customFrom} ~ ${customTo}`;
  }
  if (period === 'monthly') {
    return format(new Date(now.getFullYear(), now.getMonth() + offset, 1), 'yyyy년 M월', { locale: ko });
  }
  if (period === 'daily') {
    return format(addDays(now, offset), 'yyyy년 M월 d일', { locale: ko });
  }
  if (period === 'yearly') {
    return `${now.getFullYear() + offset}년`;
  }
  return '';
}

type StatsSubTab = 'overview' | 'timePattern' | 'searchStats';

export function StatisticsTab() {
  const [statsSubTab, setStatsSubTab] = useState<StatsSubTab>('overview');
  const [period, setPeriod] = useState<PeriodType>('monthly');
  const [periodOffset, setPeriodOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const accessToken = useAuthStore((s) => s.accessToken);

  const dateRange = useMemo(() => getDateRange(period, periodOffset, customFrom, customTo), [period, periodOffset, customFrom, customTo]);
  const periodLabel = useMemo(() => getPeriodLabel(period, periodOffset, customFrom, customTo), [period, periodOffset, customFrom, customTo]);

  const callsignStatsQuery = useQuery<CallsignStatsResponse>({
    queryKey: ['callsigns-stats', dateRange.dateFrom, dateRange.dateTo],
    queryFn: async () => {
      const params = new URLSearchParams({ dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo });
      const res = await fetch(`/api/callsigns/stats?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error('통계 조회 실패');
      return res.json();
    },
    enabled: !!accessToken && statsSubTab === 'overview',
  });

  const isOverview = statsSubTab === 'overview';
  const totalActionsQuery = useAllActions({ page: 1, limit: 1, dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo }, { enabled: isOverview });
  const pendingActionsQuery = useAllActions({ page: 1, limit: 1, status: 'pending', dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo }, { enabled: isOverview });
  const inProgressActionsQuery = useAllActions({ page: 1, limit: 1, status: 'in_progress', dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo }, { enabled: isOverview });
  const completedActionsQuery = useAllActions({ page: 1, limit: 1, status: 'completed', dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo }, { enabled: isOverview });

  const airlineDetailStatsQuery = useAirlineDetailStats(dateRange);
  const sysStatsQuery = useSystemStats(dateRange);

  const totalCallsigns = callsignStatsQuery.data?.total ?? 0;
  const riskStats = callsignStatsQuery.data || { total: 0, veryHigh: 0, high: 0, low: 0 };
  const actionCounts = {
    total: totalActionsQuery.data?.pagination.total ?? 0,
    pending: pendingActionsQuery.data?.pagination.total ?? 0,
    inProgress: inProgressActionsQuery.data?.pagination.total ?? 0,
    completed: completedActionsQuery.data?.pagination.total ?? 0,
  };

  const sysData = sysStatsQuery.data;

  // 항공사 목록 정렬 (호출부호 많은 순)
  const sortedAirlineStats = useMemo(() => {
    if (!airlineDetailStatsQuery.data) return [];
    return [...airlineDetailStatsQuery.data].sort((a, b) => b.total_callsigns - a.total_callsigns);
  }, [airlineDetailStatsQuery.data]);

  // 도넛 차트 포맷터
  const formatDonutLabel = ({ percent }: { percent?: number }) => {
    if (!percent || percent === 0) return '';
    return `${(percent * 100).toFixed(0)}%`;
  };

  // Pie Chart Data
  const riskPieData = [
    { name: '매우높음', value: riskStats.veryHigh, color: COLORS.rose },
    { name: '높음', value: riskStats.high, color: COLORS.amber },
  ].filter(i => i.value > 0);

  const errorPieData = (sysData?.errorDistribution || []).map((err, i) => ({
    name: err.name,
    value: err.value,
    color: [COLORS.rose, COLORS.amber, COLORS.emerald, COLORS.blue][i % 4]
  })).filter(i => i.value > 0);

  const isOverviewLoading =
    callsignStatsQuery.isLoading || totalActionsQuery.isLoading || sysStatsQuery.isLoading || airlineDetailStatsQuery.isLoading;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* 서브탭 선택 */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setStatsSubTab('overview')}
          className={`px-5 py-2.5 text-sm font-bold transition-colors -mb-px ${
            statsSubTab === 'overview'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          기본 통계
        </button>
        <button
          onClick={() => setStatsSubTab('timePattern')}
          className={`px-5 py-2.5 text-sm font-bold transition-colors -mb-px ${
            statsSubTab === 'timePattern'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          시간대 패턴 분석
        </button>
        <button
          onClick={() => setStatsSubTab('searchStats')}
          className={`px-5 py-2.5 text-sm font-bold transition-colors -mb-px ${
            statsSubTab === 'searchStats'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          사전조회 통계
        </button>
      </div>

      {/* 시간대 패턴 분석 탭 */}
      {statsSubTab === 'timePattern' && <TimePatternChart />}

      {/* 시간 범위 선택 UI (overview + searchStats 공유) */}
      {(statsSubTab === 'overview' || statsSubTab === 'searchStats') && (
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 p-8">
        <div className="flex flex-col gap-6">
          <div className="flex gap-2 flex-wrap">
            {(['daily', 'monthly', 'yearly', 'custom'] as const).map((p) => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setPeriodOffset(0); }}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${period === p ? 'bg-indigo-500 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {p === 'daily' ? '일별' : p === 'monthly' ? '월별' : p === 'yearly' ? '년간' : '기간선택'}
              </button>
            ))}
          </div>

          {period === 'custom' ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">시작일</label>
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800" />
              </div>
              <div className="hidden sm:flex items-center pt-6 text-slate-400">~</div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">종료일</label>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-800" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 sm:gap-6 justify-center">
              <button onClick={() => setPeriodOffset(periodOffset - 1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
              <div className="min-w-[140px] text-center"><p className="text-lg font-bold text-slate-800">{periodLabel}</p></div>
              <button onClick={() => setPeriodOffset(periodOffset + 1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* 사전조회 통계 탭 */}
      {statsSubTab === 'searchStats' && <SearchStatsSubTab dateRange={dateRange} />}

      {/* 기본 통계 탭 */}
      {statsSubTab === 'overview' && <>
      {isOverviewLoading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Data...</p>
        </div>
      ) : <>
      {/* 2. KPI 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <StatCard label="총 호출부호" value={totalCallsigns} color="text-slate-800" />
        <StatCard label="대기 중 조치" value={actionCounts.pending} color="text-amber-600" />
        <StatCard label="진행중 조치" value={actionCounts.inProgress} color="text-blue-600" />
        <StatCard label="완료된 조치" value={actionCounts.completed} color="text-emerald-600" />
      </div>

      {/* 3. 중단 트렌드 (발생 추이 & Top 항공사) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 추세 Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 flex flex-col h-[360px]">
          <h4 className="text-base font-bold text-slate-800 mb-4">{period === 'monthly' || period === 'yearly' ? '상반기/연간 발생 추이' : '기간별 발생 추이'} <span className="text-sm font-normal text-slate-400 ml-2">Trends</span></h4>
          <div className="flex-1 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={(period === 'daily' || period === 'custom') ? sysData?.dailyTrend : sysData?.monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCountSys" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey={(period === 'daily' || period === 'custom') ? 'day' : 'month'} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} tickCount={5} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} formatter={(v: any) => [`${v}건`, '건수']} />
                <Area type="monotone" dataKey="count" stroke={COLORS.blue} strokeWidth={3} fillOpacity={1} fill="url(#colorCountSys)" activeDot={{ r: 6, strokeWidth: 0, fill: COLORS.blue }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 발생 Top 5 항공사 Bar Chart */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 flex flex-col h-[360px]">
          <h4 className="text-base font-bold text-slate-800 mb-4">빈발 항공사 <span className="text-sm font-normal text-slate-400 ml-2">Top 5</span></h4>
          <div className="flex-1 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sysData?.topAirlines || []} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 700 }} width={50} />
                <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)' }} formatter={(value: any) => [`${value}건`, '호출부호 건수']} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16} fill={COLORS.indigo} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4. 하단 다차원 분석 3종 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 위험도 분포 Donut */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 flex flex-col h-[280px]">
          <h4 className="text-sm font-bold text-slate-800 mb-2">위험도 분포 <span className="text-xs font-normal text-slate-400 ml-1">Risks</span></h4>
          <div className="flex-1 flex flex-col items-center justify-center relative">
            {riskPieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <Pie data={riskPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value" labelLine={false} label={formatDonutLabel}>
                      {riskPieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [`${value}건`, '위험도']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1 w-full mt-2">
                  {riskPieData.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px] font-medium">
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></div><span className="text-slate-600">{entry.name}</span></div>
                      <span className="text-slate-800">{entry.value}건</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (<div className="text-slate-400 text-xs text-center w-full">데이터 없음</div>)}
          </div>
        </div>

        {/* 오류 요인 비율 Donut */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 flex flex-col h-[280px]">
          <h4 className="text-sm font-bold text-slate-800 mb-2">주요 오류 요인 <span className="text-xs font-normal text-slate-400 ml-1">Errors</span></h4>
          <div className="flex-1 flex flex-col items-center justify-center relative">
            {errorPieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <Pie data={errorPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value" labelLine={false} label={formatDonutLabel}>
                      {errorPieData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [`${value}건`, '건수']} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-1 w-full mt-2">
                  {errorPieData.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px] font-medium">
                      <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></div><span className="text-slate-600">{entry.name}</span></div>
                      <span className="text-slate-800">{entry.value}건</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (<div className="text-slate-400 text-xs text-center w-full">데이터 없음</div>)}
          </div>
        </div>

        {/* 노선별 발생 분포 Bar */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 flex flex-col h-[280px]">
          <h4 className="text-sm font-bold text-slate-800 mb-2">주말/평일 및 노선 분석 <span className="text-xs font-normal text-slate-400 ml-1">Routes</span></h4>
          <div className="flex-1 w-full relative pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sysData?.routeDistribution || []} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }} width={75} />
                <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }} formatter={(value: any) => [`${value}건`, '건수']} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14} fill={COLORS.amber} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. 기존 항공사별 상세 테이블 (디자인 변경 없이 그대로 유지) */}
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 overflow-hidden">
        <div className="px-8 py-7 border-b border-slate-100/80 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">항공사별 상세 통계</h3>
          </div>
        </div>
        {sortedAirlineStats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white border-b border-slate-100">
                  <th className="px-8 py-5 text-left text-[12px] font-bold text-slate-400 uppercase tracking-wider">항공사</th>
                  <th className="px-8 py-5 text-center text-[12px] font-bold text-slate-400 uppercase tracking-wider">호출부호</th>
                  <th className="px-8 py-5 text-center text-[12px] font-bold text-slate-400 uppercase tracking-wider">조치 현황</th>
                  <th className="px-8 py-5 text-center text-[12px] font-bold text-slate-400 uppercase tracking-wider">조치율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedAirlineStats.map((stat) => (
                  <tr key={stat.airline_id} className="group hover:bg-slate-50/80 transition-colors">
                    <td className="px-8 py-5 font-bold text-slate-800 text-[15px]">{stat.airline_code}</td>
                    <td className="px-8 py-5 text-center font-semibold text-slate-500">{stat.total_callsigns}개</td>
                    <td className="px-8 py-5 text-center font-medium">
                      {stat.in_progress_actions > 0 && (<><span className="text-indigo-500 font-bold px-1">{stat.in_progress_actions}건</span><span className="text-slate-300 px-1">/</span></>)}
                      <span className="text-emerald-500 font-bold px-1">{stat.completed_actions}건</span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-lg text-xs font-bold ${stat.action_rate > 50 ? 'bg-emerald-50 text-emerald-600' : stat.action_rate > 20 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                        {stat.action_rate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-8 py-16 text-center flex flex-col items-center justify-center">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No Data</p>
          </div>
        )}
      </div>

      </>}</>}
    </div>
  );
}
