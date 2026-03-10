'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useAdminAirlines } from '@/hooks/useAirlines';
import { Incident, RISK_LEVEL_ORDER } from '@/types/airline';
import { formatOccurrenceBadge } from '@/lib/occurrence-format';

interface OccurrenceIncident extends Incident {
  airlineName?: string;
  airlineCode?: string;
}

type SortOrder = 'priority' | 'risk' | 'count' | 'latest';
type ActionStatusFilter = 'all' | 'no_action' | 'in_progress' | 'completed';

export function AdminOccurrenceTab() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const airlinesQuery = useAdminAirlines();

  const [selectedAirlineId, setSelectedAirlineId] = useState<'all' | string>('all');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [sortOrder, setSortOrder] = useState<SortOrder>('priority');
  const [actionStatusFilter, setActionStatusFilter] = useState<ActionStatusFilter>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const airlines = airlinesQuery.data || [];
  const selectedAirline = airlines.find(a => a.id === selectedAirlineId);

  // 특정 항공사 발생현황 조회
  const singleAirlineQuery = useQuery({
    queryKey: ['admin-occurrences', selectedAirlineId, accessToken],
    queryFn: async () => {
      if (!accessToken || selectedAirlineId === 'all') return [];
      const response = await fetch(
        `/api/airlines/${selectedAirlineId}/callsigns?page=1&limit=1000`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!response.ok) return [];
      const result = await response.json();
      return (result.data || []).map((cs: any) => ({
        id: cs.id,
        pair: cs.callsign_pair,
        risk: cs.risk_level === '매우높음' ? 'very_high' : cs.risk_level === '높음' ? 'high' : 'low',
        count: cs.occurrence_count || 0,
        lastDate: cs.last_occurred_at,
        similarity: cs.similarity,
        actionStatus: cs.action_status,
        errorType: cs.error_type,
        errorTypeSummary: cs.errorTypeSummary || [],
        occurrences: cs.occurrences || [],
        airlineName: selectedAirline?.name_ko,
        airlineCode: selectedAirline?.code,
      } as OccurrenceIncident));
    },
    enabled: !!accessToken && selectedAirlineId !== 'all',
    staleTime: 1000 * 60 * 5,
  });

  // 전체 항공사 발생현황 조회
  const allAirlinesQuery = useQuery({
    queryKey: ['admin-all-occurrences', accessToken, airlines.length],
    queryFn: async () => {
      if (!accessToken || airlines.length === 0) return [];
      // 병렬 요청으로 성능 개선 (순차 → Promise.all)
      const results = await Promise.all(
        airlines.map(async (airline) => {
          const response = await fetch(
            `/api/airlines/${airline.id}/callsigns?page=1&limit=1000`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (!response.ok) return [];
          const result = await response.json();
          return (result.data || []).map((cs: any) => ({
            id: cs.id,
            pair: cs.callsign_pair,
            risk: cs.risk_level === '매우높음' ? 'very_high' : cs.risk_level === '높음' ? 'high' : 'low',
            count: cs.occurrence_count || 0,
            lastDate: cs.last_occurred_at,
            similarity: cs.similarity,
            actionStatus: cs.action_status,
            errorType: cs.error_type,
            errorTypeSummary: cs.errorTypeSummary || [],
            occurrences: cs.occurrences || [],
            airlineName: airline.name_ko,
            airlineCode: airline.code,
          } as OccurrenceIncident));
        })
      );
      return results.flat();
    },
    enabled: !!accessToken && selectedAirlineId === 'all' && airlines.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const rawIncidents: OccurrenceIncident[] = selectedAirlineId === 'all'
    ? (allAirlinesQuery.data || [])
    : (singleAirlineQuery.data || []);

  // 날짜 필터링
  const filteredByDate = useMemo(() => {
    const startObj = startDate ? new Date(startDate) : null;
    const endObj = endDate ? new Date(`${endDate}T23:59:59`) : null;
    return rawIncidents.filter((incident) => {
      if (!startObj || !endObj) return true;
      const d = new Date(incident.lastDate || '');
      if (Number.isNaN(d.getTime())) return true;
      return d >= startObj && d <= endObj;
    });
  }, [rawIncidents, startDate, endDate]);

  // 통계 계산 - error_type GROUP BY (동적, 하드코딩 없음)
  const stats = useMemo(() => {
    const total = filteredByDate.length;
    const errorTypeCounts: Record<string, number> = {};

    filteredByDate.forEach((incident) => {
      (incident.occurrences || []).forEach((occ: any) => {
        const t = (occ.errorType?.trim()) || '미분류';
        errorTypeCounts[t] = (errorTypeCounts[t] || 0) + 1;
      });
    });

    const totalOcc = Object.values(errorTypeCounts).reduce((a, b) => a + b, 0);

    return {
      total,
      completed: filteredByDate.filter(i => i.actionStatus === 'completed').length,
      inProgress: filteredByDate.filter(i => i.actionStatus === 'in_progress').length,
      noAction: filteredByDate.filter(i => !i.actionStatus || i.actionStatus === 'no_action').length,
      errorTypeCounts,
      totalOcc,
    };
  }, [filteredByDate]);

  // 오류유형 카드 색상 팔레트 (순서대로 순환)
  const ERROR_TYPE_PALETTE = [
    { border: 'border-rose-200',    bg: 'bg-rose-50',    label: 'text-rose-600',    value: 'text-rose-700',    pct: 'text-rose-500'    },
    { border: 'border-orange-200',  bg: 'bg-orange-50',  label: 'text-orange-600',  value: 'text-orange-700',  pct: 'text-orange-500'  },
    { border: 'border-emerald-200', bg: 'bg-emerald-50', label: 'text-emerald-600', value: 'text-emerald-700', pct: 'text-emerald-500' },
    { border: 'border-blue-200',    bg: 'bg-blue-50',    label: 'text-blue-600',    value: 'text-blue-700',    pct: 'text-blue-500'    },
    { border: 'border-violet-200',  bg: 'bg-violet-50',  label: 'text-violet-600',  value: 'text-violet-700',  pct: 'text-violet-500'  },
    { border: 'border-amber-200',   bg: 'bg-amber-50',   label: 'text-amber-600',   value: 'text-amber-700',   pct: 'text-amber-500'   },
    { border: 'border-gray-200',    bg: 'bg-gray-50',    label: 'text-gray-500',    value: 'text-gray-700',    pct: 'text-gray-400'    },
  ];

  // 필터 + 정렬
  const allFilteredIncidents = useMemo(() => {
    let filtered = [...filteredByDate];

    if (actionStatusFilter === 'completed') {
      filtered = filtered.filter(i => i.actionStatus === 'completed');
    } else if (actionStatusFilter === 'in_progress') {
      filtered = filtered.filter(i => i.actionStatus !== 'completed');
    } else if (actionStatusFilter === 'no_action') {
      filtered = filtered.filter(i => !i.actionStatus || i.actionStatus === 'no_action');
    }

    if (searchKeyword.trim()) {
      const q = searchKeyword.trim().toUpperCase();
      filtered = filtered.filter(i => i.pair.toUpperCase().includes(q));
    }

    return filtered.sort((a, b) => {
      const aCompleted = a.actionStatus === 'completed' ? 0 : 1;
      const bCompleted = b.actionStatus === 'completed' ? 0 : 1;
      if (aCompleted !== bCompleted) return aCompleted - bCompleted;

      if (sortOrder === 'priority') {
        const similarityOrder: Record<string, number> = { '매우높음': 3, '높음': 2, '낮음': 1 };
        const riskA = RISK_LEVEL_ORDER[a.risk as keyof typeof RISK_LEVEL_ORDER] || 0;
        const riskB = RISK_LEVEL_ORDER[b.risk as keyof typeof RISK_LEVEL_ORDER] || 0;
        if (riskB !== riskA) return riskB - riskA;
        const simA = similarityOrder[a.similarity as string] || 0;
        const simB = similarityOrder[b.similarity as string] || 0;
        if (simB !== simA) return simB - simA;
        return (b.count || 0) - (a.count || 0);
      } else if (sortOrder === 'risk') {
        const riskA = RISK_LEVEL_ORDER[a.risk as keyof typeof RISK_LEVEL_ORDER] || 0;
        const riskB = RISK_LEVEL_ORDER[b.risk as keyof typeof RISK_LEVEL_ORDER] || 0;
        if (riskA !== riskB) return riskB - riskA;
        return (b.count || 0) - (a.count || 0);
      } else if (sortOrder === 'count') {
        return (b.count || 0) - (a.count || 0);
      } else {
        const dA = a.lastDate ? new Date(a.lastDate).getTime() : 0;
        const dB = b.lastDate ? new Date(b.lastDate).getTime() : 0;
        return dB - dA;
      }
    });
  }, [filteredByDate, actionStatusFilter, searchKeyword, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(allFilteredIncidents.length / limit));
  const pagedIncidents = useMemo(() => {
    const start = (page - 1) * limit;
    return allFilteredIncidents.slice(start, start + limit);
  }, [allFilteredIncidents, page, limit]);

  const isLoading = selectedAirlineId === 'all' ? allAirlinesQuery.isLoading : singleAirlineQuery.isLoading;

  const getRiskBorderColor = (risk: string) => {
    switch (risk) {
      case 'very_high': return '#dc2626';
      case 'high': return '#f59e0b';
      case 'medium': return '#eab308';
      default: return '#16a34a';
    }
  };

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'very_high': return 'bg-rose-100 text-rose-700 border-rose-300';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-300';
      default: return 'bg-emerald-100 text-emerald-700 border-emerald-300';
    }
  };

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case 'very_high': return '매우높음';
      case 'high': return '높음';
      case 'medium': return '중간';
      default: return '낮음';
    }
  };

  const getErrorTypeLabel = (type: string) => {
    if (!type) return '기타';
    const n = type.replace(/\s+/g, '');
    const map: Record<string, string> = {
      '관제사오류': '관제사', '조종사오류': '조종사', '오류미발생': '오류미발생',
      '동시응답': '동시응답', '오인응답': '오인응답', '오인응답감지실패': '감지실패',
      '호출부호발신오류': '발신오류', '무응답': '무응답', '기타': '기타',
    };
    return map[n] || type;
  };

  const ERROR_TYPE_BADGE_PALETTE = [
    'bg-rose-50 text-rose-700 border-rose-200',
    'bg-orange-50 text-orange-700 border-orange-200',
    'bg-blue-50 text-blue-700 border-blue-200',
    'bg-violet-50 text-violet-700 border-violet-200',
    'bg-emerald-50 text-emerald-700 border-emerald-200',
    'bg-gray-50 text-gray-500 border-gray-200',
  ];

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-4xl font-black text-gray-900">{stats.total}</span>
          <span className="text-sm font-medium text-gray-500">(유사호출부호 쌍)</span>
        </div>
        <div className="text-xs text-gray-500 mb-4">
          ※ 오류 유형별 건수는 발생 이력 기준이며, 전체 유사호출부호 쌍 수와 일치하지 않습니다.
        </div>
        {Object.keys(stats.errorTypeCounts).length === 0 ? (
          <div className="text-sm text-gray-400 py-2">발생 이력이 없습니다.</div>
        ) : (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${Math.min(Object.keys(stats.errorTypeCounts).length, 4)}, minmax(0, 1fr))` }}
          >
            {Object.entries(stats.errorTypeCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count], idx) => {
                const palette = ERROR_TYPE_PALETTE[idx % ERROR_TYPE_PALETTE.length];
                const pct = stats.totalOcc > 0 ? Math.round((count / stats.totalOcc) * 100) : 0;
                return (
                  <div key={type} className={`border-2 ${palette.border} ${palette.bg} rounded-lg p-4`}>
                    <div className={`text-xs font-bold ${palette.label} mb-2`}>{type}</div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-black ${palette.value}`}>{count}</span>
                      <span className={`text-xs font-bold ${palette.pct}`}>{pct}%</span>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* 필터 바 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* 항공사 선택 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold text-gray-700 min-w-fit">항공사:</label>
            <select
              value={selectedAirlineId}
              onChange={(e) => { setSelectedAirlineId(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">모든 항공사</option>
              {airlines.map((airline) => (
                <option key={airline.id} value={airline.id}>
                  {airline.name_ko} ({airline.code})
                </option>
              ))}
            </select>
          </div>

          {/* 날짜 필터 */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded text-sm font-medium"
            />
            <span className="text-gray-400 font-bold">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded text-sm font-medium"
            />
          </div>

          {/* 조치 상태 필터 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold text-gray-700 min-w-fit">조치상태:</label>
            <select
              value={actionStatusFilter}
              onChange={(e) => { setActionStatusFilter(e.target.value as ActionStatusFilter); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체</option>
              <option value="completed">조치완료</option>
              <option value="in_progress">조치중</option>
              <option value="no_action">미조치</option>
            </select>
          </div>

          {/* 정렬 */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-bold text-gray-700 min-w-fit">정렬:</label>
            <select
              value={sortOrder}
              onChange={(e) => { setSortOrder(e.target.value as SortOrder); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="priority">우선순위</option>
              <option value="risk">위험도</option>
              <option value="count">발생건수</option>
              <option value="latest">최근발생</option>
            </select>
          </div>

          {/* 호출부호 검색 */}
          <div className="flex-1 flex items-center gap-2 min-w-[200px]">
            <input
              type="text"
              placeholder="호출부호 검색 (예: JNA, KAL)"
              value={searchKeyword}
              onChange={(e) => { setSearchKeyword(e.target.value); setPage(1); }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchKeyword && (
              <button
                onClick={() => { setSearchKeyword(''); setPage(1); }}
                className="px-2 py-2 text-gray-500 hover:text-gray-700 font-bold text-sm"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 발생현황 목록 */}
      <div className="space-y-4">
        <div className="text-sm font-bold text-gray-600 flex items-center justify-between">
          <span>⚠️ 유사호출부호 발생현황 ({allFilteredIncidents.length}건)</span>
          <span className="text-xs text-gray-500">{page} / {totalPages} 페이지</span>
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg p-12 text-center text-gray-500">
            <p className="text-sm">데이터를 불러오는 중입니다...</p>
          </div>
        ) : pagedIncidents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pagedIncidents.map((incident, idx) => {
              const parts = incident.pair.split(' | ');
              const code1 = (parts[0] || '').substring(0, 3);
              const code2 = (parts[1] || '').substring(0, 3);
              const isSameAirline = code1 === code2;

              return (
                <div
                  key={`${incident.pair}-${idx}`}
                  className="bg-white border-l-4 rounded-lg p-3 shadow-sm hover:shadow-md transition-all"
                  style={{ borderLeftColor: getRiskBorderColor(incident.risk) }}
                >
                  {/* 헤더 */}
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-black text-base text-blue-600">
                          {parts[0] || incident.pair}
                        </span>
                        <span className="text-gray-400 text-sm">↔</span>
                        <span className={`font-mono font-black text-base ${isSameAirline ? 'text-blue-600' : 'text-red-600'}`}>
                          {parts[1] || ''}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {incident.airlineName} ({incident.airlineCode})
                      </div>
                    </div>
                    {incident.actionStatus === 'completed' ? (
                      <div className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded border border-emerald-300">
                        ✓ 조치완료
                      </div>
                    ) : incident.actionStatus === 'in_progress' ? (
                      <div className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded border border-blue-300">
                        조치중
                      </div>
                    ) : (
                      <div className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded border border-amber-300">
                        조치필요
                      </div>
                    )}
                  </div>

                  {/* 정보 테이블 */}
                  <div className="grid grid-cols-4 gap-2 text-sm mb-2 pb-2 border-b border-gray-200">
                    <div>
                      <div className="text-[11px] text-gray-500 font-semibold mb-0.5">발생건수</div>
                      <div className="font-bold text-red-600 text-sm">{incident.count || 0}건</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-500 font-semibold mb-0.5">최근발생일</div>
                      <div className="font-bold text-gray-900 text-sm">
                        {incident.lastDate
                          ? new Date(incident.lastDate).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
                          : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-500 font-semibold mb-0.5">유사성</div>
                      <div className={`font-bold text-sm ${
                        incident.similarity === '높음' || incident.similarity === 'high' ? 'text-red-600' :
                        incident.similarity === '중간' || incident.similarity === 'medium' ? 'text-orange-600' :
                        'text-emerald-600'
                      }`}>{incident.similarity}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-gray-500 font-semibold mb-0.5">오류가능성</div>
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${getRiskBadgeColor(incident.risk)}`}>
                        {getRiskLabel(incident.risk)}
                      </span>
                    </div>
                  </div>

                  {/* 오류 유형별 집계 */}
                  {incident.errorTypeSummary && incident.errorTypeSummary.length > 0 && (
                    <div className="mb-2 pb-2 border-b border-gray-200">
                      <div className="text-[11px] font-semibold text-gray-500 mb-1">📊 오류유형</div>
                      <div className="flex flex-wrap gap-1.5">
                        {incident.errorTypeSummary.map((summary: any, i: number) => (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-semibold border ${ERROR_TYPE_BADGE_PALETTE[i % ERROR_TYPE_BADGE_PALETTE.length]}`}
                          >
                            <span>{getErrorTypeLabel(summary.errorType)}</span>
                            <span className="font-black">({summary.count}건)</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 발생 이력 타임라인 */}
                  {incident.occurrences && incident.occurrences.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-gray-500 mb-1">🕐 발생 이력 (날짜·시간)</div>
                      <div className="flex flex-wrap gap-1.5">
                        {incident.occurrences.map((occurrence: any, i: number) => {
                          const { monthDay, time } = formatOccurrenceBadge(
                            occurrence.occurredDate,
                            occurrence.occurredTime
                          );
                          return (
                            <span
                              key={i}
                              className="inline-block text-[11px] bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded font-mono border border-blue-200"
                            >
                              {monthDay} <span className="text-blue-500 font-bold">{time}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg p-12 text-center text-gray-500">
            <p className="text-sm">발생현황이 없습니다.</p>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="px-6 py-6 border-t border-gray-200">
            <div className="text-center mb-4">
              <span className="text-[12px] font-bold text-gray-600">
                총 <span className="text-gray-800 font-black">{allFilteredIncidents.length}</span>건 중{' '}
                <span className="text-blue-600">{(page - 1) * limit + 1}-{Math.min(page * limit, allFilteredIncidents.length)}</span>
              </span>
            </div>
            <div className="flex items-center justify-center gap-1">
              <button onClick={() => setPage(1)} disabled={page === 1}
                className="px-3 py-2 rounded border border-gray-300 text-gray-600 font-bold text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 disabled:border-gray-200 disabled:text-gray-300 disabled:bg-gray-50 transition-all">
                ⏮
              </button>
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="px-3 py-2 rounded border border-gray-300 text-gray-600 font-bold text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 disabled:border-gray-200 disabled:text-gray-300 disabled:bg-gray-50 transition-all">
                ◀
              </button>
              <div className="px-4 py-2 mx-1 rounded border border-blue-300 bg-blue-50">
                <span className="text-sm font-black text-blue-600">
                  {page} <span className="text-gray-400 font-bold">/ {totalPages}</span>
                </span>
              </div>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                className="px-3 py-2 rounded border border-gray-300 text-gray-600 font-bold text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 disabled:border-gray-200 disabled:text-gray-300 disabled:bg-gray-50 transition-all">
                ▶
              </button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                className="px-3 py-2 rounded border border-gray-300 text-gray-600 font-bold text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 disabled:border-gray-200 disabled:text-gray-300 disabled:bg-gray-50 transition-all">
                ⏭
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
