// 사전조회 검색 통계 서브탭 - 일별추이·Top호출부호·시간대분포·항공사분포
'use client';

import { useSearchStats } from '@/hooks/useSearchStats';
import { StatCard } from './StatCard';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface SearchStatsSubTabProps {
  dateRange: { dateFrom: string; dateTo: string };
}

const COLORS = {
  rose: '#e11d48',
  amber: '#d97706',
  emerald: '#059669',
  blue: '#2563eb',
  purple: '#7c3aed',
  indigo: '#4f46e5',
};

const PIE_COLORS = ['#4f46e5', '#2563eb', '#059669', '#d97706', '#e11d48', '#7c3aed', '#0891b2', '#be185d', '#65a30d', '#ea580c'];

export function SearchStatsSubTab({ dateRange }: SearchStatsSubTabProps) {
  const { data, isLoading, isError } = useSearchStats(dateRange);

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Data...</p>
      </div>
    );
  }

  if (isError) {
    return <div className="py-20 text-center text-rose-500 text-sm font-semibold">통계 데이터를 불러오는 중 오류가 발생했습니다.</div>;
  }

  if (!data) {
    return <div className="py-20 text-center text-slate-400 text-sm">데이터 없음</div>;
  }

  const { summary, dailyTrend, topCallsigns, airlineDistribution, hourlyDistribution } = data;

  const airlinePieData = airlineDistribution.map((item, i) => ({
    name: item.airline_code,
    value: item.count,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  const formatDonutLabel = ({ percent }: { percent?: number }) => {
    if (!percent || percent === 0) return '';
    return `${(percent * 100).toFixed(0)}%`;
  };

  return (
    <div className="space-y-6">
      {/* 1. KPI 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <StatCard label="총 검색 횟수" value={summary.totalSearches} color="text-indigo-600" />
        <StatCard label="고유 호출부호" value={summary.uniqueCallsigns} color="text-blue-600" />
        <StatCard label="결과없음 검색" value={summary.zeroResultSearches} color="text-amber-600" />
        <StatCard label="평균 결과 수" value={Math.round(summary.avgResultCount)} color="text-emerald-600" />
      </div>

      {/* 2. 일별 검색 추이 + Top 10 호출부호 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 일별 추이 Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 flex flex-col h-[360px]">
          <h4 className="text-base font-bold text-slate-800 mb-4">
            일별 검색 추이 <span className="text-sm font-normal text-slate-400 ml-2">Daily Searches</span>
          </h4>
          <div className="flex-1 w-full relative">
            {dailyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSearchTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} tickCount={5} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: number) => [`${v}건`, '검색 횟수']}
                  />
                  <Area type="monotone" dataKey="count" stroke={COLORS.blue} strokeWidth={3} fillOpacity={1} fill="url(#colorSearchTrend)" activeDot={{ r: 6, strokeWidth: 0, fill: COLORS.blue }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">검색 이력 없음</div>
            )}
          </div>
        </div>

        {/* Top 10 검색 호출부호 */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 flex flex-col h-[360px]">
          <h4 className="text-base font-bold text-slate-800 mb-4">
            많이 검색된 호출부호 <span className="text-sm font-normal text-slate-400 ml-2">Top 10</span>
          </h4>
          <div className="flex-1 w-full relative">
            {topCallsigns.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCallsigns} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="callsign" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }} width={70} />
                  <Tooltip
                    cursor={{ fill: '#F1F5F9' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${value}회`, '검색 횟수']}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16} fill={COLORS.indigo} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">데이터 없음</div>
            )}
          </div>
        </div>
      </div>

      {/* 3. 시간대별 분포 + 항공사 분포 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 시간대별 검색 분포 */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 flex flex-col h-[320px]">
          <h4 className="text-sm font-bold text-slate-800 mb-2">
            시간대별 검색 분포 <span className="text-xs font-normal text-slate-400 ml-1">Hourly</span>
          </h4>
          <div className="flex-1 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 10 }} interval={2} dy={5} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} tickCount={5} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)' }}
                  formatter={(v: number) => [`${v}건`, '검색 횟수']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={14} fill={COLORS.indigo} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 항공사 분포 Donut */}
        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 flex flex-col h-[320px]">
          <h4 className="text-sm font-bold text-slate-800 mb-2">
            검색 결과 항공사 분포 <span className="text-xs font-normal text-slate-400 ml-1">Airlines</span>
          </h4>
          <div className="flex-1 flex flex-col items-center justify-center relative">
            {airlinePieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                    <Pie data={airlinePieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value" labelLine={false} label={formatDonutLabel}>
                      {airlinePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value}건`, '매칭 횟수']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-4 gap-y-1 w-full mt-2 justify-center">
                  {airlinePieData.map((entry, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px] font-medium">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-slate-600">{entry.name}</span>
                      <span className="text-slate-400">{entry.value}건</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-slate-400 text-xs text-center w-full">데이터 없음</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
