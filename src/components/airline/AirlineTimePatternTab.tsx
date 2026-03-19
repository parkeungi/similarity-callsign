// 항공사 시간대별 충돌 패턴 분석 탭 - 해당 항공사 호출부호 쌍의 시간 패턴 분류
'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useAirlineTimePattern } from '@/hooks/useAirlineTimePattern';
import type { TimePatternItem } from '@/hooks/useTimePatternStats';
import { format, subDays, subMonths } from 'date-fns';

const PATTERN_CONFIG = {
  fixed: { label: '고정시간 반복', color: '#dc2626', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  roundtrip: { label: '왕복편 패턴', color: '#f59e0b', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  scattered: { label: '분산형', color: '#6b7280', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
};

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}시`;
}

function PatternBadge({ type }: { type: 'fixed' | 'roundtrip' | 'scattered' }) {
  const config = PATTERN_CONFIG[type];
  return (
    <span className={`inline-block text-[11px] px-2 py-0.5 font-bold border ${config.bg} ${config.text} ${config.border}`}>
      {config.label}
    </span>
  );
}

type QuickRange = '1w' | '2w' | '1m' | '3m' | 'all';

interface AirlineTimePatternTabProps {
  airlineId: string | undefined;
  airlineCode: string;
}

export function AirlineTimePatternTab({ airlineId, airlineCode }: AirlineTimePatternTabProps) {
  const [quickRange, setQuickRange] = useState<QuickRange>('1m');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { dateFrom, dateTo } = useMemo(() => {
    if (customFrom && customTo) return { dateFrom: customFrom, dateTo: customTo };
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    switch (quickRange) {
      case '1w': return { dateFrom: format(subDays(now, 7), 'yyyy-MM-dd'), dateTo: todayStr };
      case '2w': return { dateFrom: format(subDays(now, 14), 'yyyy-MM-dd'), dateTo: todayStr };
      case '1m': return { dateFrom: format(subMonths(now, 1), 'yyyy-MM-dd'), dateTo: todayStr };
      case '3m': return { dateFrom: format(subMonths(now, 3), 'yyyy-MM-dd'), dateTo: todayStr };
      case 'all': return { dateFrom: undefined as string | undefined, dateTo: undefined as string | undefined };
    }
  }, [quickRange, customFrom, customTo]);

  const { data: stats, isLoading, error } = useAirlineTimePattern(airlineId, { minCount: 2, dateFrom, dateTo });
  const [selectedPattern, setSelectedPattern] = useState<'all' | 'fixed' | 'roundtrip' | 'scattered'>('all');
  const [expandedPair, setExpandedPair] = useState<string | null>(null);

  // hooks는 모든 조건부 return 위에 배치 (React hooks 규칙)
  const items = useMemo(() => stats?.data ?? [], [stats?.data]);
  const summary = stats?.summary ?? { total: 0, fixed: 0, roundtrip: 0, scattered: 0, structuralRate: 0 };
  const hourlyDistribution = useMemo(() => stats?.hourlyDistribution ?? [], [stats?.hourlyDistribution]);

  const filteredItems = useMemo(
    () => selectedPattern === 'all' ? items : items.filter((i) => i.pattern_type === selectedPattern),
    [items, selectedPattern]
  );

  const maxHourCount = useMemo(
    () => Math.max(...hourlyDistribution.map((h) => h.count), 1),
    [hourlyDistribution]
  );

  const handleQuickRange = (range: QuickRange) => {
    setQuickRange(range);
    setCustomFrom('');
    setCustomTo('');
  };

  const header = (
    <div className="flex items-center justify-between mb-5">
      <h3 className="text-lg font-bold text-gray-900">시간대별 충돌 패턴 분석</h3>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 border border-gray-200 bg-white px-3 h-9">
          <input
            type="date"
            value={customFrom || dateFrom || ''}
            onChange={(e) => { setCustomFrom(e.target.value); setQuickRange('all'); }}
            className="w-[120px] border-none bg-transparent p-0 text-sm font-semibold text-gray-900 outline-none"
          />
          <span className="text-sm text-gray-300">~</span>
          <input
            type="date"
            value={customTo || dateTo || ''}
            onChange={(e) => { setCustomTo(e.target.value); setQuickRange('all'); }}
            className="w-[120px] border-none bg-transparent p-0 text-sm font-semibold text-gray-900 outline-none"
          />
        </div>
        <div className="flex h-9 overflow-hidden border border-gray-200">
          {([['1w', '1주'], ['2w', '2주'], ['1m', '1개월'], ['3m', '3개월'], ['all', '전체']] as [QuickRange, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => handleQuickRange(key)}
              className={`px-3 text-[12px] font-bold transition-colors border-r border-gray-200 last:border-r-0 ${
                quickRange === key && !customFrom && !customTo
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="bg-white shadow-sm border border-gray-200 p-6">
        {header}
        <div className="h-64 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">데이터 로딩 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow-sm border border-gray-200 p-6">
        {header}
        <div className="h-64 flex items-center justify-center">
          <p className="text-red-500 text-sm">데이터를 불러올 수 없습니다: {error.message}</p>
        </div>
      </div>
    );
  }

  if (!stats || items.length === 0) {
    return (
      <div className="bg-white shadow-sm border border-gray-200 p-6">
        {header}
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-400 text-sm">시간대별 패턴 데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {/* KPI 카드 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 p-4 shadow-sm">
          <div className="text-xs text-gray-500 mb-1">분석 대상 (2건+)</div>
          <div className="text-2xl font-black text-gray-900">{summary.total}<span className="text-sm font-bold text-gray-500 ml-1">쌍</span></div>
        </div>
        <button
          onClick={() => setSelectedPattern(selectedPattern === 'fixed' ? 'all' : 'fixed')}
          className={`text-left border p-4 shadow-sm transition-colors ${selectedPattern === 'fixed' ? 'bg-red-50 border-red-300' : 'bg-white border-gray-200 hover:bg-red-50'}`}
        >
          <div className="text-xs text-gray-500 mb-1">고정시간 반복</div>
          <div className="text-2xl font-black text-red-600">{summary.fixed}<span className="text-sm font-bold text-red-400 ml-1">쌍</span></div>
        </button>
        <button
          onClick={() => setSelectedPattern(selectedPattern === 'roundtrip' ? 'all' : 'roundtrip')}
          className={`text-left border p-4 shadow-sm transition-colors ${selectedPattern === 'roundtrip' ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200 hover:bg-amber-50'}`}
        >
          <div className="text-xs text-gray-500 mb-1">왕복편 패턴</div>
          <div className="text-2xl font-black text-amber-600">{summary.roundtrip}<span className="text-sm font-bold text-amber-400 ml-1">쌍</span></div>
        </button>
        <div className="bg-white border border-gray-200 p-4 shadow-sm">
          <div className="text-xs text-gray-500 mb-1">구조적 충돌 비율</div>
          <div className="text-2xl font-black text-gray-900">{summary.structuralRate}<span className="text-sm font-bold text-gray-500 ml-1">%</span></div>
        </div>
      </div>

      {/* 24시간 발생 분포 바차트 */}
      <div className="bg-white border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900 mb-4">24시간 발생 분포</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={hourlyDistribution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="hour"
              tickFormatter={(h) => `${h}`}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              interval={0}
            />
            <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} width={30} />
            <Tooltip
              formatter={(value: any) => [`${value}건`, '발생']}
              labelFormatter={(h) => `${String(h).padStart(2, '0')}:00 ~ ${String(h).padStart(2, '0')}:59`}
            />
            <Bar dataKey="count" radius={0}>
              {hourlyDistribution.map((entry, index) => {
                const intensity = entry.count / maxHourCount;
                const r = Math.round(37 + (220 - 37) * intensity);
                const g = Math.round(99 + (38 - 99) * intensity);
                const b = Math.round(235 + (38 - 235) * intensity);
                return <Cell key={index} fill={entry.count > 0 ? `rgb(${r},${g},${b})` : '#e5e7eb'} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 패턴 분류 테이블 */}
      <div className="bg-white border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">
            충돌 패턴 상세 ({filteredItems.length}건)
          </h3>
          <div className="flex gap-2">
            {(['all', 'fixed', 'roundtrip', 'scattered'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedPattern(type)}
                className={`px-3 py-1 text-[12px] font-bold border transition-colors ${
                  selectedPattern === type
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {type === 'all' ? '전체' : PATTERN_CONFIG[type].label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">호출부호 쌍</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">발생</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">패턴</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">집중 시간대</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">집중도</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">노선</th>
                <th className="px-4 py-2.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">섹터</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                    해당 기간에 분석 가능한 패턴 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <React.Fragment key={item.callsign_pair}>
                    <tr
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedPair(expandedPair === item.callsign_pair ? null : item.callsign_pair)}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono font-bold ${item.airline_code === airlineCode ? 'text-blue-700' : 'text-red-600'}`}>{item.my_callsign}</span>
                          <span className="text-gray-400">↔</span>
                          <span className={`font-mono font-bold ${item.other_airline_code === airlineCode ? 'text-blue-700' : 'text-red-600'}`}>
                            {item.other_callsign}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="font-black text-gray-900">{item.occ_count}</span>
                        <span className="text-gray-400 text-xs ml-0.5">건</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <PatternBadge type={item.pattern_type} />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-xs font-mono font-bold text-gray-700">
                          {item.primary_hours.length > 0
                            ? item.primary_hours.map(formatHour).join(', ')
                            : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <ConcentrationBar value={item.time_concentration} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">
                        <div>{item.departure_airport1}→{item.arrival_airport1}</div>
                        <div>{item.departure_airport2}→{item.arrival_airport2}</div>
                      </td>
                      <td className="px-4 py-2.5 text-center text-xs font-bold text-gray-600">{item.sector}</td>
                    </tr>
                    {expandedPair === item.callsign_pair && (
                      <tr>
                        <td colSpan={7} className="px-4 py-3 bg-gray-50">
                          <ExpandedOccurrences item={item} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 해석 가이드 */}
      <div className="bg-slate-50 border border-slate-200 p-5">
        <h4 className="text-sm font-bold text-slate-800 mb-3">해석 가이드</h4>
        <div className="grid grid-cols-3 gap-4 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <span className="inline-block w-3 h-3 bg-red-500 mt-0.5 shrink-0" />
            <div><strong>고정시간 반복</strong>: 매일 같은 시간대에 발생. 정기편 스케줄 충돌로, 편명 변경 없이는 해결 불가.</div>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-block w-3 h-3 bg-amber-500 mt-0.5 shrink-0" />
            <div><strong>왕복편 패턴</strong>: 두 시간대(6시간+ 간격)에 반복. 같은 항공기의 왕복 스케줄과 연관.</div>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-block w-3 h-3 bg-gray-400 mt-0.5 shrink-0" />
            <div><strong>분산형</strong>: 특정 시간대 집중 없이 비정기적 발생. 비정기편 또는 다양한 조건에서 발생.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConcentrationBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-red-500' : value >= 60 ? 'bg-amber-500' : 'bg-gray-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 bg-gray-200 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[11px] font-bold text-gray-600">{value}%</span>
    </div>
  );
}

function ExpandedOccurrences({ item }: { item: TimePatternItem }) {
  const byDate: Record<string, { time: string; error_type: string | null }[]> = {};
  item.occurrences.forEach((occ) => {
    const d = occ.date;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push({ time: occ.time, error_type: occ.error_type });
  });

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">발생 이력 상세</div>
      <div className="flex flex-wrap gap-3">
        {Object.entries(byDate)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, times]) => (
            <div key={date} className="bg-white border border-gray-200 px-3 py-2">
              <div className="text-[10px] font-bold text-gray-500 mb-1">
                {new Date(date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short' })}
              </div>
              <div className="flex flex-col gap-0.5">
                {times.map((t, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono font-bold text-gray-800">{t.time || '-'}</span>
                    {t.error_type && (
                      <span className={`text-[9px] px-1 py-0 font-bold ${
                        t.error_type === '조종사오류' ? 'bg-red-100 text-red-600' :
                        t.error_type === '관제사오류' ? 'bg-purple-100 text-purple-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {t.error_type === '조종사오류' ? '조종사' : t.error_type === '관제사오류' ? '관제사' : t.error_type}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>

      <MiniHeatmap occurrences={item.occurrences} />
    </div>
  );
}

function MiniHeatmap({ occurrences }: { occurrences: { time: string }[] }) {
  const hourCounts = useMemo(() => {
    const counts = new Array(24).fill(0);
    occurrences.forEach((o) => {
      if (!o.time) return;
      const h = parseInt(o.time.split(':')[0], 10);
      if (!isNaN(h) && h >= 0 && h < 24) counts[h]++;
    });
    return counts;
  }, [occurrences]);

  const maxCount = Math.max(...hourCounts, 1);

  return (
    <div className="mt-2">
      <div className="text-[10px] font-bold text-gray-400 mb-1">24시간 분포</div>
      <div className="flex gap-px">
        {hourCounts.map((count, h) => {
          const intensity = count / maxCount;
          return (
            <div
              key={h}
              className="flex-1 h-6 flex items-end justify-center"
              title={`${String(h).padStart(2, '0')}시: ${count}건`}
            >
              <div
                className="w-full"
                style={{
                  height: count > 0 ? `${Math.max(intensity * 100, 15)}%` : '2px',
                  backgroundColor: count > 0
                    ? `rgba(220, 38, 38, ${0.2 + intensity * 0.8})`
                    : '#f3f4f6',
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
      </div>
    </div>
  );
}
