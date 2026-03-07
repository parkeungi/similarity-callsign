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
      case '매우높음': return 'bg-rose-100 text-rose-700 border-rose-200';
      case '높음': return 'bg-orange-100 text-orange-700 border-orange-200';
      case '낮음': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getSimilarityColor = (sim?: string) => {
    switch (sim) {
      case '매우높음': return 'text-rose-600 bg-rose-50 border-rose-100';
      case '높음': return 'text-orange-600 bg-orange-50 border-orange-100';
      default: return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 shadow-slate-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-800">조치 상세정보</h2>
            <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-md border border-slate-200 shadow-sm">
              <span className="font-mono font-bold text-blue-600 text-sm">{parts[0]}</span>
              <span className="text-slate-300 text-xs">↔</span>
              <span className={`font-mono font-bold text-sm ${isSameAirline ? 'text-blue-600' : 'text-rose-600'}`}>
                {parts[1]}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
          
          {/* Main Stats Grid */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-center">
              <span className="text-xs font-medium text-slate-500 mb-1.5">발생건수</span>
              <div className="text-lg font-bold text-slate-800">{callsign.occurrence_count || 0}<span className="text-sm font-medium text-slate-400 ml-0.5">건</span></div>
            </div>
            <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-center">
              <span className="text-xs font-medium text-slate-500 mb-1.5">최근발생일</span>
              <div className="text-sm font-bold text-slate-800">
                {callsign.last_occurred_at ? new Date(callsign.last_occurred_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : '-'}
              </div>
            </div>
            <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-center items-start">
              <span className="text-xs font-medium text-slate-500 mb-1.5">위험도</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getRiskColor(callsign.risk_level)}`}>
                {callsign.risk_level || '-'}
              </span>
            </div>
            <div className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-center items-start">
              <span className="text-xs font-medium text-slate-500 mb-1.5">유사도</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getSimilarityColor(callsign.similarity)}`}>
                {callsign.similarity || '-'}
              </span>
            </div>
          </div>

          {/* Action Info (if exists) */}
          {callsign.action_id && (
            <div className="bg-blue-50/30 p-4 rounded-xl border border-blue-100/50 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
              <h3 className="text-sm font-bold text-blue-900 mb-3.5 flex items-center gap-2">
                조치 정보
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[11px] font-medium text-blue-800/60 mb-1">조치유형</div>
                  <div className="text-sm font-bold text-slate-800">{callsign.action_type || '-'}</div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-blue-800/60 mb-1">처리일자</div>
                  <div className="text-sm font-bold text-slate-800">
                    {callsign.action_completed_at ? new Date(callsign.action_completed_at).toLocaleDateString('ko-KR') : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-blue-800/60 mb-1">상태</div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${
                    callsign.action_status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {callsign.action_status === 'completed' ? '✓ 완료' : callsign.action_status === 'in_progress' ? '진행중' : '미조치'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Error Type Breakdown */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              오류유형별 집계
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-rose-100 bg-rose-50/30">
                <span className="text-xs font-bold text-rose-800/70">관제사오류</span>
                <span className="text-sm font-black text-rose-600">{(callsign as any)?.atc_count || 0}<span className="text-xs font-semibold ml-0.5 opacity-60">건</span></span>
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-amber-100 bg-amber-50/30">
                <span className="text-xs font-bold text-amber-800/70">조종사오류</span>
                <span className="text-sm font-black text-amber-600">{(callsign as any)?.pilot_count || 0}<span className="text-xs font-semibold ml-0.5 opacity-60">건</span></span>
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/30">
                <span className="text-xs font-bold text-emerald-800/70">오류미발생</span>
                <span className="text-sm font-black text-emerald-600">{(callsign as any)?.unknown_count || 0}<span className="text-xs font-semibold ml-0.5 opacity-60">건</span></span>
              </div>
            </div>
          </div>

          {/* Occurrence History */}
          {(callsign as any)?.occurrence_dates && (
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                최근 발생 이력 <span className="text-[11px] font-medium text-slate-400 font-normal">최대 10건</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {((callsign as any)?.occurrence_dates || '')
                  .split(',')
                  .filter((d: string) => d.trim())
                  .slice(0, 10)
                  .map((time: string, idx: number) => (
                    <span key={idx} className="bg-slate-50 text-slate-600 px-2.5 py-1 rounded-md text-xs font-semibold font-mono border border-slate-200/60 shadow-sm">
                      {time.trim()}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end rounded-b-xl">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

