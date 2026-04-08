// 항공사 통계 탭 - recharts 기반 차트 4종(위험도 PieChart·월별 BarChart·오류유형 분포·조치현황 AreaChart), incidents 데이터 가공
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
} from 'recharts';
import { Incident, DateRangeType, RISK_LEVEL_ORDER } from '@/types/airline';
import { ActionStatisticsResponse } from '@/types/action';
import { AirlineTimePatternTab } from './AirlineTimePatternTab';

interface AirlineStatisticsTabProps {
    statsStartDate: string;
    statsEndDate: string;
    onStatsStartDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onStatsEndDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    statsActiveRange: DateRangeType;
    onApplyStatsQuickRange: (range: 'today' | '1w' | '2w' | '1m') => void;
    actionStatsLoading: boolean;
    actionStats: ActionStatisticsResponse | undefined;
    incidents: Incident[];
    airlineId: string | undefined;
    airlineCode: string;
    uploadBatch?: {
        uploads: { id: string; uploaded_at: string; file_name: string; success_count: number }[];
        selectedId: string;
        onChange: (id: string) => void;
    };
    uploadBatchActive?: boolean;
}

type StatsSubTab = 'overview' | 'timePattern';

const COLORS = {
    blue: '#2563eb',    // blue-600
    rose: '#e11d48',    // rose-600
    emerald: '#059669', // emerald-600
    amber: '#d97706',   // amber-600
    purple: '#7c3aed',  // violet-600
    indigo: '#4f46e5',  // indigo-600
    gray: '#4b5563',    // gray-600
};

const PIE_COLORS = [COLORS.blue, COLORS.rose, COLORS.emerald, COLORS.amber, COLORS.purple, COLORS.indigo];

export function AirlineStatisticsTab({
    statsStartDate,
    statsEndDate,
    onStatsStartDateChange,
    onStatsEndDateChange,
    statsActiveRange,
    onApplyStatsQuickRange,
    actionStatsLoading,
    actionStats,
    incidents,
    airlineId,
    airlineCode,
    uploadBatch,
    uploadBatchActive = false,
}: AirlineStatisticsTabProps) {
    const [statsSubTab, setStatsSubTab] = useState<StatsSubTab>('overview');

    // 조회 모드: 엑셀기준 / 기간선택
    const hasBatch = !!(uploadBatch && uploadBatch.uploads.length > 0);
    const [viewMode, setViewMode] = useState<'batch' | 'date'>('batch');
    const [selectedYM, setSelectedYM] = useState<string>('');

    const availableYMs = useMemo(() => {
        const uploads = uploadBatch?.uploads ?? [];
        return [...new Set(uploads.map(u => u.uploaded_at.slice(0, 7)))]
            .sort((a, b) => b.localeCompare(a));
    }, [uploadBatch?.uploads]);

    const filteredUploads = useMemo(() => {
        const uploads = uploadBatch?.uploads ?? [];
        if (!selectedYM) return uploads;
        return uploads.filter(u => u.uploaded_at.startsWith(selectedYM));
    }, [uploadBatch?.uploads, selectedYM]);

    useEffect(() => {
        const uploads = uploadBatch?.uploads;
        if (!uploads || uploads.length === 0) return;
        if (!selectedYM) setSelectedYM(uploads[0].uploaded_at.slice(0, 7));
    }, [uploadBatch?.uploads]);

    const firstFilteredUploadId = filteredUploads[0]?.id ?? '';
    useEffect(() => {
        if (viewMode !== 'batch') return;
        if (!uploadBatch || !firstFilteredUploadId) return;
        uploadBatch.onChange(firstFilteredUploadId);
    }, [firstFilteredUploadId, viewMode]);

    const handleViewModeChange = (mode: 'batch' | 'date') => {
        setViewMode(mode);
        if (mode === 'date' && uploadBatch) uploadBatch.onChange('');
    };

    // ==========================================
    // Derived Statistics Calculations
    // ==========================================

    // 1. Total Incidents in date range (업로드 배치 선택 시 날짜 필터 스킵)
    const visibleIncidents = useMemo(() => {
        if (uploadBatchActive) return incidents;
        const start = statsStartDate ? new Date(statsStartDate) : null;
        const end = statsEndDate ? new Date(statsEndDate) : null;

        return incidents.filter(inc => {
            if (!start || !end) return true;
            if (!inc.lastDate) return true;
            const d = new Date(inc.lastDate);
            if (Number.isNaN(d.getTime())) return true;
            return d >= start && d <= end;
        });
    }, [incidents, statsStartDate, statsEndDate, uploadBatchActive]);

    // 2. Risk Level Breakdown
    const riskStats = useMemo(() => {
        const counts: Record<string, number> = {
            '매우높음': 0,
            '높음': 0,
        };
        visibleIncidents.forEach(inc => {
            const risk = inc.risk || '높음';
            if (counts[risk] !== undefined) counts[risk]++;
        });

        return [
            { name: '매우높음', value: counts['매우높음'], color: COLORS.rose },
            { name: '높음', value: counts['높음'], color: COLORS.amber },
        ].filter(item => item.value > 0);
    }, [visibleIncidents]);

    // 3. Top 5 Frequent Callsigns/Routes (위험도 1순위, 발생 건수 2순위)
    const topCallsigns = useMemo(() => {
        const counts: Record<string, number> = {};
        const riskMap: Record<string, string> = {};

        visibleIncidents.forEach(inc => {
            const pair = inc.pair || 'Unknown';
            const incidentCount = Number(inc.count || 0);
            counts[pair] = (counts[pair] || 0) + incidentCount;
            // 동일 쌍에 여러 위험도가 존재할 수 있으므로 가장 높은 위험도를 유지
            const prev = RISK_LEVEL_ORDER[riskMap[pair] as keyof typeof RISK_LEVEL_ORDER] ?? 0;
            const curr = RISK_LEVEL_ORDER[inc.risk as keyof typeof RISK_LEVEL_ORDER] ?? 0;
            if (curr >= prev) {
                riskMap[pair] = inc.risk || '높음';
            }
        });

        return Object.entries(counts)
            .map(([name, count]) => ({ name, count, risk: riskMap[name] }))
            .sort((a, b) => {
                // 1차: 위험도 내림차순 (매우높음 > 높음 > 낮음)
                const riskA = RISK_LEVEL_ORDER[a.risk as keyof typeof RISK_LEVEL_ORDER] ?? 0;
                const riskB = RISK_LEVEL_ORDER[b.risk as keyof typeof RISK_LEVEL_ORDER] ?? 0;
                if (riskB !== riskA) return riskB - riskA;
                // 2차: 발생 건수 내림차순
                return b.count - a.count;
            })
            .slice(0, 5);
    }, [visibleIncidents]);

    // 4. Time of Day Trend (시간대별 발생 추이)
    const timeOfDayStats = useMemo(() => {
        const counts = new Array(24).fill(0);
        const start = statsStartDate ? new Date(statsStartDate) : null;
        const end = statsEndDate ? new Date(statsEndDate) : null;

        visibleIncidents.forEach(inc => {
            if (inc.occurrences) {
                inc.occurrences.forEach(occ => {
                    const occDate = occ.occurredDate ? new Date(occ.occurredDate) : null;
                    let isWithinRange = true;
                    if (occDate && start && end) {
                        isWithinRange = occDate >= start && occDate <= end;
                    }

                    if (isWithinRange && occ.occurredTime) {
                        const hourStr = occ.occurredTime.split(':')[0];
                        const hour = parseInt(hourStr, 10);
                        if (!isNaN(hour) && hour >= 0 && hour < 24) {
                            counts[hour]++;
                        }
                    }
                });
            }
        });
        return counts.map((count, hour) => ({
            name: `${hour.toString().padStart(2, '0')}시`,
            count
        }));
    }, [visibleIncidents, statsStartDate, statsEndDate]);

    // 5. Route Trend (노선별 발생 분포)
    const routeStats = useMemo(() => {
        const counts: Record<string, number> = {};
        visibleIncidents.forEach(inc => {
            const incidentCount = Number(inc.count || 0);
            const dep = inc.departureAirport || '미상';
            const arr = inc.arrivalAirport || '미상';
            if (dep === '미상' && arr === '미상') {
                counts['기타'] = (counts['기타'] || 0) + incidentCount;
                return;
            }
            const route = `${dep}-${arr}`;
            counts[route] = (counts[route] || 0) + incidentCount;
        });
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5) // 상위 5개 노선만 표시
            .filter(item => item.count > 0);
    }, [visibleIncidents]);

    // 호출부호 쌍 수
    const totalOccurrences = useMemo(() => {
        return visibleIncidents.length;
    }, [visibleIncidents]);

    const derivedActionSummary = useMemo(() => {
        let completed = 0;
        let inProgress = 0;
        let waiting = 0;

        visibleIncidents.forEach((incident) => {
            switch (incident.actionStatus) {
                case 'completed':
                    completed += 1;
                    break;
                case 'in_progress':
                case 'pending':
                    inProgress += 1;
                    break;
                default:
                    waiting += 1;
            }
        });

        const total = completed + inProgress;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        return {
            total,
            completionRate,
            statusCounts: {
                waiting,
                in_progress: inProgress,
                completed,
            },
        };
    }, [visibleIncidents]);

    const totalActions = actionStats?.total ?? derivedActionSummary.total;
    const completionRate = actionStats?.completionRate ?? derivedActionSummary.completionRate;
    const monthlyTrend = actionStats?.monthlyTrend ?? [];
    const statusCounts = actionStats?.statusCounts ?? derivedActionSummary.statusCounts;

    // 조치율 = (조치 건수 / 발생 건수) * 100
    const calculatedActionRate = totalOccurrences > 0 ? (totalActions / totalOccurrences) * 100 : 0;
    const totalTimeEvents = useMemo(() => {
        return timeOfDayStats.reduce((acc, cur) => acc + cur.count, 0);
    }, [timeOfDayStats]);

    const formatDonutLabel = ({ percent }: { percent?: number }) => {
        if (!percent || percent === 0) return '';
        return `${(percent * 100).toFixed(0)}%`;
    };

    return (
        <div className="flex flex-col gap-6 animate-fade-in pb-12">
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
                    시간대별 패턴
                </button>
            </div>

            {/* 시간대별 패턴 탭 */}
            {statsSubTab === 'timePattern' && (
                <AirlineTimePatternTab
                    airlineId={airlineId}
                    airlineCode={airlineCode}
                />
            )}

            {/* 기본 통계 탭 */}
            {statsSubTab === 'overview' && (
            <>
            {/* Date Filter Bar */}
            <div className="bg-white/70 backdrop-blur-md shadow-sm border border-slate-200/60 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 transition-all">
                <div className="flex flex-wrap items-center gap-4 w-full">
                    {/* 엑셀기준 / 기간선택 토글 */}
                    {hasBatch && (
                        <div className="flex h-9 rounded border border-slate-200 overflow-hidden shrink-0">
                            <button
                                type="button"
                                onClick={() => handleViewModeChange('batch')}
                                className={`px-3 text-xs font-semibold transition-colors ${viewMode === 'batch' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                            >
                                엑셀기준
                            </button>
                            <button
                                type="button"
                                onClick={() => handleViewModeChange('date')}
                                className={`px-3 text-xs font-semibold transition-colors border-l border-slate-200 ${viewMode === 'date' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                            >
                                기간선택
                            </button>
                        </div>
                    )}

                    {/* 엑셀기준 모드: 년월 + 업로드 선택 */}
                    {viewMode === 'batch' && hasBatch && (
                        <div className="flex items-center gap-2 shrink-0">
                            <select
                                value={selectedYM}
                                onChange={(e) => setSelectedYM(e.target.value)}
                                className="h-9 border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400 shrink-0"
                            >
                                {availableYMs.length === 0 && <option value="">--</option>}
                                {availableYMs.map(ym => (
                                    <option key={ym} value={ym}>{ym.slice(2, 4) + ym.slice(5, 7)}</option>
                                ))}
                            </select>
                            <select
                                value={uploadBatch!.selectedId}
                                onChange={(e) => uploadBatch!.onChange(e.target.value)}
                                className="h-9 border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400 min-w-[190px]"
                            >
                                {filteredUploads.map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.uploaded_at.slice(5, 10)} — {u.file_name} ({u.success_count}건)
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* 기간선택 모드: 날짜 범위 + 퀵 버튼 */}
                    {viewMode === 'date' && (
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-50 to-indigo-100/50 text-indigo-600 rounded-lg flex items-center justify-center border border-indigo-100 shrink-0">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">조회 기간</p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        value={statsStartDate}
                                        onChange={onStatsStartDateChange}
                                        className="bg-transparent border-none p-0 text-sm font-bold text-slate-800 focus:ring-0 cursor-pointer"
                                    />
                                    <span className="text-slate-300 font-medium">~</span>
                                    <input
                                        type="date"
                                        value={statsEndDate}
                                        onChange={onStatsEndDateChange}
                                        className="bg-transparent border-none p-0 text-sm font-bold text-slate-800 focus:ring-0 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex bg-slate-100/80 p-1 rounded-lg border border-slate-200/50">
                            {[
                                { label: '1주', value: '1w' },
                                { label: '2주', value: '2w' },
                                { label: '1개월', value: '1m' },
                            ].map((range) => (
                                <button
                                    key={range.value}
                                    onClick={() => onApplyStatsQuickRange(range.value as 'today' | '1w' | '2w' | '1m')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all duration-200 ${statsActiveRange === range.value
                                        ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                                        }`}
                                >
                                    {range.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    )}
                </div>
            </div>

            {actionStatsLoading ? (
                <div className="bg-white/50 backdrop-blur-sm rounded-3xl p-24 text-center border border-slate-100 flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="text-slate-500 font-medium text-sm">통계 데이터를 분석하고 있습니다...</p>
                </div>
            ) : (
                <>
                    {/* Row 1: KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                        {/* Total Count */}
                        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
                                <svg className="w-20 h-20 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 9h-2V7h-2v5H6v2h2v5h2v-5h2v-2z" />
                                </svg>
                            </div>
                            <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Total Pairs<br /><span className="text-xs font-medium text-slate-400">유사호출부호 쌍</span></h3>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black text-slate-800 tracking-tight">{totalOccurrences.toLocaleString()}</span>
                                    <span className="text-lg font-bold text-slate-400">건</span>
                                </div>
                            </div>
                        </div>

                        {/* Total Actions */}
                        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
                                <svg className="w-20 h-20 text-indigo-500" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                                </svg>
                            </div>
                            <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Total Actions<br /><span className="text-xs font-medium text-slate-400">총 누적 조치 건수</span></h3>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black text-indigo-600 tracking-tight">{totalActions.toLocaleString()}</span>
                                    <span className="text-lg font-bold text-indigo-400">건</span>
                                </div>
                            </div>
                        </div>

                        {/* Action Rate */}
                        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
                                <svg className="w-20 h-20 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                </svg>
                            </div>
                            <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Action Rate<br /><span className="text-xs font-medium text-slate-400">조치율 (발생 대비)</span></h3>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-black text-emerald-600 tracking-tight">{calculatedActionRate.toFixed(1)}</span>
                                    <span className="text-lg font-bold text-emerald-500/60">%</span>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Row 2: Monthly Trends & Top 5 */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Monthly Trend Area Chart */}
                        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 flex flex-col h-[320px]">
                            <h4 className="text-base font-bold text-slate-800 mb-4">월별 조치 발생 추이 <span className="text-sm font-normal text-slate-400 ml-2">Monthly Trends</span></h4>
                            <div className="flex-1 w-full relative">
                                {monthlyTrend.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor={COLORS.blue} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis
                                                dataKey="month"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748B', fontSize: 12 }}
                                                dy={10}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#64748B', fontSize: 12 }}
                                                tickCount={5}
                                            />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                                                formatter={(value: any) => [`${value}건`, '발생 건수']}
                                                labelStyle={{ color: '#0F172A', fontWeight: 'bold', marginBottom: '4px' }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="count"
                                                stroke={COLORS.blue}
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorCount)"
                                                activeDot={{ r: 6, strokeWidth: 0, fill: COLORS.blue }}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 font-medium text-sm">트렌드 데이터가 없습니다.</div>
                                )}
                            </div>
                        </div>

                        {/* Top 5 Callsigns */}
                        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 flex flex-col h-[320px]">
                            <h4 className="text-base font-bold text-slate-800 mb-4">빈발 호출부호 <span className="text-xs font-normal text-slate-400 ml-1">Top 5</span></h4>
                            <div className="flex-1 flex flex-col justify-center gap-3">
                                {topCallsigns.length > 0 ? (
                                    topCallsigns.map((item, idx) => {
                                        const max = topCallsigns[0].count;
                                        const pct = Math.max((item.count / max) * 100, 10);
                                        return (
                                            <div key={idx} className="flex flex-col gap-1.5">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-bold text-slate-700 font-mono">{item.name}</span>
                                                    <span className="text-xs font-bold text-indigo-600">{item.count}회</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }}></div>
                                                </div>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="text-slate-400 text-xs py-2 text-center w-full">데이터 없음</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Row 3: 3 Donut/Bar Charts for Analysis */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Route Trend */}
                        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 flex flex-col h-[280px]">
                            <h4 className="text-sm font-bold text-slate-800 mb-2">노선별 발생 추이 <span className="text-xs font-normal text-slate-400 ml-1">Routes</span></h4>
                            <div className="flex-1 w-full relative pt-2">
                                {routeStats.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={routeStats} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }} width={70} />
                                            <Tooltip
                                                cursor={{ fill: '#F1F5F9' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                                                formatter={(value: any) => [`${value}건`, '발생 건수']}
                                            />
                                            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16} fill={COLORS.amber} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">데이터 없음</div>
                                )}
                            </div>
                        </div>

                        {/* Time of Day Trend */}
                        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 flex flex-col h-[280px]">
                            <h4 className="text-sm font-bold text-slate-800 mb-2">시간대별 발생 추이 <span className="text-xs font-normal text-slate-400 ml-1">Time</span></h4>
                            <div className="flex-1 w-full relative pt-2">
                                {totalTimeEvents > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={timeOfDayStats} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} interval={3} tick={{ fill: '#64748B', fontSize: 10 }} dy={5} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 10 }} />
                                            <Tooltip
                                                cursor={{ fill: '#F1F5F9' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)' }}
                                                formatter={(value: any) => [`${value}건`, '발생 건수']}
                                            />
                                            <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={8} fill={COLORS.rose} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
                                        시간 정보가 없는 데이터입니다.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Risk Level Distribution */}
                        <div className="bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/80 flex flex-col h-[280px]">
                            <h4 className="text-sm font-bold text-slate-800 mb-2">위험도 분포 <span className="text-xs font-normal text-slate-400 ml-1">Risks</span></h4>
                            <div className="flex-1 flex flex-col items-center justify-center relative">
                                {riskStats.length > 0 ? (
                                    <>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                                <Pie
                                                    data={riskStats}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={45}
                                                    outerRadius={70}
                                                    paddingAngle={2}
                                                    dataKey="value"
                                                    labelLine={false}
                                                    label={formatDonutLabel}
                                                >
                                                    {riskStats.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    formatter={(value: any) => [`${value}건`, '위험도']}
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)' }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="flex flex-col gap-1 w-full mt-2">
                                            {riskStats.map((entry, i) => (
                                                <div key={i} className="flex items-center justify-between text-[11px] font-medium">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                                        <span className="text-slate-600">{entry.name}</span>
                                                    </div>
                                                    <span className="text-slate-800">{entry.value}건</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-slate-400 text-xs">데이터 없음</div>
                                )}
                            </div>
                        </div>

                    </div>
                </>

            )}
            </>
            )}
        </div>
    );
}
