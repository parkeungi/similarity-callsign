'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { Incident, DateRangeType, RISK_LEVEL_ORDER, ErrorType } from '@/types/airline';
import { IncidentFilters } from './IncidentFilters';

interface AirlineOccurrenceTabProps {
  incidents: Incident[];
  airlineCode: string;
  startDate: string;
  endDate: string;
  activeRange: DateRangeType;
  errorTypeFilter: 'all' | ErrorType;
  isExporting: boolean;
  incidentsPage: number;
  incidentsLimit: number;
  incidentsSearchInput: string;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: () => void;
  onStartDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEndDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onApplyQuickRange: (type: 'today' | '1w' | '2w' | '1m') => void;
  onErrorTypeFilterChange: (filter: 'all' | ErrorType) => void;
  onExport: () => void;
  onOpenActionModal: (incident: Incident) => void;
}

export function AirlineOccurrenceTab({
  incidents,
  airlineCode,
  startDate,
  endDate,
  activeRange,
  errorTypeFilter,
  isExporting,
  incidentsPage,
  incidentsLimit,
  incidentsSearchInput,
  onPageChange,
  onLimitChange,
  onSearchInputChange,
  onSearchSubmit,
  onStartDateChange,
  onEndDateChange,
  onApplyQuickRange,
  onErrorTypeFilterChange,
  onExport,
  onOpenActionModal,
}: AirlineOccurrenceTabProps) {
  // 날짜 필터링된 incidents
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

  // 에러 타입 + 검색어 + 정렬 적용된 최종 목록
  const allFilteredIncidents = useMemo(() => {
    let filtered =
      errorTypeFilter === 'all'
        ? filteredByDate
        : filteredByDate.filter((i) => i.errorType === errorTypeFilter);

    if (incidentsSearchInput.trim()) {
      const q = incidentsSearchInput.trim().toLowerCase();
      filtered = filtered.filter((i) => i.pair.toLowerCase().includes(q));
    }

    return filtered.sort((a, b) => {
      const riskA = RISK_LEVEL_ORDER[a.risk as keyof typeof RISK_LEVEL_ORDER] || 0;
      const riskB = RISK_LEVEL_ORDER[b.risk as keyof typeof RISK_LEVEL_ORDER] || 0;

      if (riskA !== riskB) {
        return riskB - riskA;
      }

      const countA = a.count || 0;
      const countB = b.count || 0;
      return countB - countA;
    });
  }, [filteredByDate, errorTypeFilter, incidentsSearchInput]);

  // 통계 계산
  const stats = useMemo(() => {
    const total = filteredByDate.length;
    const atc = filteredByDate.filter((i) => i.errorType === '관제사오류').length;
    const pilot = filteredByDate.filter((i) => i.errorType === '조종사오류').length;
    const none = filteredByDate.filter((i) => i.errorType === '오류미발생').length;

    return {
      total,
      atc,
      pilot,
      none,
      atcPercent: total > 0 ? Math.round((atc / total) * 100) : 0,
      pilotPercent: total > 0 ? Math.round((pilot / total) * 100) : 0,
      nonePercent: total > 0 ? Math.round((none / total) * 100) : 0,
    };
  }, [filteredByDate]);

  // 페이징
  const totalPages = Math.max(1, Math.ceil(allFilteredIncidents.length / incidentsLimit));
  const pagedIncidents = useMemo(() => {
    const start = (incidentsPage - 1) * incidentsLimit;
    return allFilteredIncidents.slice(start, start + incidentsLimit);
  }, [allFilteredIncidents, incidentsPage, incidentsLimit]);

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
    switch (type) {
      case '관제사오류':
        return '관제사';
      case '조종사오류':
        return '조종사';
      case '오류미발생':
        return '불명';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* 통계 카드 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-bold text-gray-600 mb-4 uppercase tracking-widest">
          📊 발생현황 요약
        </h3>

        {/* 메인 통계 */}
        <div className="mb-6">
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-4xl font-black text-gray-900">{stats.total}</span>
            <span className="text-sm font-medium text-gray-500">(조사기간 내)</span>
          </div>

          {/* 3칸 카드 그리드 */}
          <div className="grid grid-cols-3 gap-3">
            {/* ATC 오류 */}
            <div className="border-2 border-rose-200 rounded-lg p-4 bg-rose-50 cursor-pointer hover:shadow-md transition-shadow">
              <div className="text-xs font-bold text-rose-600 uppercase mb-2">
                관제사 오류
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-rose-700">{stats.atc}</span>
                <span className="text-xs font-bold text-rose-500">{stats.atcPercent}%</span>
              </div>
            </div>

            {/* PILOT 오류 */}
            <div className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50 cursor-pointer hover:shadow-md transition-shadow">
              <div className="text-xs font-bold text-orange-600 uppercase mb-2">
                조종사 오류
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-orange-700">{stats.pilot}</span>
                <span className="text-xs font-bold text-orange-500">{stats.pilotPercent}%</span>
              </div>
            </div>

            {/* 불명 */}
            <div className="border-2 border-emerald-200 rounded-lg p-4 bg-emerald-50 cursor-pointer hover:shadow-md transition-shadow">
              <div className="text-xs font-bold text-emerald-600 uppercase mb-2">
                오류 미분류
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-700">{stats.none}</span>
                <span className="text-xs font-bold text-emerald-500">{stats.nonePercent}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 바 */}
      <IncidentFilters
        startDate={startDate}
        endDate={endDate}
        activeRange={activeRange}
        isExporting={isExporting}
        incidentsLimit={incidentsLimit}
        incidentsSearchInput={incidentsSearchInput}
        allFilteredIncidentsCount={allFilteredIncidents.length}
        actionStatusFilter="all"
        onSearchInputChange={onSearchInputChange}
        onSearchSubmit={onSearchSubmit}
        onLimitChange={onLimitChange}
        onStartDateChange={onStartDateChange}
        onEndDateChange={onEndDateChange}
        onApplyQuickRange={onApplyQuickRange}
        onExport={onExport}
      />

      {/* 발생현황 카드 그리드 */}
      <div className="space-y-4">
        <div className="text-sm font-bold text-gray-600 flex items-center justify-between">
          <span>⚠️ 유사호출부호 발생현황 ({allFilteredIncidents.length}건)</span>
          <span className="text-xs text-gray-500">{incidentsPage} / {totalPages} 페이지</span>
        </div>

        {pagedIncidents.length > 0 ? (
          <div className="grid gap-4">
            {pagedIncidents.map((incident, idx) => (
              <div
                key={`${incident.pair}-${idx}`}
                className="bg-white border-l-4 border-gray-300 rounded-lg p-5 shadow-sm hover:shadow-md transition-all"
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
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const parts = incident.pair.split(' | ');
                      return (
                        <>
                          <span className="font-mono font-black text-lg text-blue-600">
                            {parts[0] || incident.pair}
                          </span>
                          <span className="text-gray-400">↔</span>
                          <span className="font-mono font-black text-lg text-red-600">
                            {parts[1] || ''}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => onOpenActionModal(incident)}
                    className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition-colors"
                  >
                    조치등록
                  </button>
                </div>

                {/* 정보 테이블 */}
                <div className="grid grid-cols-4 gap-3 text-sm mb-4 pb-4 border-b border-gray-200">
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">발생건수</div>
                    <div className="font-bold text-gray-900">{incident.count || 0}건</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">최근발생일</div>
                    <div className="font-bold text-gray-900">
                      {incident.lastDate
                        ? new Date(incident.lastDate).toLocaleDateString('ko-KR', {
                            month: '2-digit',
                            day: '2-digit',
                          })
                        : '-'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">오류유형</div>
                    <div className="font-bold text-gray-900">{getErrorTypeLabel(incident.errorType)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-semibold mb-1">위험도</div>
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-bold border ${getRiskBadgeColor(
                        incident.risk
                      )}`}
                    >
                      {getRiskLabel(incident.risk)}
                    </span>
                  </div>
                </div>

                {/* 발생 이력 타임라인 */}
                {incident.dates && incident.dates.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2">발생 이력</div>
                    <div className="flex flex-wrap gap-2">
                      {incident.dates.map((date, i) => (
                        <span
                          key={i}
                          className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono"
                        >
                          {new Date(date).toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg p-12 text-center text-gray-500">
            <p className="text-sm">조회 기간 내 발생현황이 없습니다.</p>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <button
              onClick={() => onPageChange(Math.max(1, incidentsPage - 1))}
              disabled={incidentsPage === 1}
              className="px-3 py-1 text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:text-gray-300"
            >
              이전
            </button>
            <span className="text-sm text-gray-600">
              {incidentsPage} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(totalPages, incidentsPage + 1))}
              disabled={incidentsPage === totalPages}
              className="px-3 py-1 text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:text-gray-300"
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
