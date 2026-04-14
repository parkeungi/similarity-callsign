// 발생현황 탭 - Incident[] 카드 렌더링, AI분석(점수·유형·사유) 표시, reasonType·riskLevel 필터, ai_score/risk/count/latest 정렬, IncidentFilters 연동
'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { getErrorTypeColor } from '@/lib/error-type-colors';
import {
  Incident,
  DateRangeFilterState,
  PaginationState,
  SearchState,
  FiltersState,
  ExportConfig,
  RISK_LEVEL_ORDER,
  ErrorType,
  REASON_TYPE_CONFIG,
  getAiScoreColor
} from '@/types/airline';
import { IncidentFilters } from './IncidentFilters';
import { formatOccurrenceBadge } from '@/lib/occurrence-format';
import { Pagination } from '@/components/common/Pagination';

interface AirlineOccurrenceTabProps {
  incidents: Incident[];
  airlineCode: string;
  dateFilter: DateRangeFilterState & {
    onStartDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onEndDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onApplyQuickRange: (type: 'today' | '1w' | '2w' | '1m') => void;
  };
  pagination: PaginationState;
  search: SearchState;
  filters: FiltersState;
  exportConfig: ExportConfig;
  onOpenActionModal: (incident: Incident) => void;
  onAcknowledge?: (incident: Incident) => void;
  uploadBatchActive?: boolean;
  uploadBatch?: {
    uploads: { id: string; uploaded_at: string; file_name: string; success_count: number }[];
    selectedId: string;
    onChange: (id: string) => void;
    repeatedCount: number;
    newCount: number;
  };
}

type SortOrder = 'risk' | 'count' | 'latest' | 'priority' | 'ai_score';
type ActionStatusFilter = 'all' | 'no_action' | 'in_progress' | 'completed' | 'redetected';

export function AirlineOccurrenceTab({
  incidents,
  airlineCode,
  dateFilter,
  pagination,
  search,
  filters,
  exportConfig,
  onOpenActionModal,
  onAcknowledge,
  uploadBatchActive,
  uploadBatch,
}: AirlineOccurrenceTabProps) {
  // Props에서 필요한 값들 추출
  const { startDate, endDate, activeRange, onStartDateChange, onEndDateChange, onApplyQuickRange } = dateFilter;
  const { page: incidentsPage, limit: incidentsLimit, onPageChange, onLimitChange } = pagination;
  const { input: incidentsSearchInput, onChange: onSearchInputChange, onSubmit: onSearchSubmit } = search;
  const { errorType: errorTypeFilter, onChange: onErrorTypeFilterChange } = filters;
  const { isLoading: isExporting, onExport } = exportConfig;
  const [sortOrder, setSortOrder] = useState<SortOrder>('priority');
  const [actionStatusFilter, setActionStatusFilter] = useState<ActionStatusFilter>('all');
  const [showAiRecommend, setShowAiRecommend] = useState<boolean>(false);
  const [reasonTypeFilter, setReasonTypeFilter] = useState<string>('all');
  const [expandedOccurrences, setExpandedOccurrences] = useState<Set<string>>(new Set());
  const [overflowMap, setOverflowMap] = useState<Record<string, boolean>>({});
  const [visibleCountMap, setVisibleCountMap] = useState<Record<string, number>>({});
  const occurrenceRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 날짜 필터링된 incidents (업로드 배치 기준이면 날짜 필터 스킵)
  const filteredByDate = useMemo(() => {
    if (uploadBatchActive) return incidents;

    const startDateObj = startDate ? new Date(startDate) : null;
    const endDateObj = endDate ? new Date(endDate) : null;

    return incidents.filter((incident) => {
      if (!startDateObj || !endDateObj) return true;
      const incidentDate = new Date(incident.lastDate || '');
      if (Number.isNaN(incidentDate.getTime())) return true;
      return incidentDate >= startDateObj && incidentDate <= endDateObj;
    });
  }, [incidents, startDate, endDate, uploadBatchActive]);

  // 에러 타입 + 검색어 + 정렬 적용된 최종 목록
  const allFilteredIncidents = useMemo(() => {
    let filtered =
      errorTypeFilter === 'all'
        ? filteredByDate
        : filteredByDate.filter((i) =>
            (i.occurrences || []).some(
              (occ: any) => (occ.errorType?.replace(/\s+/g, '') || '오류미발생') === errorTypeFilter
            )
          );

    if (actionStatusFilter === 'completed') {
      filtered = filtered.filter((i) => i.actionStatus === 'completed');
    } else if (actionStatusFilter === 'in_progress') {
      filtered = filtered.filter((i) => i.actionStatus !== 'completed');
    } else if (actionStatusFilter === 'no_action') {
      filtered = filtered.filter((i) => !i.actionStatus || i.actionStatus === 'no_action');
    } else if (actionStatusFilter === 'redetected') {
      filtered = filtered.filter((i) => i.reDetected && !i.reDetectedAcknowledged);
    }

    // reason_type 필터
    if (reasonTypeFilter !== 'all') {
      filtered = filtered.filter((i) => i.reasonType === reasonTypeFilter);
    }

    if (incidentsSearchInput.trim()) {
      const q = incidentsSearchInput.trim().toLowerCase();
      filtered = filtered.filter((i) => i.pair.toLowerCase().includes(q));
    }

    return filtered.sort((a, b) => {
      // 완료 상태를 상단에 배치 (조치중/미조치 아래)
      const aCompleted = a.actionStatus === 'completed' ? 0 : 1;
      const bCompleted = b.actionStatus === 'completed' ? 0 : 1;
      if (aCompleted !== bCompleted) return aCompleted - bCompleted;

      if (sortOrder === 'priority') {
        const similarityOrder: Record<string, number> = { '매우높음': 2, '높음': 1 };
        // 1순위: 위험도
        const riskA = RISK_LEVEL_ORDER[a.risk as keyof typeof RISK_LEVEL_ORDER] || 0;
        const riskB = RISK_LEVEL_ORDER[b.risk as keyof typeof RISK_LEVEL_ORDER] || 0;
        if (riskB !== riskA) return riskB - riskA;

        // 2순위: 유사도
        const simA = similarityOrder[a.similarity as keyof typeof similarityOrder] || 0;
        const simB = similarityOrder[b.similarity as keyof typeof similarityOrder] || 0;
        if (simB !== simA) return simB - simA;

        // 3순위: 발생건
        return (b.count || 0) - (a.count || 0);
      } else if (sortOrder === 'risk') {
        const riskA = RISK_LEVEL_ORDER[a.risk as keyof typeof RISK_LEVEL_ORDER] || 0;
        const riskB = RISK_LEVEL_ORDER[b.risk as keyof typeof RISK_LEVEL_ORDER] || 0;
        if (riskA !== riskB) return riskB - riskA;
        return (b.count || 0) - (a.count || 0);
      } else if (sortOrder === 'ai_score') {
        const scoreA = a.aiScore ?? 0;
        const scoreB = b.aiScore ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
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
  }, [filteredByDate, errorTypeFilter, incidentsSearchInput, sortOrder, actionStatusFilter, reasonTypeFilter]);

  // 통계 계산 - 호출부호 쌍 기준 오류유형 집계
  const stats = useMemo(() => {
    const total = filteredByDate.length;
    const errorTypeCounts: Record<string, number> = {};

    filteredByDate.forEach((incident) => {
      // 쌍별 대표 오류유형: occurrence 중 오류가 있으면 해당 유형, 없으면 '오류미발생'
      const types = new Set<string>();
      (incident.occurrences || []).forEach((occ) => {
        types.add((occ.errorType?.trim()) || '오류미발생');
      });
      if (types.size === 0) types.add('오류미발생');
      types.forEach((t) => {
        errorTypeCounts[t] = (errorTypeCounts[t] || 0) + 1;
      });
    });

    return { total, errorTypeCounts };
  }, [filteredByDate]);

  // reason_type 통계 (AI 분석 유형별 건수)
  const reasonTypeStats = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredByDate.forEach((i) => {
      if (i.reasonType) {
        counts[i.reasonType] = (counts[i.reasonType] || 0) + 1;
      }
    });
    return counts;
  }, [filteredByDate]);

  const hasAiData = Object.keys(reasonTypeStats).length > 0;

  // 오류유형 카드 색상: 유형명 기반 고정 매핑 (getErrorTypeColor)

  // 페이징
  const totalPages = Math.max(1, Math.ceil(allFilteredIncidents.length / incidentsLimit));

  // 현재 페이지가 총 페이지를 초과하면 자동으로 마지막 페이지로 이동
  useEffect(() => {
    if (incidentsPage > totalPages) {
      onPageChange(totalPages);
    }
  }, [incidentsPage, totalPages, onPageChange]);

  const pagedIncidents = useMemo(() => {
    const start = (incidentsPage - 1) * incidentsLimit;
    return allFilteredIncidents.slice(start, start + incidentsLimit);
  }, [allFilteredIncidents, incidentsPage, incidentsLimit]);

  // 발생이력 컨테이너 overflow 감지 + 2줄 내 visible 배지 수 측정
  useEffect(() => {
    const newOverflow: Record<string, boolean> = {};
    const newVisible: Record<string, number> = {};
    for (const [id, el] of Object.entries(occurrenceRefs.current)) {
      if (!el) continue;
      const isOverflow = el.scrollHeight > el.clientHeight + 2;
      newOverflow[id] = isOverflow;
      if (isOverflow) {
        const children = Array.from(el.children) as HTMLElement[];
        newVisible[id] = children.filter(
          c => c.offsetTop + c.offsetHeight <= el.clientHeight + 2
        ).length;
      }
    }
    setOverflowMap(newOverflow);
    setVisibleCountMap(newVisible);
  }, [pagedIncidents]);

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
      default:
        return risk;
    }
  };

  const getErrorTypeLabel = (type: string): string => {
    if (!type) return '기타';

    // 공백 제거하여 정규화
    const normalized = type.replace(/\s+/g, '');

    switch (normalized) {
      case '관제사오류':
        return '관제사';
      case '조종사오류':
        return '조종사';
      case '오류미발생':
        return '오류미발생';
      case '동시응답':
        return '동시응답';
      case '오인응답':
        return '오인응답';
      case '오인응답감지실패':
        return '감지실패';
      case '호출부호발신오류':
        return '발신오류';
      case '무응답':
        return '무응답';
      case '기타':
        return '기타';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* 필터 바 */}
      <IncidentFilters
        dateFilter={{
          startDate,
          endDate,
          activeRange,
          onStartDateChange,
          onEndDateChange,
          onApplyQuickRange,
        }}
        pagination={{
          page: incidentsPage,
          limit: incidentsLimit,
          onPageChange,
          onLimitChange,
        }}
        search={{
          input: incidentsSearchInput,
          onChange: onSearchInputChange,
          onSubmit: onSearchSubmit,
        }}
        exportConfig={{
          isLoading: isExporting,
          onExport,
        }}
        allFilteredIncidentsCount={allFilteredIncidents.length}
        actionStatusFilter={actionStatusFilter}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        onActionStatusFilterChange={setActionStatusFilter}
        uploadBatchActive={uploadBatchActive}
        uploadBatch={uploadBatch}
        showExcel={false}
      />

      {/* 통계 카드 섹션 */}
      {Object.keys(stats.errorTypeCounts).length > 0 && (
        <div className="bg-white border border-gray-200 shadow-sm">
          <div className="flex divide-x divide-gray-100">
            {/* 발생건수 카드 */}
            <button
              onClick={() => onErrorTypeFilterChange('all')}
              className={`flex-1 px-5 py-3 text-left transition-all hover:bg-gray-50 ${errorTypeFilter === 'all' ? 'bg-gray-50' : ''}`}
              style={{ borderLeft: '3px solid #64748b' }}
            >
              <div className="text-xs text-gray-500 mb-1">전체</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-gray-900">{stats.total}</span>
                <span className="text-sm font-bold italic text-gray-500">건</span>
              </div>
            </button>
            {Object.entries(stats.errorTypeCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => {
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                const isActive = errorTypeFilter === type;
                const borderColor = getErrorTypeColor(type).hex;
                return (
                  <button
                    key={type}
                    onClick={() => onErrorTypeFilterChange(isActive ? 'all' : type)}
                    className={`flex-1 px-5 py-3 text-left transition-all hover:bg-gray-50 ${isActive ? 'bg-gray-50' : ''}`}
                    style={{ borderLeft: `3px solid ${borderColor}` }}
                  >
                    <div className="text-xs text-gray-500 mb-1">{type}</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-gray-900">{count}</span>
                      <span className="text-sm font-bold italic" style={{ color: borderColor }}>{pct}%</span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* 발생현황 카드 그리드 */}
      <div className="space-y-4">
        <div className="text-sm font-bold text-gray-600 flex items-center gap-3">
          <span className="shrink-0 flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500 text-white text-[10px] font-black">!</span>
            유사호출부호 발생현황 ({allFilteredIncidents.length}건)
          </span>
          {/* 검색 */}
          <div className="relative flex-1 max-w-[300px]">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="호출부호 검색"
              value={incidentsSearchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onSearchSubmit(); }}
              className="w-full h-8 border border-gray-200 pl-8 pr-8 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
            {incidentsSearchInput && (
              <button
                onClick={() => { onSearchInputChange(''); onSearchSubmit(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          {/* AI 추천 토글 */}
          <button
            type="button"
            onClick={() => {
              const next = !showAiRecommend;
              setShowAiRecommend(next);
              if (next) setSortOrder('ai_score');
            }}
            className={`h-8 px-3 text-[12px] font-bold shrink-0 transition-colors border ${
              showAiRecommend
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-purple-600 border-purple-300 hover:bg-purple-50'
            }`}
          >
            AI 추천
          </button>
          {/* EXCEL */}
          <button
            type="button"
            onClick={onExport}
            disabled={isExporting || allFilteredIncidents.length === 0}
            className={`h-7 px-2.5 text-[11px] font-bold shrink-0 transition-colors rounded ${
              isExporting || allFilteredIncidents.length === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isExporting ? '...' : 'EXCEL'}
          </button>
          <span className="text-xs text-gray-500 ml-auto shrink-0">{incidentsPage} / {totalPages} 페이지</span>
        </div>

        {pagedIncidents.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {pagedIncidents.map((incident, idx) => (
              <div
                key={`${incident.pair}-${idx}`}
                className={`bg-white p-3 shadow-sm hover:shadow-md transition-all border-2 ${
                  incident.actionStatus === 'completed'
                    ? 'border-blue-200'
                    : 'border-red-400'
                }`}
              >
                {/* 헤더 */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const myCallsign = incident.mine || '';
                      const otherCallsign = incident.other || '';
                      const myCode = myCallsign.replace(/[0-9]/g, '');
                      const otherCode = otherCallsign.replace(/[0-9]/g, '');
                      const isSameAirline = myCode === otherCode;
                      const otherColor = isSameAirline ? 'text-blue-600' : 'text-orange-500';

                      return (
                        <>
                          <span className="font-mono font-black text-base text-blue-600">
                            {myCallsign}
                          </span>
                          <span className="text-gray-400 text-sm">↔</span>
                          <span className={`font-mono font-black text-base ${otherColor}`}>
                            {otherCallsign}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* 상대 항공사 조치완료 배지 */}
                    {incident.otherActionStatus === 'completed' && (
                      <span className="px-2 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 rounded">
                        상대사 조치완료
                      </span>
                    )}
                    {/* 재검출 배지 */}
                    {incident.reDetected && (
                      <span className={`px-2 py-1 text-[10px] font-bold border rounded ${
                        incident.reDetectedAcknowledged
                          ? 'bg-gray-50 text-gray-500 border-gray-200'
                          : 'bg-rose-50 text-rose-600 border-rose-200 animate-pulse'
                      }`}>
                        ↻ 재검출
                      </span>
                    )}
                    {/* 재검출 항목: 확인 버튼 / 일반 항목: 조치등록 버튼 */}
                    {incident.reDetected ? (
                      incident.reDetectedAcknowledged ? (
                        <span className="px-2.5 py-1 text-xs font-bold bg-gray-100 text-gray-500 border border-gray-300 rounded">
                          ✓ 확인완료
                        </span>
                      ) : (
                        <button
                          onClick={() => onAcknowledge?.(incident)}
                          className="px-2.5 py-1 text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors cursor-pointer rounded"
                        >
                          확인
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => onOpenActionModal(incident)}
                        className={`px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer ${
                          incident.actionStatus === 'completed'
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 hover:bg-emerald-200 hover:shadow-sm'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {incident.actionStatus === 'completed' ? '✓ 조치완료' : '조치등록'}
                      </button>
                    )}
                  </div>
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
                        ? new Date(incident.lastDate).toLocaleDateString('ko-KR', {
                            month: '2-digit',
                            day: '2-digit',
                          })
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
                    <span
                      className={`inline-block px-2 py-0.5 text-[11px] font-bold border ${getRiskBadgeColor(
                        incident.risk
                      )}`}
                    >
                      {getRiskLabel(incident.risk)}
                    </span>
                  </div>
                </div>

                {/* AI 분석 영역 - 토글 ON + 데이터 있을 때만 표시 */}
                {showAiRecommend && incident.aiScore != null && (
                  <div className="mb-2 pb-2 border-b border-purple-200 bg-purple-50 px-2 py-1.5">
                    <div className="flex items-center gap-2 mb-1">
                      {/* AI 점수 배지 */}
                      {(() => {
                        const scoreColor = getAiScoreColor(incident.aiScore);
                        return (
                          <span className={`inline-flex items-center gap-1 text-[13px] px-2 py-0.5 font-bold ${scoreColor.bg} ${scoreColor.text}`}>
                            AI {incident.aiScore}점
                            <span className="text-[12px] opacity-75">({scoreColor.label})</span>
                          </span>
                        );
                      })()}
                      {/* reason_type 배지 */}
                      {incident.reasonType && REASON_TYPE_CONFIG[incident.reasonType] && (
                        <span className={`inline-block text-[13px] px-2 py-0.5 font-semibold ${REASON_TYPE_CONFIG[incident.reasonType].bgColor} ${REASON_TYPE_CONFIG[incident.reasonType].textColor}`}>
                          {REASON_TYPE_CONFIG[incident.reasonType].label}
                        </span>
                      )}
                    </div>
                    {/* AI 사유 텍스트 */}
                    {incident.aiReason && (
                      <p className="text-[13px] text-purple-800 leading-relaxed" title={incident.aiReason}>
                        {incident.aiReason}
                      </p>
                    )}
                  </div>
                )}

                {/* 오류 유형별 집계 - 팔레트 색상 동적 적용 */}
                {incident.errorTypeSummary && incident.errorTypeSummary.length > 0 && (
                  <div className="mb-2 pb-2 border-b border-gray-200">
                    <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">오류유형</div>
                    <div className="flex flex-wrap gap-1.5">
                      {incident.errorTypeSummary.map((summary, i) => {
                        const p = getErrorTypeColor(summary.errorType || '');
                        return (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 font-semibold border ${p.bg} ${p.label} ${p.border}`}
                          >
                            <span>{getErrorTypeLabel(summary.errorType)}</span>
                            <span className="font-black">({summary.count}건)</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 발생 이력 타임라인 (전체 발생건수, 시간순 오름차순) */}
                {incident.occurrences && incident.occurrences.length > 0 && (() => {
                  const isExpanded = expandedOccurrences.has(incident.id);
                  const hasOverflow = overflowMap[incident.id];
                  const sorted = [...incident.occurrences].sort((a, b) => {
                    const dateA = `${a.occurredDate || ''} ${a.occurredTime || '00:00'}`;
                    const dateB = `${b.occurredDate || ''} ${b.occurredTime || '00:00'}`;
                    return dateA.localeCompare(dateB);
                  });
                  return (
                    <div>
                      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">발생 이력 (전체 검출, 시간순)</div>
                      <div
                        ref={(el) => { occurrenceRefs.current[incident.id] = el; }}
                        className={`flex flex-wrap gap-1.5 overflow-hidden transition-all duration-200 ${isExpanded ? '' : 'max-h-[54px]'}`}
                      >
                        {sorted.map((occurrence, i) => {
                          const { monthDay, time } = formatOccurrenceBadge(
                            occurrence.occurredDate,
                            occurrence.occurredTime
                          );
                          return (
                            <span
                              key={i}
                              className="inline-block text-[11px] bg-blue-50 text-blue-800 px-2.5 py-0.5 font-mono border border-blue-200"
                            >
                              {monthDay} <span className="text-blue-500 font-bold">{time}</span>
                            </span>
                          );
                        })}
                      </div>
                      {(hasOverflow || isExpanded) && (
                        <button
                          onClick={() => setExpandedOccurrences(prev => {
                            const next = new Set(prev);
                            if (isExpanded) next.delete(incident.id);
                            else next.add(incident.id);
                            return next;
                          })}
                          className="mt-1 text-[11px] text-blue-500 hover:text-blue-700 font-semibold"
                        >
                          {isExpanded ? '접기 ▲' : `더보기 +${incident.occurrences.length - (visibleCountMap[incident.id] ?? 0)}건 ▼`}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-12 text-center text-gray-500">
            <p className="text-sm">조회 기간 내 발생현황이 없습니다.</p>
          </div>
        )}

        {/* 페이지네이션 */}
        <Pagination page={incidentsPage} totalPages={totalPages} onPageChange={onPageChange} />
      </div>
    </div>
  );
}
