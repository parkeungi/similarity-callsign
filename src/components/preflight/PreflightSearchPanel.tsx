'use client';

import { useState } from 'react';
import { Search, AlertTriangle, CheckCircle, Clock, MapPin, ChevronDown, ChevronUp, Plane } from 'lucide-react';
import type { PreflightSearchResult } from '@/types/preflight';

export default function PreflightSearchPanel() {
  const [callsign, setCallsign] = useState('');
  const [results, setResults] = useState<PreflightSearchResult[] | null>(null);
  const [searchedCallsign, setSearchedCallsign] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [totalMatches, setTotalMatches] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = callsign.trim().toUpperCase();

    if (!trimmed || trimmed.length < 3) {
      setError('호출부호를 3자 이상 입력해주세요.');
      return;
    }

    setError('');
    setIsLoading(true);
    setHasSearched(true);

    try {
      const response = await fetch(`/api/preflight-search?callsign=${encodeURIComponent(trimmed)}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '검색 실패');
        setResults(null);
        return;
      }

      setResults(data.data.results);
      setSearchedCallsign(data.data.searchedCallsign);
      setDayOfWeek(data.data.dayOfWeek);
      setTotalMatches(data.data.totalMatches);
      setIsExpanded(true);
    } catch {
      setError('검색 중 오류가 발생했습니다.');
      setResults(null);
    } finally {
      setIsLoading(false);
    }
  };

  const riskBadge = (level: string) => {
    if (level === '매우높음') {
      return <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 tracking-wider">매우높음</span>;
    }
    if (level === '높음') {
      return <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 tracking-wider">높음</span>;
    }
    return <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30 tracking-wider">낮음</span>;
  };

  // 같은 요일에 발생 이력이 있는 결과만 필터
  const resultsWithOccurrences = results?.filter(r => r.sameDayCount > 0) || [];
  // 같은 요일 이력은 없지만 매치된 호출부호 쌍
  const resultsWithoutOccurrences = results?.filter(r => r.sameDayCount === 0) || [];

  return (
    <div className="bg-slate-900/60 backdrop-blur-[20px] border border-white/5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)] relative overflow-hidden">
      {/* 장식 요소 */}
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-cyan-500/5 rounded-full blur-[60px] pointer-events-none" />

      {/* 헤더 (접이식 토글) */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 md:p-5 text-left group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center bg-cyan-500/10 border border-cyan-500/20">
            <Plane className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white/90 tracking-tight">출발 전 유사호출부호 조회</h4>
            <p className="text-[10px] text-white/30 font-medium mt-0.5">PRE-FLIGHT SIMILAR CALLSIGN CHECK</p>
          </div>
        </div>
        <div className="text-white/30 group-hover:text-white/60 transition-colors">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* 검색 영역 (항상 표시) */}
      <div className="px-4 md:px-5 pb-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-white/30 group-focus-within:text-cyan-400 transition-colors" />
            </div>
            <input
              type="text"
              value={callsign}
              onChange={(e) => setCallsign(e.target.value.toUpperCase())}
              placeholder="호출부호 입력 (예: KAL852)"
              className="w-full pl-10 pr-4 py-3 md:py-2.5 bg-black/40 border border-white/5 rounded-none text-white placeholder-white/20 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:bg-black/60 transition-all"
              maxLength={10}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 md:px-5 py-3 md:py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold tracking-wider transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? '...' : '조회'}
          </button>
        </form>

        {error && (
          <div className="mt-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 px-3 py-2 text-xs font-bold">
            {error}
          </div>
        )}
      </div>

      {/* 결과 영역 (확장 시) */}
      {isExpanded && hasSearched && !isLoading && results !== null && (
        <div className="px-4 md:px-5 pb-5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* 결과 헤더 */}
          <div className="flex items-center justify-between py-2 border-t border-white/5">
            <span className="text-xs font-bold text-white/50">
              오늘({dayOfWeek}) 동일 요일 발생 이력
            </span>
            {resultsWithOccurrences.length > 0 ? (
              <span className="text-xs font-bold text-amber-400">
                {resultsWithOccurrences.length}건 주의
              </span>
            ) : (
              <span className="text-xs font-bold text-emerald-400">
                안전
              </span>
            )}
          </div>

          {/* 이력이 있는 경우 — 결과 카드 */}
          {resultsWithOccurrences.length > 0 ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
              {resultsWithOccurrences.map((result, idx) => (
                <div
                  key={idx}
                  className="bg-black/30 border border-white/5 p-3 md:p-4 space-y-3"
                >
                  {/* 호출부호 쌍 + 위험도 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span className="text-sm font-bold text-white truncate">
                        {result.callsignPair}
                      </span>
                    </div>
                    {riskBadge(result.riskLevel)}
                  </div>

                  {/* 섹터 + 유사도 정보 */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/40">
                    {result.sector && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        섹터: {result.sector}
                      </span>
                    )}
                    {result.similarity && (
                      <span>유사도: {result.similarity}</span>
                    )}
                    {result.coexistenceMinutes > 0 && (
                      <span>공존: {result.coexistenceMinutes}분</span>
                    )}
                    <span>총 발생: {result.occurrenceCount}회</span>
                  </div>

                  {/* 요일별 발생 횟수 */}
                  {result.occurrencesByDay && result.occurrenceCount > 0 && (
                    <div className="flex items-center gap-1">
                      {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => {
                        const cnt = result.occurrencesByDay?.[i] || 0;
                        const isToday = dayOfWeek.startsWith(d);
                        return (
                          <div
                            key={d}
                            className={`flex flex-col items-center min-w-[24px] px-1 py-0.5 text-[9px] font-bold rounded-sm ${
                              cnt > 0
                                ? isToday
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-white/5 text-white/60'
                                : 'text-white/15'
                            }`}
                          >
                            <span>{d}</span>
                            <span className={cnt > 0 ? 'text-[10px]' : ''}>{cnt > 0 ? cnt : '-'}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 발생 시간대 */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {dayOfWeek} 발생 시간 ({result.sameDayCount}건)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {result.sameDayOccurrences.map((occ, oi) => (
                        <div
                          key={oi}
                          className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-mono font-bold"
                        >
                          <Clock className="w-2.5 h-2.5" />
                          {occ.occurredTime || '시간미상'}
                          {occ.errorType && (
                            <span className="text-white/30 ml-1">
                              {occ.errorType === '관제사 오류' ? 'ATC' : occ.errorType === '조종사 오류' ? 'PLT' : ''}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : totalMatches > 0 ? (
            /* 매치는 있지만 같은 요일 이력 없음 */
            <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/15 p-4">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-400">동일 요일 발생 이력 없음</p>
                <p className="text-[11px] text-white/30 mt-0.5">
                  유사호출부호 {totalMatches}건이 등록되어 있으나, {dayOfWeek}에 발생한 이력은 없습니다.
                </p>
              </div>
            </div>
          ) : (
            /* 매치 자체가 없음 */
            <div className="flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/15 p-4">
              <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-400">등록된 유사호출부호 없음</p>
                <p className="text-[11px] text-white/30 mt-0.5">
                  &apos;{searchedCallsign}&apos;와 매치되는 유사호출부호가 없습니다.
                </p>
              </div>
            </div>
          )}

          {/* 같은 요일 이력 없는 매치 (접혀있는 추가 정보) */}
          {resultsWithOccurrences.length > 0 && resultsWithoutOccurrences.length > 0 && (
            <div className="text-[11px] text-white/25 pt-1 border-t border-white/5">
              + {resultsWithoutOccurrences.length}건의 유사호출부호가 등록되어 있으나 {dayOfWeek} 이력 없음
            </div>
          )}
        </div>
      )}

      {/* 로딩 스켈레톤 */}
      {isExpanded && isLoading && (
        <div className="px-4 md:px-5 pb-5 space-y-3">
          <div className="h-4 w-48 bg-white/5 animate-pulse" />
          <div className="bg-black/30 border border-white/5 p-4 space-y-3">
            <div className="h-4 w-full bg-white/5 animate-pulse" />
            <div className="h-3 w-32 bg-white/5 animate-pulse" />
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-white/5 animate-pulse" />
              <div className="h-6 w-16 bg-white/5 animate-pulse" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
