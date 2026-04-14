// 항공사별 조치현황 탭 - 전체 항공사 월별 검출·조치건수 비교 테이블 + 조치율 바 차트
'use client';

import React, { useMemo, useState } from 'react';
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
import { useAirlineMonthlyStats, AirlineMonthlyStatsItem } from '@/hooks/useAirlineMonthlyStats';

// 프리셋 기간 옵션 (직접조회는 별도 UI)
const PRESET_OPTIONS = [
    { label: '1개월', value: 1 },
    { label: '3개월', value: 3 },
    { label: '6개월', value: 6 },
    { label: '12개월', value: 12 },
];

type PeriodMode = 'preset' | 'custom';

function getActionRateColor(rate: number): string {
    if (rate >= 80) return 'text-emerald-600 bg-emerald-50';
    if (rate >= 50) return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
}

function getActionRateBarColor(rate: number): string {
    if (rate >= 80) return '#059669';
    if (rate >= 50) return '#d97706';
    return '#e11d48';
}

function formatMonthHeader(ym: string): string {
    // "YYYY-MM" → "YYYY.MM"
    return `${ym.slice(0, 4)}.${ym.slice(5, 7)}`;
}

/** YYYY-MM → 해당 월의 첫날 YYYY-MM-DD */
function ymToDateFrom(ym: string): string {
    return `${ym}-01`;
}

/** YYYY-MM → 해당 월의 마지막 날 YYYY-MM-DD */
function ymToDateTo(ym: string): string {
    const [y, m] = ym.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate(); // day=0은 전달의 마지막 날
    return `${ym}-${String(lastDay).padStart(2, '0')}`;
}

/** 현재 월을 YYYY-MM 형식으로 반환 */
function currentYM(): string {
    return new Date().toISOString().slice(0, 7);
}

/** N개월 전 첫달을 YYYY-MM 형식으로 반환
 *  day=1로 고정 후 setMonth → 월말 overflow 방지
 *  예) 3월 31일에 monthsAgoYM(2) → 2월(setDate(1) 없으면 3월로 overflow)
 */
function monthsAgoYM(n: number): string {
    const d = new Date();
    d.setDate(1); // day를 1로 고정해 setMonth overflow 방지
    d.setMonth(d.getMonth() - n + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface TooltipPayload {
    payload?: AirlineMonthlyStatsItem & { action_rate_display: number; name: string };
}

function ActionRateTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    if (!d) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 text-sm">
            <p className="font-bold text-gray-800 mb-1">{d.airline_name_ko}</p>
            <p className="text-gray-600">검출: <span className="font-semibold text-gray-900">{d.total_detection.toLocaleString()}건</span></p>
            <p className="text-gray-600">조치: <span className="font-semibold text-gray-900">{d.total_action.toLocaleString()}건</span></p>
            <p className="text-gray-600">조치율: <span className="font-semibold" style={{ color: getActionRateBarColor(d.action_rate) }}>{d.action_rate}%</span></p>
        </div>
    );
}

export function AirlineStatusOverviewTab() {
    const [periodMode, setPeriodMode] = useState<PeriodMode>('preset');
    const [selectedMonths, setSelectedMonths] = useState<number>(3);
    // 직접조회용 월 선택 (YYYY-MM)
    const [customFrom, setCustomFrom] = useState<string>(monthsAgoYM(3));
    const [customTo, setCustomTo] = useState<string>(currentYM());

    // 훅에 전달할 파라미터 계산
    const queryParams = useMemo(() => {
        if (periodMode === 'custom') {
            return {
                dateFrom: ymToDateFrom(customFrom),
                dateTo: ymToDateTo(customTo),
            };
        }
        return { months: selectedMonths };
    }, [periodMode, selectedMonths, customFrom, customTo]);

    const statsQuery = useAirlineMonthlyStats(queryParams);
    const { airlines = [], months = [] } = statsQuery.data ?? {};

    // KPI 집계
    const kpi = useMemo(() => {
        const totalDetection = airlines.reduce((sum, a) => sum + a.total_detection, 0);
        const totalAction = airlines.reduce((sum, a) => sum + a.total_action, 0);
        const avgActionRate = totalDetection > 0
            ? Math.round((totalAction / totalDetection) * 100 * 10) / 10
            : 0;
        const activeAirlines = airlines.filter(a => a.total_detection > 0).length;
        return { totalDetection, totalAction, avgActionRate, activeAirlines };
    }, [airlines]);

    // 바 차트 데이터
    const barData = useMemo<(AirlineMonthlyStatsItem & { action_rate_display: number; name: string })[]>(() =>
        airlines
            .filter(a => a.total_detection > 0)
            .map(a => ({
                ...a,
                action_rate_display: a.action_rate,
                name: a.airline_name_ko.length > 5
                    ? a.airline_name_ko.slice(0, 5) + '…'
                    : a.airline_name_ko,
            })),
        [airlines]
    );

    if (statsQuery.isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
                데이터를 불러오는 중...
            </div>
        );
    }

    if (statsQuery.isError) {
        return (
            <div className="flex items-center justify-center h-64 text-rose-500 text-sm">
                통계 조회 중 오류가 발생했습니다.
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* 기간 선택 UI */}
            <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-gray-500">조회 기간</span>

                {/* 프리셋 버튼 */}
                <div className="flex h-8 rounded border border-slate-200 overflow-hidden">
                    {PRESET_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => { setPeriodMode('preset'); setSelectedMonths(opt.value); }}
                            className={`px-4 text-xs font-semibold transition-colors border-l first:border-l-0 border-slate-200 ${
                                periodMode === 'preset' && selectedMonths === opt.value
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-white text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            최근 {opt.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => {
                            // 현재 프리셋 개월 수 기반으로 직접조회 기본값 동기화
                            setCustomFrom(monthsAgoYM(selectedMonths));
                            setCustomTo(currentYM());
                            setPeriodMode('custom');
                        }}
                        className={`px-4 text-xs font-semibold transition-colors border-l border-slate-200 ${
                            periodMode === 'custom'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        직접조회
                    </button>
                </div>

                {/* 직접조회: 월 단위 입력 */}
                {periodMode === 'custom' && (
                    <div className="flex items-center gap-2">
                        <input
                            type="month"
                            value={customFrom}
                            max={customTo}
                            onChange={e => setCustomFrom(e.target.value)}
                            className="h-8 border border-slate-200 rounded px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <span className="text-slate-400 text-xs font-semibold">~</span>
                        <input
                            type="month"
                            value={customTo}
                            min={customFrom}
                            max={currentYM()}
                            onChange={e => setCustomTo(e.target.value)}
                            className="h-8 border border-slate-200 rounded px-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                    </div>
                )}
            </div>

            {/* KPI 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">총 검출건수</p>
                    <p className="text-2xl font-bold text-gray-900">{kpi.totalDetection.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-1">유사호출부호 쌍</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">총 조치건수</p>
                    <p className="text-2xl font-bold text-gray-900">{kpi.totalAction.toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-1">완료 조치 합계</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">평균 조치율</p>
                    <p className={`text-2xl font-bold ${kpi.avgActionRate >= 80 ? 'text-emerald-600' : kpi.avgActionRate >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                        {kpi.avgActionRate}%
                    </p>
                    <p className="text-xs text-gray-400 mt-1">전 항공사 기준</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">활성 항공사</p>
                    <p className="text-2xl font-bold text-gray-900">{kpi.activeAirlines}</p>
                    <p className="text-xs text-gray-400 mt-1">검출이력 있는 항공사</p>
                </div>
            </div>

            {/* 조치율 바 차트 */}
            {barData.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-700 mb-4">항공사별 조치율 비교</h3>
                    <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
                            <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#6b7280' }} />
                            <Tooltip content={<ActionRateTooltip />} />
                            <Bar dataKey="action_rate_display" radius={[4, 4, 0, 0]} maxBarSize={48}>
                                {barData.map((entry) => (
                                    <Cell key={entry.airline_id} fill={getActionRateBarColor(entry.action_rate)} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-600 inline-block" />≥80% 양호</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-600 inline-block" />≥50% 보통</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-rose-600 inline-block" />&lt;50% 미흡</span>
                    </div>
                </div>
            )}

            {/* 월별 상세 테이블 */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="px-5 pt-5 pb-3 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-gray-700">월별 검출·조치 현황</h3>
                    <p className="text-xs text-gray-400 mt-0.5">검출건수 / 조치건수 — 조치율 뱃지</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap sticky left-0 bg-slate-50 z-10 min-w-[120px]">
                                    항공사
                                </th>
                                {months.map(m => (
                                    <th key={m} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap min-w-[90px]">
                                        {formatMonthHeader(m)}
                                    </th>
                                ))}
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap min-w-[110px] border-l border-slate-200">
                                    합계
                                </th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 whitespace-nowrap min-w-[80px]">
                                    조치율
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {airlines.length === 0 && (
                                <tr>
                                    <td colSpan={Math.max(months.length + 3, 1)} className="text-center py-12 text-gray-400 text-sm">
                                        데이터가 없습니다.
                                    </td>
                                </tr>
                            )}
                            {airlines.map(airline => (
                                <tr key={airline.airline_id} className="group hover:bg-slate-50 transition-colors">
                                    <td className="px-5 py-3 font-semibold text-gray-800 whitespace-nowrap sticky left-0 bg-white group-hover:bg-slate-50 z-10">
                                        {airline.airline_name_ko}
                                    </td>
                                    {months.map(m => {
                                        const entry = airline.monthly.find(e => e.month === m);
                                        const det = entry?.detection_count ?? 0;
                                        const act = entry?.action_count ?? 0;
                                        return (
                                            <td key={m} className="px-3 py-3 text-center whitespace-nowrap">
                                                {det === 0 ? (
                                                    <span className="text-gray-300">—</span>
                                                ) : (
                                                    <span className="text-gray-700">
                                                        <span className="font-medium">{det}</span>
                                                        <span className="text-gray-300 mx-0.5">/</span>
                                                        <span className={`font-semibold ${act === 0 ? 'text-gray-400' : 'text-indigo-600'}`}>{act}</span>
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="px-4 py-3 text-center border-l border-slate-200 whitespace-nowrap">
                                        <span className="font-semibold text-gray-800">{airline.total_detection.toLocaleString()}</span>
                                        <span className="text-gray-300 mx-1">/</span>
                                        <span className="font-bold text-indigo-600">{airline.total_action.toLocaleString()}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center whitespace-nowrap">
                                        {airline.total_detection > 0 ? (
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${getActionRateColor(airline.action_rate)}`}>
                                                {airline.action_rate}%
                                            </span>
                                        ) : (
                                            <span className="text-gray-300 text-xs">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
