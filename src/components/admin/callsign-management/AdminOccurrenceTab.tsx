'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useAirlines } from '@/hooks/useAirlines';
import { Incident, DateRangeType, RISK_LEVEL_ORDER, ErrorType } from '@/types/airline';

interface OccurrenceIncident extends Incident {
  airlineName?: string;
  airlineCode?: string;
}

type SortOrder = 'risk' | 'count' | 'latest';
type ActionStatusFilter = 'all' | 'no_action' | 'in_progress' | 'completed';

export function AdminOccurrenceTab() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const airlinesQuery = useAirlines();

  // 상태
  const [selectedAirlineId, setSelectedAirlineId] = useState<'all' | string>('all');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [activeRange, setActiveRange] = useState<DateRangeType>('custom');
  const [errorTypeFilter, setErrorTypeFilter] = useState<'all' | ErrorType>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('latest');
  const [actionStatusFilter, setActionStatusFilter] = useState<ActionStatusFilter>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'completed' | 'partial' | 'inProgress'>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const airlines = airlinesQuery.data || [];
  const selectedAirline = airlines.find(a => a.id === selectedAirlineId);

  // 선택된 항공사의 발생현황 조회
  const occurrencesQuery = useQuery({
    queryKey: ['admin-occurrences', selectedAirlineId, startDate, endDate, accessToken],
    queryFn: async () => {
      if (!accessToken) return [];
      if (selectedAirlineId === 'all') return []; // 모든 항공사는 별도 처리

      try {
        const response = await fetch(
          `/api/airlines/${selectedAirlineId}/callsigns?page=1&limit=10000`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!response.ok) return [];

        const result = await response.json();
        const callsigns = result.data || [];

        // callsigns를 Incident 형태로 변환
        return callsigns.map((cs: any) => ({
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
      } catch (error) {
        console.error('발생현황 조회 오류:', error);
        return [];
      }
    },
    enabled: !!accessToken && selectedAirlineId !== 'all',
    staleTime: 1000 * 60 * 5,
  });

  const allAirlinesQuery = useQuery({
    queryKey: ['admin-all-occurrences', startDate, endDate, accessToken],
    queryFn: async () => {
      if (!accessToken) return [];
      if (selectedAirlineId !== 'all') return [];

      try {
        const allIncidents: OccurrenceIncident[] = [];

        for (const airline of airlines) {
          const response = await fetch(
            `/api/airlines/${airline.id}/callsigns?page=1&limit=10000`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );

          if (!response.ok) continue;

          const result = await response.json();
          const callsigns = result.data || [];

          const incidents = callsigns.map((cs: any) => ({
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

          allIncidents.push(...incidents);
        }

        return allIncidents;
      } catch (error) {
        console.error('전체 발생현황 조회 오류:', error);
        return [];
      }
    },
    enabled: !!accessToken && selectedAirlineId === 'all',
    staleTime: 1000 * 60 * 5,
  });

  // 데이터 결합
  const incidents = selectedAirlineId === 'all'
    ? (allAirlinesQuery.data || [])
    : (occurrencesQuery.data || []);

  // 날짜 필터링
  const filteredByDate = useMemo(() => {
    const startDateObj = startDate ? new Date(startDate) : null;
    const endDateObj = endDate ? new Date(endDate) : null;

    return incidents.filter((incident) => {
      if (!startDateObj || !endDateObj) return true;
      const incidentDate = new Date(incident.lastDate || '');
      if (Number.isNaN(incidentDate.getTime())) return true;
      return incidentDate >= startDateObj && incidentDate <= endDateObj;
    });
  }, [incidents, startDate, endDate]);

  // 필터링 및 정렬
  const allFilteredIncidents = useMemo(() => {
    let filtered = errorTypeFilter === 'all'
      ? filteredByDate
      : filteredByDate.filter((i) => i.errorType === errorTypeFilter);

    // 카드 클릭(selectedStatus)을 우선적으로 적용, 없으면 actionStatusFilter 사용
    const primaryFilter = selectedStatus !== 'all' ? selectedStatus : actionStatusFilter;

    if (primaryFilter === 'completed') {
      filtered = filtered.filter((i) => i.actionStatus === 'completed');
    } else if (primaryFilter === 'in_progress') {
      // 진행중: 미완료 + no_action 모두 포함
      filtered = filtered.filter((i) =>
        i.actionStatus === 'in_progress' ||
        i.actionStatus === 'no_action' ||
        !i.actionStatus
      );
    } else if (primaryFilter === 'no_action') {
      // 미조치: 아직 조치가 없는 경우
      filtered = filtered.filter((i) => !i.actionStatus || i.actionStatus === 'no_action');
    } else if (primaryFilter === 'partial') {
      // 발생현황은 부분완료 개념이 없음 (다른 항공사 정보 불가) → 항상 빈 결과
      filtered = [];
    }

    // 검색 필터
    if (searchKeyword.trim()) {
      filtered = filtered.filter((i) =>
        i.pair.toUpperCase().includes(searchKeyword.toUpperCase())
      );
    }

    return filtered.sort((a, b) => {
      const aCompleted = a.actionStatus === 'completed' ? 0 : 1;
      const bCompleted = b.actionStatus === 'completed' ? 0 : 1;
      if (aCompleted !== bCompleted) return aCompleted - bCompleted;

      if (sortOrder === 'risk') {
        const riskA = RISK_LEVEL_ORDER[a.risk as keyof typeof RISK_LEVEL_ORDER] || 0;
        const riskB = RISK_LEVEL_ORDER[b.risk as keyof typeof RISK_LEVEL_ORDER] || 0;
        if (riskA !== riskB) return riskB - riskA;
        return (b.count || 0) - (a.count || 0);
      } else if (sortOrder === 'count') {
        if ((b.count || 0) !== (a.count || 0)) return (b.count || 0) - (a.count || 0);
        return (RISK_LEVEL_ORDER[b.risk as keyof typeof RISK_LEVEL_ORDER] || 0) - (RISK_LEVEL_ORDER[a.risk as keyof typeof RISK_LEVEL_ORDER] || 0);
      } else {
        const dateA = a.lastDate ? new Date(a.lastDate).getTime() : 0;
        const dateB = b.lastDate ? new Date(b.lastDate).getTime() : 0;
        return dateB - dateA;
      }
    });
  }, [filteredByDate, errorTypeFilter, sortOrder, actionStatusFilter, searchKeyword, selectedStatus]);

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(allFilteredIncidents.length / limit));
  const pagedIncidents = useMemo(() => {
    const start = (page - 1) * limit;
    return allFilteredIncidents.slice(start, start + limit);
  }, [allFilteredIncidents, page, limit]);

  const getRiskBadgeColor = (risk: string): string => {
    switch (risk) {
      case 'very_high':
        return 'bg-rose-100 text-rose-700 border-rose-300';
      case 'high':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'low':
        return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getRiskLabel = (risk: string): string => {
    switch (risk) {
      case 'very_high':
        return '매우높음';
      case 'high':
        return '높음';
      case 'medium':
        return '중간';
      case 'low':
        return '낮음';
      default:
        return risk;
    }
  };

  const getErrorTypeLabel = (type: string): string => {
    if (!type) return '불명';
    const normalized = type.replace(/\s+/g, '');
    switch (normalized) {
      case '관제사오류':
        return '관제사';
      case '조종사오류':
        return '조종사';
      case '오류미발생':
        return '불명';
      default:
        return '불명';
    }
  };

  // 통계 계산 (선택된 항공사 기반)
  const stats = useMemo(() => {
    const sourceData = selectedAirlineId === 'all'
      ? (allAirlinesQuery.data || [])
      : (occurrencesQuery.data || []);

    const total = sourceData.length;
    console.log('[AdminOccurrenceTab] stats:', {
      selectedAirlineId,
      sourceDataLength: total,
      allAirlinesQueryData: allAirlinesQuery.data?.length,
      occurrencesQueryData: occurrencesQuery.data?.length,
    });
    const completed = sourceData.filter((i) => i.actionStatus === 'completed').length;
    const inProgress = sourceData.filter((i) =>
      i.actionStatus === 'in_progress' ||
      i.actionStatus === 'no_action' ||
      !i.actionStatus
    ).length;
    // 부분완료: 발생현황은 한 항공사 관점이므로 부분완료 개념이 없음 (항상 0)
    const partial = 0;

    const errorTypeCounts = {
      '관제사오류': 0,
      '조종사오류': 0,
      '오류미발생': 0,
    };

    sourceData.forEach((incident) => {
      const normalized = incident.errorType?.replace(/\s+/g, '') || '';
      if (normalized === '관제사오류') {
        errorTypeCounts['관제사오류']++;
      } else if (normalized === '조종사오류') {
        errorTypeCounts['조종사오류']++;
      } else if (normalized === '오류미발생') {
        errorTypeCounts['오류미발생']++;
      }
    });

    return {
      total,
      completed,
      partial,
      inProgress,
      ...errorTypeCounts,
      atcPercentage: total > 0 ? Math.round((errorTypeCounts['관제사오류'] / total) * 100) : 0,
      pilotPercentage: total > 0 ? Math.round((errorTypeCounts['조종사오류'] / total) * 100) : 0,
      nonePercentage: total > 0 ? Math.round((errorTypeCounts['오류미발생'] / total) * 100) : 0,
    };
  }, [allAirlinesQuery.data, occurrencesQuery.data, selectedAirlineId]);

  const isLoading = selectedAirlineId === 'all' ? allAirlinesQuery.isLoading : occurrencesQuery.isLoading;

  return (
    <div className="space-y-6">
      {/* 상태별 통계 */}
      <div className="space-y-4">
        {/* 상태 카드 4개 (클릭 가능) */}
        <div className="grid grid-cols-4 gap-3">
          {/* 전체 */}
          <button
            onClick={() => {
              setSelectedStatus('all');
              setPage(1);
            }}
            className={`text-center p-4 rounded-lg border-2 transition-all cursor-pointer ${
              selectedStatus === 'all'
                ? 'bg-blue-50 border-blue-500'
                : 'bg-white border-blue-300 hover:bg-blue-50'
            }`}
          >
            <p className="text-3xl font-black text-blue-600">{stats.total}</p>
            <p className="text-xs font-bold text-gray-600 mt-2">전체</p>
          </button>
          {/* 완료 */}
          <button
            onClick={() => {
              setSelectedStatus('completed');
              setPage(1);
            }}
            className={`text-center p-4 rounded-lg border-2 transition-all cursor-pointer ${
              selectedStatus === 'completed'
                ? 'bg-emerald-50 border-emerald-500'
                : 'bg-white border-emerald-300 hover:bg-emerald-50'
            }`}
          >
            <p className="text-3xl font-black text-emerald-600">{stats.completed}</p>
            <p className="text-xs font-bold text-gray-600 mt-2">완료</p>
          </button>
          {/* 부분완료 */}
          <button
            onClick={() => {
              setSelectedStatus('partial');
              setPage(1);
            }}
            className={`text-center p-4 rounded-lg border-2 transition-all cursor-pointer ${
              selectedStatus === 'partial'
                ? 'bg-amber-50 border-amber-500'
                : 'bg-white border-amber-300 hover:bg-amber-50'
            }`}
          >
            <p className="text-3xl font-black text-amber-600">{stats.partial}</p>
            <p className="text-xs font-bold text-gray-600 mt-2">부분완료</p>
          </button>
          {/* 진행중 */}
          <button
            onClick={() => {
              setSelectedStatus('inProgress');
              setPage(1);
            }}
            className={`text-center p-4 rounded-lg border-2 transition-all cursor-pointer ${
              selectedStatus === 'inProgress'
                ? 'bg-gray-100 border-gray-500'
                : 'bg-white border-gray-300 hover:bg-gray-50'
            }`}
          >
            <p className="text-3xl font-black text-gray-600">{stats.inProgress}</p>
            <p className="text-xs font-bold text-gray-600 mt-2">진행중</p>
          </button>
        </div>

        {/* 오류 유형별 통계 */}
        <div className="grid grid-cols-3 gap-3">
          {/* 관제사 오류 */}
          <div className="bg-rose-50 rounded-lg p-4 border border-rose-100">
            <p className="text-xs font-bold text-rose-700 mb-2">관제사 오류</p>
            <p className="text-2xl font-black text-rose-600">
              {stats['관제사오류']}
              <span className="text-sm font-bold ml-2">{stats.atcPercentage}%</span>
            </p>
          </div>
          {/* 조종사 오류 */}
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
            <p className="text-xs font-bold text-amber-700 mb-2">조종사 오류</p>
            <p className="text-2xl font-black text-amber-600">
              {stats['조종사오류']}
              <span className="text-sm font-bold ml-2">{stats.pilotPercentage}%</span>
            </p>
          </div>
          {/* 오류 미발생 */}
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
            <p className="text-xs font-bold text-emerald-700 mb-2">오류 미발생</p>
            <p className="text-2xl font-black text-emerald-600">
              {stats['오류미발생']}
              <span className="text-sm font-bold ml-2">{stats.nonePercentage}%</span>
            </p>
          </div>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          {/* 항공사 선택 */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold text-gray-700 min-w-fit">항공사:</label>
            <select
              value={selectedAirlineId}
              onChange={(e) => {
                setSelectedAirlineId(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 font-medium hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded text-sm font-medium"
            />
            <span className="text-gray-400 font-bold">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded text-sm font-medium"
            />
          </div>

          {/* 호출부호 검색 */}
          <div className="flex-1 flex items-center gap-2">
            <input
              type="text"
              placeholder="호출부호 검색 (예: JNA, KAL)"
              value={searchKeyword}
              onChange={(e) => {
                setSearchKeyword(e.target.value);
                setPage(1);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 font-medium hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchKeyword && (
              <button
                onClick={() => {
                  setSearchKeyword('');
                  setPage(1);
                }}
                className="px-3 py-2 text-gray-500 hover:text-gray-700 font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 발생현황 카드 그리드 */}
      <div className="space-y-4">
        <div className="text-sm font-bold text-gray-600">
          ⚠️ 유사호출부호 발생현황 ({allFilteredIncidents.length}건)
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg p-12 text-center text-gray-500">
            <p className="text-sm">데이터를 불러오는 중입니다...</p>
          </div>
        ) : pagedIncidents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pagedIncidents.map((incident, idx) => (
              <div
                key={`${incident.pair}-${idx}`}
                className="bg-white border-l-4 border-gray-300 rounded-lg p-3 shadow-sm hover:shadow-md transition-all"
                style={{
                  borderLeftColor:
                    incident.risk === 'very_high'
                      ? '#dc2626'
                      : incident.risk === 'high'
                      ? '#f59e0b'
                      : incident.risk === 'medium'
                      ? '#eab308'
                      : '#16a34a',
                }}
              >
                {/* 헤더 */}
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-mono font-black text-base text-blue-600 mb-1">
                      {incident.pair}
                    </div>
                    <div className="text-xs text-gray-500">
                      {incident.airlineName} ({incident.airlineCode})
                    </div>
                  </div>
                  {incident.actionStatus === 'completed' ? (
                    <div className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded border border-emerald-300">
                      ✓ 조치완료
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
                        ? new Date(incident.lastDate).toLocaleDateString('ko-KR', {
                            month: '2-digit',
                            day: '2-digit',
                          })
                        : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500 font-semibold mb-0.5">유사성</div>
                    <div className="font-bold text-sm text-blue-600">{incident.similarity || '-'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-500 font-semibold mb-0.5">오류가능성</div>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${getRiskBadgeColor(
                        incident.risk
                      )}`}
                    >
                      {getRiskLabel(incident.risk)}
                    </span>
                  </div>
                </div>

                {/* 오류 유형별 집계 */}
                {incident.errorTypeSummary && incident.errorTypeSummary.length > 0 && (
                  <div className="mb-2 pb-2 border-b border-gray-200">
                    <div className="text-[11px] font-semibold text-gray-500 mb-1">📊 오류유형</div>
                    <div className="flex flex-wrap gap-1.5">
                      {incident.errorTypeSummary.map((summary, i) => {
                        const errorTypeColor =
                          summary.errorType === '관제사오류' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          summary.errorType === '조종사오류' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200';
                        return (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-semibold border ${errorTypeColor}`}
                          >
                            <span>{getErrorTypeLabel(summary.errorType)}</span>
                            <span className="font-black">({summary.count}건)</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 발생 이력 타임라인 (날짜+시간) */}
                {incident.occurrences && incident.occurrences.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-gray-500 mb-1">🕐 발생 이력 (날짜·시간)</div>
                    <div className="flex flex-wrap gap-1.5">
                      {incident.occurrences.map((occurrence, i) => {
                        const dateStr = occurrence.occurredDate
                          ? occurrence.occurredDate.split('-').slice(1).join('-')
                          : '-';
                        const timeStr = occurrence.occurredTime && occurrence.occurredTime !== '00:00:00'
                          ? occurrence.occurredTime.substring(0, 5)
                          : '00:00';
                        return (
                          <span
                            key={i}
                            className="inline-block text-[11px] bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded font-mono border border-blue-200"
                          >
                            {dateStr} <span className="text-blue-500 font-bold">{timeStr}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}
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
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-3 py-2 rounded border border-gray-300 text-gray-600 font-bold text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 disabled:border-gray-200 disabled:text-gray-300 disabled:bg-gray-50 transition-all"
              >
                ⏮
              </button>

              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-2 rounded border border-gray-300 text-gray-600 font-bold text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 disabled:border-gray-200 disabled:text-gray-300 disabled:bg-gray-50 transition-all"
              >
                ◀
              </button>

              <div className="px-4 py-2 mx-1 rounded border border-blue-300 bg-blue-50">
                <span className="text-sm font-black text-blue-600">
                  {page} <span className="text-gray-400 font-bold">/ {totalPages}</span>
                </span>
              </div>

              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages}
                className="px-3 py-2 rounded border border-gray-300 text-gray-600 font-bold text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 disabled:border-gray-200 disabled:text-gray-300 disabled:bg-gray-50 transition-all"
              >
                ▶
              </button>

              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-3 py-2 rounded border border-gray-300 text-gray-600 font-bold text-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 disabled:border-gray-200 disabled:text-gray-300 disabled:bg-gray-50 transition-all"
              >
                ⏭
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
