// 조치 상세 모달 - Action 객체 받아 조치유형·담당자·상태·설명·이력 표시, 닫기 버튼
'use client';

import React from 'react';
import { Callsign } from '@/types/action';

interface ActionDetailModalProps {
  callsign: Callsign;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
}

export function ActionDetailModal({
  callsign,
  isOpen,
  onClose,
  onEdit,
}: ActionDetailModalProps) {
  if (!isOpen) return null;

  // 호출부호 쌍 분리
  const parts = callsign.callsign_pair?.split(' | ') || ['', ''];
  const airlineCode1 = (parts[0] || '').substring(0, 3);
  const airlineCode2 = (parts[1] || '').substring(0, 3);
  const isSameAirline = airlineCode1 === airlineCode2;

  // 위험도 배지 색상
  const getRiskColor = (risk?: string) => {
    switch (risk) {
      case '매우높음': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case '높음': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getSimilarityColor = (sim?: string) => {
    switch (sim) {
      case '매우높음': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case '높음': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      default: return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }
  };

  // occurrences GROUP BY errorType (동적, 하드코딩 없음)
  const errorTypeCounts: Record<string, number> = {};
  ((callsign as any).occurrences || []).forEach((occ: any) => {
    const t = (occ.errorType?.trim()) || '오류미발생';
    errorTypeCounts[t] = (errorTypeCounts[t] || 0) + 1;
  });
  const errorTypeEntries = Object.entries(errorTypeCounts).sort((a, b) => b[1] - a[1]);

  // 다크 테마 팔레트 (모달 배경색 맞춤)
  const DARK_PALETTE = [
    { border: 'border-rose-900/50',    bg: 'bg-rose-900/20',    label: 'text-rose-300/70',    value: 'text-rose-400'    },
    { border: 'border-amber-900/50',   bg: 'bg-amber-900/20',   label: 'text-amber-300/70',   value: 'text-amber-400'   },
    { border: 'border-emerald-900/50', bg: 'bg-emerald-900/20', label: 'text-emerald-300/70', value: 'text-emerald-400' },
    { border: 'border-blue-900/50',    bg: 'bg-blue-900/20',    label: 'text-blue-300/70',    value: 'text-blue-400'    },
    { border: 'border-violet-900/50',  bg: 'bg-violet-900/20',  label: 'text-violet-300/70',  value: 'text-violet-400'  },
    { border: 'border-slate-700',      bg: 'bg-slate-800/50',   label: 'text-slate-400',      value: 'text-slate-300'   },
  ];

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 rounded-none shadow-2xl shadow-black/50 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-100">조치 상세정보</h2>
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-800 rounded-none border border-slate-700 shadow-sm">
              <span className="font-mono font-bold text-blue-400 text-sm">{parts[0]}</span>
              <span className="text-slate-500 text-xs">↔</span>
              <span className={`font-mono font-bold text-sm ${isSameAirline ? 'text-blue-400' : 'text-rose-400'}`}>
                {parts[1]}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1.5 rounded-none transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
          
          {/* Main Stats Grid */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-slate-800/50 p-3.5 rounded-none border border-slate-700 flex flex-col justify-center">
              <span className="text-xs font-medium text-slate-400 mb-1.5">발생건수</span>
              <div className="text-lg font-bold text-slate-100">{callsign.occurrence_count || 0}<span className="text-sm font-medium text-slate-500 ml-0.5">건</span></div>
            </div>
            <div className="bg-slate-800/50 p-3.5 rounded-none border border-slate-700 flex flex-col justify-center">
              <span className="text-xs font-medium text-slate-400 mb-1.5">최근발생일</span>
              <div className="text-sm font-bold text-slate-100">
                {callsign.last_occurred_at ? new Date(callsign.last_occurred_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : '-'}
              </div>
            </div>
            <div className="bg-slate-800/50 p-3.5 rounded-none border border-slate-700 flex flex-col justify-center items-start">
              <span className="text-xs font-medium text-slate-400 mb-1.5">위험도</span>
              <span className={`px-2 py-0.5 rounded-none text-xs font-bold border ${getRiskColor(callsign.risk_level)}`}>
                {callsign.risk_level || '-'}
              </span>
            </div>
            <div className="bg-slate-800/50 p-3.5 rounded-none border border-slate-700 flex flex-col justify-center items-start">
              <span className="text-xs font-medium text-slate-400 mb-1.5">유사도</span>
              <span className={`px-2 py-0.5 rounded-none text-xs font-bold border ${getSimilarityColor(callsign.similarity)}`}>
                {callsign.similarity || '-'}
              </span>
            </div>
          </div>

          {/* Action Info (if exists) */}
          {callsign.action_id && (
            <div className="bg-blue-900/20 p-4 rounded-none border border-blue-800/50 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
              <h3 className="text-sm font-bold text-blue-400 mb-3.5">조치 정보</h3>
              <div className="grid grid-cols-3 gap-4 mb-3">
                <div>
                  <div className="text-[11px] font-medium text-slate-400 mb-1">조치유형</div>
                  <div className="text-sm font-bold text-slate-100">{callsign.action_type || '-'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-400 mb-1">처리일자</div>
                  <div className="text-sm font-bold text-slate-100">
                    {callsign.action_completed_at
                      ? new Date(callsign.action_completed_at).toLocaleDateString('ko-KR')
                      : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-slate-400 mb-1">상태</div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-none text-xs font-bold border ${
                    callsign.action_status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                  }`}>
                    {callsign.action_status === 'completed' ? '✓ 완료' : callsign.action_status === 'in_progress' ? '진행중' : '미조치'}
                  </span>
                </div>
              </div>
              {/* 조치 상세내용 */}
              <div className="pt-3 border-t border-blue-800/40">
                <div className="text-[11px] font-medium text-slate-400 mb-1.5">상세내용</div>
                {callsign.action_description ? (
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {callsign.action_description}
                  </p>
                ) : (
                  <p className="text-sm text-slate-500 italic">-</p>
                )}
              </div>
            </div>
          )}

          {/* Error Type Breakdown - 동적 GROUP BY */}
          <div>
            <h3 className="text-sm font-bold text-slate-300 mb-3">오류유형별 집계</h3>
            {errorTypeEntries.length === 0 ? (
              <p className="text-xs text-slate-500">발생 이력이 없습니다.</p>
            ) : (
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${Math.min(errorTypeEntries.length, 3)}, minmax(0, 1fr))` }}
              >
                {errorTypeEntries.map(([type, count], idx) => {
                  const p = DARK_PALETTE[idx % DARK_PALETTE.length];
                  return (
                    <div key={type} className={`flex items-center justify-between p-3.5 rounded-none border ${p.border} ${p.bg}`}>
                      <span className={`text-xs font-bold ${p.label}`}>{type}</span>
                      <span className={`text-sm font-black ${p.value}`}>
                        {count}<span className="text-xs font-semibold ml-0.5 opacity-60">건</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Occurrence History */}
          {(() => {
            // MM-DD HH:MM 포맷 변환
            const fmtDate = (dateStr: string, timeStr: string): string => {
              try {
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                  const mm = String(d.getMonth() + 1).padStart(2, '0');
                  const dd = String(d.getDate()).padStart(2, '0');
                  return `${mm}-${dd} ${timeStr || ''}`.trim();
                }
              } catch {}
              // fallback: dateStr이 'YYYY-MM-DD' 형태면 슬라이스
              const m = String(dateStr).match(/(\d{2})-(\d{2})/);
              return m ? `${m[1]}-${m[2]} ${timeStr || ''}`.trim() : dateStr;
            };

            const occs: any[] = (callsign as any).occurrences || [];
            const occDates: string = (callsign as any).occurrence_dates || '';
            const items: string[] = occs.length > 0
              ? occs.slice(0, 10).map((o: any) => fmtDate(o.occurredDate ?? '', o.occurredTime ?? ''))
              : occDates.split(',').filter((d) => d.trim()).slice(0, 10).map((d) => d.trim());
            if (items.length === 0) return null;
            return (
              <div>
                <h3 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                  발생 이력 <span className="text-[11px] font-medium text-slate-500 font-normal">최대 10건</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  {items.map((item, idx) => (
                    <span key={idx} className="bg-slate-800 text-slate-300 px-2.5 py-1 rounded-none text-xs font-semibold font-mono border border-slate-700 shadow-sm">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 border border-slate-700 rounded-none text-sm font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

