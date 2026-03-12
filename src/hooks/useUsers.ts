// 사용자 관리 React Query 훅 - useUsers(목록)·useUpdateUserStatus(PATCH 승인/거부)·useCreateUser(POST 사전등록)
/**
 * useUsers 훅 (관리자용)
 * - TanStack Query로 사용자 목록 패칭 + 뮤테이션
 * - apiFetch 사용: 401 시 자동 토큰 갱신 인터셉터 적용
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { authStore } from '@/store/authStore';

type UserStatusFilter = 'active' | 'suspended' | undefined;

async function getUsersAPI(status?: UserStatusFilter) {
  const query = status ? `?status=${status}` : '';
  const response = await apiFetch(`/api/admin/users${query}`);
  if (!response.ok) throw new Error('Failed to fetch users');
  const data = await response.json();
  return data.users;
}

async function approveUserAPI(userId: string, adminId: string) {
  const response = await apiFetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'active' }),
  });
  if (!response.ok) throw new Error('Failed to approve user');
  return response.json();
}

async function rejectUserAPI(userId: string) {
  const response = await apiFetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'suspended' }),
  });
  if (!response.ok) throw new Error('Failed to reject user');
  return response.json();
}

async function suspendUserAPI(userId: string) {
  const response = await apiFetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'suspended' }),
  });
  if (!response.ok) throw new Error('Failed to suspend user');
  return response.json();
}

async function activateUserAPI(userId: string) {
  const response = await apiFetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'active' }),
  });
  if (!response.ok) throw new Error('Failed to activate user');
  return response.json();
}

async function updateUserAirlineAPI(userId: string, airlineCode: string) {
  const response = await apiFetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ airlineCode }),
  });
  if (!response.ok) throw new Error('Failed to update user airline');
  return response.json();
}

async function deleteUserAPI(userId: string) {
  const response = await apiFetch(`/api/admin/users/${userId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete user');
  return response.json();
}

export function useUsers(status?: UserStatusFilter) {
  return useQuery({
    queryKey: ['admin', 'users', status],
    queryFn: () => getUsersAPI(status),
    staleTime: 30_000,
  });
}

export function useUserMutations() {
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'], exact: false });

  const approve = useMutation({
    mutationFn: (userId: string) => {
      const currentUser = authStore.getState().user;
      if (!currentUser?.id) throw new Error('관리자 정보를 찾을 수 없습니다.');
      return approveUserAPI(userId, currentUser.id);
    },
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: rejectUserAPI,
    onSuccess: invalidate,
  });

  const suspend = useMutation({
    mutationFn: suspendUserAPI,
    onSuccess: invalidate,
  });

  const activate = useMutation({
    mutationFn: activateUserAPI,
    onSuccess: invalidate,
  });

  const updateAirline = useMutation({
    mutationFn: ({ userId, airlineCode }: { userId: string; airlineCode: string }) =>
      updateUserAirlineAPI(userId, airlineCode),
    onSuccess: invalidate,
  });

  const deleteUser = useMutation({
    mutationFn: deleteUserAPI,
    onSuccess: invalidate,
  });

  return { approve, reject, suspend, activate, updateAirline, deleteUser };
}
