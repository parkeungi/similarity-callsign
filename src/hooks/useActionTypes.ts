// 조치유형 React Query 훅 - useActionTypes(목록)·useCreateActionType·useUpdateActionType·useDeleteActionType
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { apiFetch } from '@/lib/api/client';
import type { ActionType, CreateActionTypeRequest, UpdateActionTypeRequest } from '@/types/settings';

const BASE_URL = '/api/admin/settings/action-types';
const PUBLIC_URL = '/api/action-types';

// ────────────────────────────────────────────────
// 목록 조회 (관리자용: 비활성 포함)
// ────────────────────────────────────────────────
export function useActionTypes(activeOnly = false) {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery<ActionType[]>({
    queryKey: ['action-types', activeOnly],
    queryFn: async () => {
      const url = activeOnly ? `${BASE_URL}?active_only=true` : BASE_URL;
      const res = await apiFetch(url);
      if (!res.ok) throw new Error('조치유형 목록 조회 실패');
      const json = await res.json();
      return json.data;
    },
    enabled: !!accessToken,
    staleTime: 1000 * 60 * 5, // 5분
  });
}

// ────────────────────────────────────────────────
// 활성 조치유형만 (드롭다운용)
// ────────────────────────────────────────────────
export function useActiveActionTypes() {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery<ActionType[]>({
    queryKey: ['action-types', 'public-active'],
    queryFn: async () => {
      const res = await apiFetch(PUBLIC_URL);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || '조치유형 목록 조회 실패');
      }

      return data?.data ?? [];
    },
    enabled: !!accessToken,
    staleTime: 1000 * 60 * 5,
  });
}

// ────────────────────────────────────────────────
// 생성
// ────────────────────────────────────────────────
export function useCreateActionType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateActionTypeRequest) => {
      const res = await apiFetch(BASE_URL, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '생성 실패');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-types'] });
    },
  });
}

// ────────────────────────────────────────────────
// 수정
// ────────────────────────────────────────────────
export function useUpdateActionType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateActionTypeRequest & { id: string }) => {
      const res = await apiFetch(`${BASE_URL}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '수정 실패');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-types'] });
    },
  });
}

// ────────────────────────────────────────────────
// 소프트 삭제 (비활성화)
// ────────────────────────────────────────────────
export function useDeactivateActionType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`${BASE_URL}/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '비활성화 실패');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-types'] });
    },
  });
}

// ────────────────────────────────────────────────
// 재활성화
// ────────────────────────────────────────────────
export function useReactivateActionType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiFetch(`${BASE_URL}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: true }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '재활성화 실패');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-types'] });
    },
  });
}
