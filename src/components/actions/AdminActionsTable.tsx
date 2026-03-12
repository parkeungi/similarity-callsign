// 관리자 조치 테이블 - Action[] 렌더링, 항공사·호출부호·상태·담당자 컬럼, 행 클릭 시 상세 모달, 페이지네이션
"use client";

import type { ActionListResponse } from '@/types/action';

type StatusMap = Record<string, string>;

type StatusKey = 'pending' | 'in_progress' | 'completed';

type RiskLevel = '매우높음' | '높음' | '낮음';

interface AdminActionsTableProps {
  data?: ActionListResponse;
  isLoading: boolean;
  error: unknown;
  statusColors: StatusMap;
  statusLabels: StatusMap;
  riskColors: StatusMap;
  page: number;
  onPageChange: (page: number) => void;
}

export function AdminActionsTable({
  data,
  isLoading,
  error,
  statusColors,
  statusLabels,
  riskColors,
  page,
  onPageChange,
}: AdminActionsTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-8 text-center text-gray-600">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-8 text-center text-red-600">
          {error instanceof Error ? error.message : '조치 목록 조회 실패'}
        </div>
      </div>
    );
  }

  const rows = data?.data ?? [];

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {rows.length === 0 ? (
        <div className="p-8 text-center text-gray-600">조치가 없습니다.</div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">항공사</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">호출부호</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">조치 유형</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">담당자</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">상태</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">등록일</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((action) => (
              <tr key={action.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {action.airline?.code}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="font-medium">{action.callsign?.callsign_pair}</div>
                  <div className="text-xs text-gray-500">
                    위험도:{' '}
                    <span
                      style={{ color: riskColors[action.callsign?.risk_level as RiskLevel] || '#4b5563' }}
                    >
                      {action.callsign?.risk_level}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{action.action_type}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{action.manager_name || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    style={{
                      backgroundColor: statusColors[action.status],
                      color: '#ffffff',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {statusLabels[action.status as StatusKey]}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(action.registered_at).toLocaleDateString('ko-KR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data && data.pagination.totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            이전
          </button>
          <span className="text-sm text-gray-600">
            {page} / {data.pagination.totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(data.pagination.totalPages, page + 1))}
            disabled={page === data.pagination.totalPages}
            className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
