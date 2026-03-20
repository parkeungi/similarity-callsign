// 관리자 발생현황 탭 - GET /api/admin/occurrences 호출, 양쪽 항공사 조치상태 표시, riskLevel·airline 필터, 페이지네이션
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getErrorTypeColor } from '@/lib/error-type-colors';
import { useAuthStore } from '@/store/authStore';
import { apiFetch } from '@/lib/api/client';
import { useAdminAirlines } from '@/hooks/useAirlines';
import { Incident, RISK_LEVEL_ORDER, REASON_TYPE_CONFIG, getAiScoreColor } from '@/types/airline';
import { formatOccurrenceBadge } from '@/lib/occurrence-format';
import { Pagination } from '@/components/common/Pagination';


interface OccurrenceIncident extends Incident {
  airlineName?: string;
  airlineCode?: string;
  otherAirlineCode?: string;
  aiScore?: number | null;
  aiReason?: string | null;
  reasonType?: string | null;
}

type SortOrder = 'ai_score' | 'risk' | 'count';
type ActionStatusFilter = 'all' | 'in_progress' | 'completed';

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
  const [sortOrder, setSortOrder] = useState<SortOrder>('ai_score');
  const [actionStatusFilter, setActionStatusFilter] = useState<ActionStatusFilter>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [showAiRecommend, setShowAiRecommend] = useState<boolean>(true);
  const [errorTypeFilter, setErrorTypeFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 10;

  const airlines = airlinesQuery.data || [];
  const selectedAirline = airlines.find(a => a.id === selectedAirlineId);

  // 전체 발생현황 통합 조회 (1번 API 호출로 모든 항공사 데이터 수신)
  const allOccurrencesQuery = useQuery({
    queryKey: ['admin-all-occurrences-v2', accessToken],
    queryFn: async () => {
      const response = await apiFetch('/api/admin/occurrences');
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
        airlineName: cs.airline_name_ko,
        airlineCode: cs.airline_code,
        otherAirlineCode: cs.other_airline_code,
        airlineId: cs.airline_id,
        // AI 분석 데이터
        aiScore: cs.ai_score ?? cs.aiScore ?? null,
        aiReason: cs.ai_reason ?? cs.aiReason ?? null,
        reasonType: cs.reason_type ?? cs.reasonType ?? null,
      } as OccurrenceIncident));
    },
    enabled: !!accessToken,
    staleTime: 1000 * 60 * 5, // 5분 캐시 (항공사 전환 시 재요청 없음)
    gcTime: 1000 * 60 * 30,
  });

  // 선택 항공사 필터링은 캐시된 데이터에서 클라이언트 처리 (추가 fetch 없음)
  const rawIncidents: OccurrenceIncident[] = useMemo(() => {
    const all = allOccurrencesQuery.data || [];
    if (selectedAirlineId === 'all') return all;
    // 특정 항공사: airlineCode 또는 otherAirlineCode가 해당 항공사인 쌍
    const selectedAirline = airlines.find(al => al.id === selectedAirlineId);
    if (selectedAirline) {
      return all.filter((i) => {
        const a = (i as any).airlineCode || '';
        const b = (i as any).otherAirlineCode || '';
        return a === selectedAirline.code || b === selectedAirline.code;
      });
    }
    return all;
  }, [allOccurrencesQuery.data, selectedAirlineId, airlines]);

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

  // 통계 계산 - 호출부호 쌍 기준 오류유형 집계
  const stats = useMemo(() => {
    const total = filteredByDate.length;
    const errorTypeCounts: Record<string, number> = {};

    filteredByDate.forEach((incident) => {
      const types = new Set<string>();
      (incident.occurrences || []).forEach((occ: any) => {
        types.add((occ.errorType?.trim()) || '오류미발생');
      });
      if (types.size === 0) types.add('오류미발생');
      types.forEach((t) => {
        errorTypeCounts[t] = (errorTypeCounts[t] || 0) + 1;
      });
    });

    return {
      total,
      completed: filteredByDate.filter(i => i.actionStatus === 'completed').length,
      inProgress: filteredByDate.filter(i => i.actionStatus === 'in_progress').length,
      noAction: filteredByDate.filter(i => !i.actionStatus || i.actionStatus === 'no_action').length,
      errorTypeCounts,
    };
  }, [filteredByDate]);

  // 오류유형 카드 색상: 유형명 기반 고정 매핑 (getErrorTypeColor)

  // 필터 + 정렬
  const allFilteredIncidents = useMemo(() => {
    let filtered = [...filteredByDate];

    if (actionStatusFilter === 'completed') {
      filtered = filtered.filter(i => i.actionStatus === 'completed');
    } else if (actionStatusFilter === 'in_progress') {
      filtered = filtered.filter(i => i.actionStatus !== 'completed');
    }

    // 오류유형 필터
    if (errorTypeFilter) {
      filtered = filtered.filter(i =>
        (i.occurrences || []).some((occ: any) => {
          const t = (occ.errorType?.trim()) || '오류미발생';
          return t === errorTypeFilter;
        })
      );
    }

    if (searchKeyword.trim()) {
      const q = searchKeyword.trim().toUpperCase();
      filtered = filtered.filter(i => i.pair.toUpperCase().includes(q));
    }

    return filtered.sort((a, b) => {
      // AI 점수 정렬 모드에서는 AI 점수가 최우선
      if (sortOrder === 'ai_score') {
        const scoreA = a.aiScore ?? 0;
        const scoreB = b.aiScore ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        // AI 점수 동일 시 위험도 → 발생횟수 순
        const riskA = RISK_LEVEL_ORDER[a.risk as keyof typeof RISK_LEVEL_ORDER] || 0;
        const riskB = RISK_LEVEL_ORDER[b.risk as keyof typeof RISK_LEVEL_ORDER] || 0;
        if (riskB !== riskA) return riskB - riskA;
        return (b.count || 0) - (a.count || 0);
      }

      // 다른 정렬 모드에서는 완료 상태를 뒤로
      const aCompleted = a.actionStatus === 'completed' ? 1 : 0;
      const bCompleted = b.actionStatus === 'completed' ? 1 : 0;
      if (aCompleted !== bCompleted) return aCompleted - bCompleted;

      if (sortOrder === 'risk') {
        // 오류발생가능성순: 위험도 높은 순 → 발생건수 순
        const riskA = RISK_LEVEL_ORDER[a.risk as keyof typeof RISK_LEVEL_ORDER] || 0;
        const riskB = RISK_LEVEL_ORDER[b.risk as keyof typeof RISK_LEVEL_ORDER] || 0;
        if (riskA !== riskB) return riskB - riskA;
        return (b.count || 0) - (a.count || 0);
      } else {
        // 발생건수순
        return (b.count || 0) - (a.count || 0);
      }
    });
  }, [filteredByDate, actionStatusFilter, searchKeyword, sortOrder, errorTypeFilter]);

  const totalPages = Math.max(1, Math.ceil(allFilteredIncidents.length / limit));

  // 현재 페이지가 총 페이지를 초과하면 자동으로 마지막 페이지로 이동
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedIncidents = useMemo(() => {
    const start = (page - 1) * limit;
    return allFilteredIncidents.slice(start, start + limit);
  }, [allFilteredIncidents, page, limit]);

  const isLoading = allOccurrencesQuery.isLoading;

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
      default: return risk;
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
              <option value="in_progress">조치필요</option>
              <option value="completed">조치완료</option>
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
              <option value="ai_score">AI분석순</option>
              <option value="risk">오류발생가능성순</option>
              <option value="count">발생건수순</option>
            </select>
          </div>

          {/* AI 추천 토글 */}
          <button
            type="button"
            onClick={() => {
              setShowAiRecommend(!showAiRecommend);
              if (!showAiRecommend) {
                setSortOrder('ai_score');
              }
              setPage(1);
            }}
            className={`px-3 py-2 text-sm font-bold rounded-lg transition-colors border ${
              showAiRecommend
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-purple-600 border-purple-300 hover:bg-purple-50'
            }`}
          >
            🤖 AI 추천
          </button>

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

      {/* 통계 카드 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-xs font-medium text-gray-500">전체</span>
          <span className="text-4xl font-black text-gray-900">{stats.total}</span>
          <span className="text-sm font-medium text-gray-500">건</span>
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
              .map(([type, count]) => {
                const palette = getErrorTypeColor(type);
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                const isSelected = errorTypeFilter === type;
                return (
                  <div
                    key={type}
                    onClick={() => { setErrorTypeFilter(isSelected ? null : type); setPage(1); }}
                    className={`border-2 ${palette.border} ${palette.bg} rounded-lg p-4 cursor-pointer transition-all ${
                      isSelected ? 'ring-2 ring-offset-1 ring-gray-900 scale-[1.02] shadow-md' : 'hover:shadow-sm hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold ${palette.label}`}>{type}</span>
                      {isSelected && <span className="text-[10px] font-bold text-gray-500 bg-white px-1.5 py-0.5 rounded">필터 ON</span>}
                    </div>
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

      {/* 발생현황 목록 */}
      <div className="space-y-4">
        <div className="text-sm font-bold text-gray-600 flex items-center justify-between">
          <span className="flex items-center gap-2">
            ⚠️ 유사호출부호 발생현황 ({allFilteredIncidents.length}건)
            {errorTypeFilter && (
              <button
                onClick={() => { setErrorTypeFilter(null); setPage(1); }}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold bg-gray-800 text-white rounded-full hover:bg-gray-700 transition"
              >
                {errorTypeFilter} ✕
              </button>
            )}
          </span>
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
                      <div className="font-bold text-red-600 text-sm">
                        {(() => {
                          const occs = incident.occurrences || [];
                          return `${occs.length || incident.count || 0}건`;
                        })()}
                      </div>
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

                  {/* AI 분석 영역 - 토글 ON + 데이터 있을 때만 표시 */}
                  {showAiRecommend && incident.aiScore != null && (
                    <div className="mb-2 pb-2 border-b border-purple-200 bg-purple-50 rounded px-2 py-1.5">
                      <div className="flex items-center gap-2 mb-1">
                        {/* AI 점수 배지 */}
                        {(() => {
                          const scoreColor = getAiScoreColor(incident.aiScore!);
                          return (
                            <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-bold ${scoreColor.bg} ${scoreColor.text}`}>
                              🤖 AI {incident.aiScore}점
                              <span className="text-[10px] opacity-75">({scoreColor.label})</span>
                            </span>
                          );
                        })()}
                        {/* reason_type 배지 */}
                        {incident.reasonType && REASON_TYPE_CONFIG[incident.reasonType] && (
                          <span className={`inline-block text-[11px] px-2 py-0.5 rounded font-semibold ${REASON_TYPE_CONFIG[incident.reasonType].bgColor} ${REASON_TYPE_CONFIG[incident.reasonType].textColor}`}>
                            {REASON_TYPE_CONFIG[incident.reasonType].label}
                          </span>
                        )}
                      </div>
                      {/* AI 사유 텍스트 */}
                      {incident.aiReason && (
                        <p className="text-[11px] text-purple-800 leading-relaxed" title={incident.aiReason}>
                          {incident.aiReason}
                        </p>
                      )}
                    </div>
                  )}

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

                  {/* 발생 이력 타임라인 (전체 발생건수, 시간순 오름차순) */}
                  {incident.occurrences && incident.occurrences.length > 0 && (
                    <div>
                      <div className="text-[11px] font-semibold text-gray-500 mb-1">🕐 발생 이력 (전체 검출, 시간순)</div>
                      <div className="flex flex-wrap gap-1.5">
                        {[...incident.occurrences].sort((a: any, b: any) => {
                            const dateA = `${a.occurredDate || ''} ${a.occurredTime || '00:00'}`;
                            const dateB = `${b.occurredDate || ''} ${b.occurredTime || '00:00'}`;
                            return dateA.localeCompare(dateB);
                          })
                          .map((occurrence: any, i: number) => {
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
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}
