// 사용자 승인 테이블 - User[] 렌더링, 승인(approved)/거부(rejected)/정지(suspended) 액션 버튼, PATCH /api/admin/users/[id] 호출
/**
 * UserApprovalTable 컴포넌트 (관리자용)
 * - 사용자 목록 표시
 * - 승인/거부/정지/활성화 액션
 * - TanStack Query로 데이터 패칭 + 뮤테이션
 */

'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useUsers, useUserMutations } from '@/hooks/useUsers';
import { useAdminAirlines } from '@/hooks/useAirlines';
import { User } from '@/types/user';
import { CreateUserModal } from './CreateUserModal';

type FilterStatus = 'all' | 'active' | 'suspended';

const filterLabels: Record<FilterStatus, string> = {
  all: '전체',
  active: '활성',
  suspended: '정지',
};

function formatDate(isoString: string) {
  return new Date(isoString).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function UserApprovalTable() {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [updatingAirline, setUpdatingAirline] = useState<{ userId: string; airlineId: string } | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ userId: string; email: string } | null>(null);
  const queryClient = useQueryClient();

  const {
    data: users = [],
    isLoading,
    isError,
    error,
  } = useUsers(filter === 'all' ? undefined : (filter as 'active' | 'suspended'));

  const { data: airlines = [], isLoading: airlinesLoading } = useAdminAirlines();
  const { approve, reject, suspend, activate, updateAirline, deleteUser } = useUserMutations();

  async function handleAirlineChange(userId: string, newAirlineCode: string) {
    if (updatingAirline || !newAirlineCode) return;

    setUpdatingAirline({ userId, airlineId: newAirlineCode });
    try {
      await updateAirline.mutateAsync({ userId, airlineCode: newAirlineCode });
    } catch (error) {
      console.error('항공사 변경 실패:', error);
    } finally {
      setUpdatingAirline(null);
    }
  }

  function isMutating(userId: string) {
    return (
      (suspend.isPending && suspend.variables === userId) ||
      (activate.isPending && activate.variables === userId) ||
      (deleteUser.isPending && deleteUser.variables === userId)
    );
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirm) return;
    try {
      await deleteUser.mutateAsync(deleteConfirm.userId);
      setDeleteConfirm(null);
    } catch (error) {
      console.error('사용자 삭제 실패:', error);
    }
  }

  return (
    <div className="space-y-4">
      {/* 액션 바 */}
      <div className="flex items-center justify-between">
        <div />
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsCreateModalOpen(true)}
        >
          + 사용자 추가
        </Button>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2 flex-wrap" role="group" aria-label="사용자 상태 필터">
        {(Object.keys(filterLabels) as FilterStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={[
              'px-3 py-1.5 rounded-none text-sm font-semibold border transition-colors',
              filter === status
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary hover:text-primary',
            ].join(' ')}
            aria-pressed={filter === status}
          >
            {filterLabels[status]}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto rounded-none border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="py-16 text-center">
            <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" aria-label="로딩 중" />
            <p className="mt-3 text-sm text-gray-500">사용자 목록을 불러오는 중...</p>
          </div>
        ) : isError ? (
          <div role="alert" className="py-16 text-center">
            <p className="text-sm text-red-600">
              데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-500">해당 조건의 사용자가 없습니다.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                  이메일
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                  항공사
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                  역할
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                  가입일
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                  최종 로그인
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user: User) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {user.email}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.airline?.code || ''}
                      onChange={(e) => handleAirlineChange(user.id, e.target.value)}
                      disabled={updatingAirline?.userId === user.id || airlinesLoading}
                      className={[
                        'px-2 py-1 text-xs rounded border transition-colors',
                        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0',
                        updatingAirline?.userId === user.id || airlinesLoading
                          ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-primary',
                      ].join(' ')}
                    >
                      <option value="">미지정</option>
                      {airlines.map((airline) => (
                        <option key={airline.code} value={airline.code}>
                          {airline.name_ko} ({airline.code})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {user.role === 'admin' ? '관리자' : '사용자'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {user.last_login_at ? formatDate(user.last_login_at) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {user.status === 'active' && user.role !== 'admin' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          isLoading={suspend.isPending}
                          disabled={isMutating(user.id)}
                          onClick={() => suspend.mutate(user.id)}
                        >
                          정지
                        </Button>
                      )}
                      {user.status === 'suspended' && (
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={activate.isPending}
                          disabled={isMutating(user.id)}
                          onClick={() => activate.mutate(user.id)}
                        >
                          활성화
                        </Button>
                      )}
                      {user.role !== 'admin' && (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={isMutating(user.id)}
                          onClick={() => setDeleteConfirm({ userId: user.id, email: user.email })}
                        >
                          삭제
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400">
        전체 {users.length}명
      </p>

      {/* 사용자 생성 모달 */}
      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* 삭제 확인 다이얼로그 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg max-w-sm mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">사용자 삭제</h3>
            <p className="text-sm text-gray-600 mb-6">
              정말로 <span className="font-semibold">{deleteConfirm.email}</span>을(를) 삭제하시겠습니까?
              <br />
              이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteUser.isPending}
              >
                취소
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={deleteUser.isPending}
                onClick={handleDeleteConfirm}
              >
                삭제
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
