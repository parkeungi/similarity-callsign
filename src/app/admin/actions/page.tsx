'use client';

import { useState, useMemo } from 'react';
import { ActionModal } from '@/components/actions/ActionModal';
import { AdminActionsFilters } from '@/components/actions/AdminActionsFilters';
import { AdminActionsTable } from '@/components/actions/AdminActionsTable';
import { useAllActions, useAirlineCallsigns } from '@/hooks/useActions';
import { useAdminAirlines } from '@/hooks/useAirlines';
import Link from 'next/link';
import * as XLSX from 'xlsx';

type ActionStatusFilter = 'pending' | 'in_progress' | 'completed' | '';

export default function AdminActionsPage() {
  // 기본값: 이달 1월 1일부터 현재까지
  const getDefaultDateFrom = () => {
    const today = new Date();
    return `${today.getFullYear()}-01-01`;
  };

  const getDefaultDateTo = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [selectedAirlineId, setSelectedAirlineId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<ActionStatusFilter>('');
  const [dateFrom, setDateFrom] = useState<string>(getDefaultDateFrom());
  const [dateTo, setDateTo] = useState<string>(getDefaultDateTo());
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [limit] = useState(20);

  // 항공사 목록 조회
  const airlinesQuery = useAdminAirlines();

  // 전체 조치 목록 조회
  const actionsQuery = useAllActions({
    airlineId: selectedAirlineId || undefined,
    status: selectedStatus as any,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    limit,
  });

  // 선택한 항공사의 호출부호 목록
  const callsignsQuery = useAirlineCallsigns(selectedAirlineId, { limit: 100 });

  const statusColors: Record<string, string> = {
    pending: '#f59e0b',
    in_progress: '#3b82f6',
    completed: '#10b981',
  };

  const statusLabels: Record<string, string> = {
    pending: '대기중',
    in_progress: '진행중',
    completed: '완료',
  };

  const riskColors: Record<string, string> = {
    '매우높음': '#dc2626',
    '높음': '#f59e0b',
    '낮음': '#16a34a',
  };

  const airlines = airlinesQuery.data ?? [];
  const actionsDataRaw = actionsQuery.data;

  // 검색 필터링 (클라이언트 사이드)
  const actionsData = useMemo(() => {
    if (!actionsDataRaw) return actionsDataRaw;
    if (!searchQuery.trim()) return actionsDataRaw;
    const q = searchQuery.trim().toLowerCase();
    const filtered = actionsDataRaw.data.filter((a) =>
      (a.callsign?.callsign_pair && a.callsign.callsign_pair.toLowerCase().includes(q)) ||
      (a.action_type && a.action_type.toLowerCase().includes(q)) ||
      (a.manager_name && a.manager_name.toLowerCase().includes(q)) ||
      (a.airline?.code && a.airline.code.toLowerCase().includes(q)) ||
      (a.airline?.name_ko && a.airline.name_ko.toLowerCase().includes(q))
    );
    return {
      ...actionsDataRaw,
      data: filtered,
      pagination: { ...actionsDataRaw.pagination, total: filtered.length },
    };
  }, [actionsDataRaw, searchQuery]);

  const canExport = (actionsData?.data.length ?? 0) > 0;
  const summary = actionsData
    ? {
        total: actionsData.pagination.total,
        selectedStatusLabel: selectedStatus ? statusLabels[selectedStatus] : undefined,
        filteredCount: selectedStatus ? actionsData.data.length : undefined,
      }
    : undefined;

  const handleExport = () => {
    if (!actionsData?.data) return;
    const rows = actionsData.data.map((a) => ({
      '항공사': a.airline?.code,
      '호출부호 쌍': a.callsign?.callsign_pair,
      '위험도': a.callsign?.risk_level,
      '조치 유형': a.action_type,
      '담당자': a.manager_name || '-',
      '상태': statusLabels[a.status],
      '등록일': new Date(a.registered_at).toLocaleDateString('ko-KR'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '조치목록');
    XLSX.writeFile(wb, `조치목록_${new Date().toLocaleDateString('ko-KR')}.xlsx`);
  };

  const handleResetFilters = () => {
    setSelectedAirlineId('');
    setSelectedStatus('');
    setDateFrom('');
    setDateTo('');
    setSearchQuery('');
    setPage(1);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pb-10 px-4 sm:px-6 lg:px-8 w-full">
        {/* 페이지 헤더 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/admin"
              className="text-sm text-gray-500 hover:text-gray-900 hover:underline"
            >
              대시보드
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-3xl font-bold text-gray-900">조치 관리</h1>
          </div>
          <p className="text-gray-600">항공사별 조치 이력 관리 및 상태 추적</p>

          {/* 관리 기능 탭 */}
          <div className="flex gap-2 mt-6 pt-4 border-t border-gray-200">
            <Link
              href="/admin/users"
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            >
              사용자
            </Link>
            <Link
              href="/admin/airlines"
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            >
              항공사
            </Link>
            <span className="px-3 py-1.5 text-sm font-semibold text-blue-600 bg-blue-50 rounded">
              조치
            </span>
            <Link
              href="/admin/callsign-management"
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
            >
              엑셀입력
            </Link>
          </div>
        </div>

        {/* 필터 및 검색 */}
        <AdminActionsFilters
          airlines={airlines}
          airlinesLoading={airlinesQuery.isLoading}
          selectedAirlineId={selectedAirlineId}
          selectedStatus={selectedStatus}
          dateFrom={dateFrom}
          dateTo={dateTo}
          searchQuery={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setPage(1);
          }}
          onAirlineChange={(value) => {
            setSelectedAirlineId(value);
            setPage(1);
          }}
          onStatusChange={(value) => {
            setSelectedStatus(value);
            setPage(1);
          }}
          onDateFromChange={(value) => {
            setDateFrom(value);
            setPage(1);
          }}
          onDateToChange={(value) => {
            setDateTo(value);
            setPage(1);
          }}
          onReset={handleResetFilters}
          onOpenCreate={() => setIsCreateModalOpen(true)}
          onExport={handleExport}
          canCreate={Boolean(selectedAirlineId)}
          canExport={canExport}
          summary={summary}
        />

        {/* 조치 테이블 */}
        <AdminActionsTable
          data={actionsData}
          isLoading={actionsQuery.isLoading}
          error={actionsQuery.error}
          statusColors={statusColors}
          statusLabels={statusLabels}
          riskColors={riskColors}
          page={page}
          onPageChange={handlePageChange}
        />
      </div>

      {/* 조치 등록 모달 */}
      {isCreateModalOpen && selectedAirlineId && (
        <ActionModal
          airlineId={selectedAirlineId}
          callsigns={callsignsQuery.data?.data || []}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            actionsQuery.refetch();
          }}
        />
      )}
    </div>
  );
}
