'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import * as XLSX from 'xlsx';
import { parseJsonCookie } from '@/lib/cookies';
import { ROUTES } from '@/lib/constants';
import { useAirlineActions, useAirlineActionStats, useAirlineCallsigns } from '@/hooks/useActions';
import { useActiveAnnouncements, useAnnouncementHistory } from '@/hooks/useAnnouncements';
import { useDateRangeFilter, formatDateInput, toInputDate } from '@/hooks/useDateRangeFilter';
import { useAirlineModal } from '@/hooks/useAirlineModal';
import { ActionModal } from '@/components/actions/ActionModal';
import { Header } from '@/components/layout/Header';
import { AirlineStatisticsTab } from '@/components/airline/AirlineStatisticsTab';
import { AnnouncementsTab, AirlineOccurrenceTab, AirlineActionHistoryTab, AirlineCallsignListTab } from '@/components/airline/tabs';
import { AnnouncementPopup } from '@/components/airline/AnnouncementPopup';
import { NanoIcon } from '@/components/ui/NanoIcon';
import {
  BarChart3,
  ClipboardList,
  TrendingUp,
  Megaphone,
  type LucideIcon
} from 'lucide-react';
import {
  AirlineTabType,
  Incident,
  CookieUser,
  CallsignDetailMeta,
  AIRLINE_CODE_MAP,
  ErrorType,
} from '@/types/airline';
import { Action, Callsign } from '@/types/action';

export default function AirlinePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore((s) => ({ user: s.user }));

  // 기본 상태
  const [airlineCode, setAirlineCode] = useState<string>('');
  const [airlineName, setAirlineName] = useState<string>('');
  const [airlineId, setAirlineId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<AirlineTabType>('occurrence');

  // 모달 상태 (통합 관리)
  const modal = useAirlineModal();

  // 공지사항 팝업 상태
  const [isAnnouncementPopupOpen, setIsAnnouncementPopupOpen] = useState(false);
  const [popupShown, setPopupShown] = useState(false);

  // 필터 상태
  const [errorTypeFilter, setErrorTypeFilter] = useState<'all' | ErrorType>('all');
  const [isExporting, setIsExporting] = useState(false);

  // 발생현황 탭 상태 (신규)
  const [occurrencePage, setOccurrencePage] = useState(1);
  const [occurrenceLimit, setOccurrenceLimit] = useState(10);
  const [occurrenceSearchInput, setOccurrenceSearchInput] = useState('');

  // 조치이력 탭 상태
  const [actionPage, setActionPage] = useState(1);
  const [actionLimit, setActionLimit] = useState(10);
  const [actionSearch, setActionSearch] = useState('');
  const [actionSearchInput, setActionSearchInput] = useState('');
  const [actionStatusFilter, setActionStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  // 날짜 범위 필터 (커스텀 훅 사용)
  const incidentsDateFilter = useDateRangeFilter({ defaultRange: '1m' });
  const statsDateFilter = useDateRangeFilter({ defaultRange: '1m' });


  // 초기 로드 - authStore에서 사용자 정보 사용
  useEffect(() => {
    // authStore에서 user 정보 사용 (쿠키 대신)
    if (!user) {
      router.push(ROUTES.LOGIN);
      return;
    }

    let code = user.airline?.code || '';
    let name = user.airline?.name_ko || '';
    let id = user.airline?.id || '';

    if (!code) {
      code = 'KAL';
      name = '대한항공';
    }

    if (!name && code) {
      name = AIRLINE_CODE_MAP[code]?.n || '';
    }

    setAirlineCode(code);
    setAirlineName(name);

    if (id) {
      setAirlineId(id);
    }
  }, [user, router]);

  // 데이터 훅
  const { data: actionsData, isLoading: actionsLoading } = useAirlineActions({
    airlineId,
    status: actionStatusFilter === 'all' ? undefined : actionStatusFilter,
    search: actionSearch || undefined,
    page: actionPage,
    limit: actionLimit,
  });


  const { data: callsignsData, isLoading: callsignsLoading } = useAirlineCallsigns(airlineId, {
    limit: 1000,
  }, {
    enabled: activeTab === 'occurrence' || activeTab === 'action-history' || activeTab === 'statistics'
  });

  const { data: actionStats, isLoading: actionStatsLoading } = useAirlineActionStats(airlineId, {
    dateFrom: statsDateFilter.startDate,
    dateTo: statsDateFilter.endDate,
  }, {
    enabled: activeTab === 'statistics'
  });

  const { data: activeAnnouncementsData, isLoading: activeAnnouncementsLoading } = useActiveAnnouncements({}, {
    enabled: activeTab === 'announcements'
  });

  const { data: announcementHistoryData } = useAnnouncementHistory({
    status: 'active',
    limit: 100,
  });

  // 상태 필터 변경 시 캐시 무효화
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['airline-actions'], exact: false });
    setActionPage(1);
  }, [actionStatusFilter, queryClient, airlineId]);

  // 공지사항 팝업 자동 표시 (미읽은 공지사항이 있으면 로드 후 1회만 표시)
  useEffect(() => {
    if (popupShown || !announcementHistoryData) return;

    const unreadAnnouncements = announcementHistoryData.announcements.filter(
      (a) => !a.isViewed
    );

    if (unreadAnnouncements.length > 0) {
      setIsAnnouncementPopupOpen(true);
      setPopupShown(true);
    }
  }, [announcementHistoryData, popupShown]);

  // 메모이제이션된 데이터 변환
  const incidents = useMemo<Incident[]>(() => {
    if (!callsignsData?.data) return [];

    return callsignsData.data.map((cs) => ({
      id: cs.id,
      pair: cs.callsign_pair,
      mine: cs.my_callsign,
      other: cs.other_callsign,
      airline: cs.airline_code,
      errorType: cs.error_type || '오류 미발생',
      subError: cs.sub_error || '',
      risk: cs.risk_level || '낮음',
      similarity: cs.similarity || '낮음',
      count: cs.occurrence_count || 0,
      firstDate: cs.first_occurred_at ? new Date(cs.first_occurred_at).toISOString().split('T')[0] : null,
      lastDate: cs.last_occurred_at ? new Date(cs.last_occurred_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      dates: [],
      departureAirport: cs.departure_airport1 || cs.departureAirport || null,
      arrivalAirport: cs.arrival_airport1 || cs.arrivalAirport || null,
      // 발생 이력 상세 정보
      occurrences: cs.occurrences || [],
      errorTypeSummary: cs.errorTypeSummary || [],
      // 조치 상태
      actionId: cs.action_id || cs.actionId || null,
      actionStatus: cs.action_status || cs.actionStatus || 'no_action',
      actionType: cs.action_type || cs.actionType || null,
      actionCompletedAt: cs.action_completed_at || cs.actionCompletedAt || null,
    }));
  }, [callsignsData]);

  const activeAnnouncements = useMemo(
    () => activeAnnouncementsData?.announcements ?? [],
    [activeAnnouncementsData]
  );

  const unreadAnnouncements = useMemo(
    () => announcementHistoryData?.announcements.filter((a) => !a.isViewed) ?? [],
    [announcementHistoryData]
  );

  // 호출부호 상세 메타 (메모이제이션)
  const callsignDetailMeta = useMemo<CallsignDetailMeta | null>(() => {
    if (modal.type !== 'callsign-detail' || !modal.data) return null;
    const callsign = modal.data as Callsign;
    return {
      occurrenceCount: callsign.occurrence_count ?? 0,
      firstOccurredAt: callsign.first_occurred_at ?? null,
      lastOccurredAt: callsign.last_occurred_at ?? null,
      similarity: callsign.similarity ?? '-',
      riskLevel: callsign.risk_level ?? '-',
      myCallsign: callsign.my_callsign ?? '-',
      otherCallsign: callsign.other_callsign ?? '-',
      errorType: callsign.error_type ?? '-',
      subError: callsign.sub_error ?? '-',
    };
  }, [modal.type, modal.data]);

  // 콜백 함수들
  const handleExportIncidents = useCallback(() => {
    if (isExporting || !incidents.length) {
      if (!incidents.length) window.alert('내보낼 수 있는 발생 현황 데이터가 없습니다.');
      return;
    }

    try {
      const rows = incidents.map((incident) => ({
        '호출부호 쌍': incident.pair,
        '자사 호출부호': incident.mine,
        '타사 호출부호': incident.other,
        '관할 항공사': incident.airline,
        '오류 유형': incident.errorType,
        '세부 오류': incident.subError || '-',
        '위험도': incident.risk,
        '유사성': incident.similarity,
        '발생횟수': incident.count,
        '최초 발생일': incident.firstDate || '',
        '최근 발생일': incident.lastDate || '',
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Incidents');
      const fileName = `callsign_incidents_${airlineCode || 'airline'}_${formatDateInput(new Date())}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch {
      window.alert('엑셀 파일 생성 중 문제가 발생했습니다.');
    }
  }, [incidents, airlineCode]);

  const handleOpenActionModal = useCallback((incident: Incident) => {
    if (!airlineId) {
      window.alert('항공사 정보를 불러올 수 없습니다. 페이지를 새로고침하고 다시 시도해주세요.');
      console.error('[AirlinePage] airlineId is missing:', { airlineId, user: user?.airline });
      return;
    }
    modal.openActionModal(incident);
  }, [airlineId, modal]);

  const handleActionSuccess = useCallback(() => {
    modal.closeModal();
    // 정확한 queryKey로 invalidate (정확한 조치 목록만 갱신)
    queryClient.invalidateQueries({
      queryKey: ['airline-actions', airlineId],
      exact: true
    });
  }, [modal, queryClient, airlineId]);

  const handleActionDetailSuccess = useCallback(() => {
    modal.closeModal();
    setActionPage(1);
    // 정확한 queryKey로 invalidate (정확한 조치 목록만 갱신)
    queryClient.invalidateQueries({
      queryKey: ['airline-actions', airlineId],
      exact: true
    });
  }, [modal, queryClient, airlineId]);

  const handleOpenActionDetail = useCallback((actionId: string) => {
    if (!actionsData) return;
    const action = actionsData.data.find((a) => a.id === actionId);
    if (action) {
      modal.openDetailModal(action);
    }
  }, [actionsData, modal]);

  const handleSearchSubmit = useCallback(() => {
    setActionSearch(actionSearchInput);
    setActionPage(1);
  }, [actionSearchInput]);

  // 순수 함수 - useCallback 제거 (의존성 없음)
  const formatDisplayDate = (value?: string | null): string => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const navItems: Array<{ id: AirlineTabType; label: string; icon: LucideIcon; color: 'primary' | 'info' | 'success' | 'orange' }> = [
    { id: 'occurrence', label: '발생현황', icon: BarChart3, color: 'primary' },
    { id: 'action-history', label: '조치이력', icon: ClipboardList, color: 'info' },
    { id: 'statistics', label: '통계', icon: TrendingUp, color: 'success' },
    { id: 'announcements', label: '공지사항', icon: Megaphone, color: 'orange' },
  ];

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex flex-1 min-h-0 overflow-y-auto">
        {/* 왼쪽 사이드바 */}
        <aside className="w-72 bg-white border-r border-gray-100 flex flex-col pt-0 shrink-0 h-full overflow-y-auto">
          <div className="px-6 py-8 mb-2">
            <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">
              Airline Service
            </h2>
          </div>
          <nav className="flex-1 px-4 space-y-2">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full group flex items-center gap-4 px-4 py-4 rounded-none text-sm font-bold tracking-tight transition-all text-left border-l-4 ${isActive
                      ? 'bg-navy text-white shadow-[0_10px_20px_rgba(30,58,95,0.2)] border-rose-700'
                      : 'text-gray-500 hover:bg-gray-50 border-transparent hover:border-gray-200'
                    }`}
                >
                  <NanoIcon icon={item.icon} color={item.color} size="sm" isActive={isActive} />
                  <span className={`transition-all duration-300 ${isActive ? 'translate-x-1' : 'group-hover:translate-x-1'}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* 오른쪽 콘텐츠 영역 */}
        <div className="flex-1 overflow-y-auto h-full bg-gray-50">
          <div className="w-full max-w-6xl mx-auto px-4 py-10 space-y-8 animate-fade-in flex flex-col">
            {activeTab === 'occurrence' && (
              <AirlineOccurrenceTab
                incidents={incidents}
                airlineCode={airlineCode}
                startDate={incidentsDateFilter.startDate}
                endDate={incidentsDateFilter.endDate}
                activeRange={incidentsDateFilter.activeRange}
                errorTypeFilter={errorTypeFilter}
                isExporting={isExporting}
                incidentsPage={occurrencePage}
                incidentsLimit={occurrenceLimit}
                incidentsSearchInput={occurrenceSearchInput}
                onPageChange={setOccurrencePage}
                onLimitChange={(limit) => {
                  setOccurrenceLimit(limit);
                  setOccurrencePage(1);
                }}
                onSearchInputChange={setOccurrenceSearchInput}
                onSearchSubmit={() => setOccurrencePage(1)}
                onStartDateChange={incidentsDateFilter.handleStartDateChange}
                onEndDateChange={incidentsDateFilter.handleEndDateChange}
                onApplyQuickRange={incidentsDateFilter.applyQuickRange}
                onErrorTypeFilterChange={setErrorTypeFilter}
                onExport={handleExportIncidents}
                onOpenActionModal={handleOpenActionModal}
              />
            )}

            {activeTab === 'action-history' && (
              <AirlineCallsignListTab
                callsigns={callsignsData?.data || []}
                isLoading={callsignsLoading}
                dateFilter={{
                  startDate: incidentsDateFilter.startDate,
                  endDate: incidentsDateFilter.endDate,
                  activeRange: incidentsDateFilter.activeRange,
                }}
                onStartDateChange={incidentsDateFilter.handleStartDateChange}
                onEndDateChange={incidentsDateFilter.handleEndDateChange}
                onApplyQuickRange={incidentsDateFilter.applyQuickRange}
              />
            )}

            {activeTab === 'statistics' && (
              <AirlineStatisticsTab
                statsStartDate={statsDateFilter.startDate}
                statsEndDate={statsDateFilter.endDate}
                onStatsStartDateChange={statsDateFilter.handleStartDateChange}
                onStatsEndDateChange={statsDateFilter.handleEndDateChange}
                statsActiveRange={statsDateFilter.activeRange}
                onApplyStatsQuickRange={statsDateFilter.applyQuickRange}
                actionStatsLoading={actionStatsLoading}
                actionStats={actionStats}
                incidents={incidents}
              />
            )}

            {activeTab === 'announcements' && (
              <AnnouncementsTab
                activeAnnouncements={activeAnnouncements}
                activeAnnouncementsLoading={activeAnnouncementsLoading}
                totalActiveAnnouncements={activeAnnouncementsData?.total ?? activeAnnouncements.length}
              />
            )}
          </div>
        </div>
      </main>

      {/* 조치 등록/수정 모달 */}
      {modal.type === 'action' && (modal.data as Incident) && callsignsData && (
        <ActionModal
          airlineId={airlineId || ''}
          callsigns={callsignsData.data}
          selectedCallsign={callsignsData.data.find((cs) => cs.callsign_pair === (modal.data as Incident).pair)}
          actionId={(modal.data as Incident).actionId || undefined}
          onClose={modal.closeModal}
          onSuccess={handleActionSuccess}
        />
      )}

      {/* 조치 편집 모달 */}
      {modal.type === 'detail' && (modal.data as Action) && callsignsData && (
        <ActionModal
          airlineId={airlineId || ''}
          callsigns={callsignsData.data}
          selectedCallsign={callsignsData.data.find((cs) => cs.id === (modal.data as Action).callsign_id)}
          actionId={(modal.data as Action).id}
          initialData={{
            callsignId: String((modal.data as Action).callsign_id),
            callsign_id: String((modal.data as Action).callsign_id),
            actionType: (modal.data as Action).action_type,
            description: (modal.data as Action).description,
            plannedDueDate: toInputDate((modal.data as Action).planned_due_date) || undefined,
            completedDate: toInputDate((modal.data as Action).completed_at) || toInputDate((modal.data as Action).registered_at) || undefined,
            status: (modal.data as Action).status === 'pending' ? 'in_progress' : ((modal.data as Action).status || 'in_progress'),
          }}
          onClose={modal.closeModal}
          onSuccess={handleActionDetailSuccess}
        />
      )}

      {/* 호출부호 상세 모달 */}
      {modal.type === 'callsign-detail' && (modal.data as Callsign) && callsignDetailMeta && (
        <div
          className="fixed inset-0 bg-black/35 flex items-center justify-center z-50 overflow-y-auto"
          onClick={modal.closeModal}
        >
          <div
            className="w-[900px] max-w-[95vw] bg-white rounded-xl shadow-2xl p-8 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-black text-gray-900">
                  {(modal.data as Callsign).callsign_pair}
                </h2>
                <p className="text-sm text-gray-500 mt-2">발생내역 상세정보</p>
              </div>
              <button
                type="button"
                onClick={modal.closeModal}
                className="text-2xl text-gray-400 hover:text-gray-600 transition"
              >
                ×
              </button>
            </div>

            {/* 상세정보 그리드 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">발생건수</p>
                <p className="text-2xl font-black text-orange-600">{callsignDetailMeta.occurrenceCount}건</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">최초 발생일</p>
                <p className="text-sm font-bold text-gray-900">{formatDisplayDate(callsignDetailMeta.firstOccurredAt)}</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">최근 발생일</p>
                <p className="text-sm font-bold text-gray-900">{formatDisplayDate(callsignDetailMeta.lastOccurredAt)}</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">유사성</p>
                <p className="text-sm font-bold text-gray-900">{callsignDetailMeta.similarity}</p>
              </div>
              <div className="p-4 border border-gray-200 rounded-lg bg-white">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">오류가능성</p>
                <p className="text-sm font-bold text-gray-900">{callsignDetailMeta.riskLevel}</p>
              </div>
            </div>

            {/* 호출부호 정보 */}
            <div className="mb-6">
              <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-3">호출부호 정보</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 border border-gray-200 rounded-lg bg-blue-50">
                  <p className="text-xs font-semibold text-gray-500 mb-1">자사 호출부호</p>
                  <p className="text-base font-black text-blue-700">{callsignDetailMeta.myCallsign}</p>
                </div>
                <div className="p-3 border border-gray-200 rounded-lg bg-red-50">
                  <p className="text-xs font-semibold text-gray-500 mb-1">타사 호출부호</p>
                  <p className="text-base font-black text-red-700">{callsignDetailMeta.otherCallsign}</p>
                </div>
                <div className="p-3 border border-gray-200 rounded-lg">
                  <p className="text-xs font-semibold text-gray-500 mb-1">오류 유형</p>
                  <p className="text-sm font-bold text-gray-900">{callsignDetailMeta.errorType}</p>
                </div>
                <div className="p-3 border border-gray-200 rounded-lg">
                  <p className="text-xs font-semibold text-gray-500 mb-1">세부 오류</p>
                  <p className="text-sm font-bold text-gray-900">{callsignDetailMeta.subError}</p>
                </div>
              </div>
            </div>

            {/* 대상 항공사 정보 */}
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-2">대상 항공사</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-semibold">타사 항공사 코드</p>
                  <p className="text-lg font-black text-indigo-700 mt-1">{selectedCallsignForDetail.other_airline_code || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold">조치 대상</p>
                  <p className="text-sm text-gray-900 font-bold mt-1">양사 조치 필요 (조치상태 확인 필수)</p>
                </div>
              </div>
            </div>

            {/* ATC 관제사 의견 */}
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest mb-2">🎯 ATC 관제사 의견</h3>
              <p className="text-sm font-semibold text-gray-900">
                {selectedCallsignForDetail.atc_recommendation || '별도 의견 없음'}
              </p>
            </div>

            {/* 닫기 버튼 */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsCallsignDetailModalOpen(false)}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 공지사항 팝업 */}
      {isAnnouncementPopupOpen && unreadAnnouncements.length > 0 && (
        <AnnouncementPopup
          announcements={unreadAnnouncements}
          onClose={() => setIsAnnouncementPopupOpen(false)}
          onAllRead={() => setIsAnnouncementPopupOpen(false)}
        />
      )}

      {/* Footer */}
      <footer className="mt-10 py-5 bg-gray-800 text-gray-300 border-t border-gray-700">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap gap-6 items-center justify-center">
            <div className="text-sm font-medium text-white">
              유사호출부호 경고시스템 | 한국공항공사 · 항공교통본부
            </div>
            <div className="flex gap-5 text-sm">
              <span className="text-gray-400">항행안전팀</span>
              <div>
                <span className="text-gray-400">T.</span>
                <span className="font-medium ml-1">1588-2311</span>
              </div>
              <div>
                <span className="text-gray-400">E.</span>
                <span className="font-medium ml-1">info@airport.kr</span>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-600 mt-3 pt-3 text-xs text-gray-400 text-center">
            © 2026 한국공항공사 · 항공교통본부. 유사호출부호 경고시스템은 항공기 안전운항을 위해 개발되었습니다.
          </div>
        </div>
      </footer>
    </div>
  );
}
