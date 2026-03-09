/**
 * 항공사 관련 React Query 훅
 * - useAirlines: 공개 API에서 항공사 목록 조회 (인증 불필요)
 * - useAdminAirlines: 관리자 API에서 항공사 목록 조회 (관리자 권한 필요)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { apiFetch } from '@/lib/api/client';
import { supabaseClient } from '@/lib/supabase/client';

export interface Airline {
  id: string;
  code: string;
  name_ko: string;
  name_en: string;
  display_order: number;
}

/**
 * 공개 항공사 목록 조회 (인증 불필요, 클라이언트에서 사용)
 * staleTime: 30초
 */
export function useAirlines() {
  return useQuery({
    queryKey: ['airlines'],
    queryFn: async () => {
      const { data, error } = await supabaseClient
        .from('airlines')
        .select('id, code, name_ko, name_en, display_order')
        .order('display_order', { ascending: true })
        .order('code', { ascending: true });

      if (error) {
        console.error('[useAirlines] Supabase fetch error', error);
        throw new Error('항공사 목록 조회 실패');
      }

      return (data ?? []) as Airline[];
    },
    staleTime: 30 * 1000, // 30초
    gcTime: 5 * 60 * 1000, // 5분 (이전 cacheTime)
  });
}

/**
 * 관리자 항공사 목록 조회 (관리자 권한 필요)
 */
export function useAdminAirlines() {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: ['admin-airlines'],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const response = await apiFetch('/api/admin/airlines');

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('관리자 권한이 필요합니다.');
        }
        throw new Error('항공사 목록 조회 실패');
      }

      const data = await response.json();
      return data.airlines as Airline[];
    },
    enabled: !!accessToken, // accessToken이 있을 때만 쿼리 실행
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * 항공사 생성 (관리자만)
 */
export function useCreateAirline() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      code: string;
      name_ko: string;
      name_en?: string;
    }) => {
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const response = await apiFetch('/api/admin/airlines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '항공사 생성 실패');
      }

      return response.json();
    },
    onSuccess: () => {
      // 항공사 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['airlines'] });
      queryClient.invalidateQueries({ queryKey: ['admin-airlines'] });
    },
  });
}

/**
 * 항공사 수정 (관리자만)
 */
export function useUpdateAirline() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      code?: string;
      name_ko?: string;
      name_en?: string;
      display_order?: number;
    }) => {
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const response = await apiFetch(`/api/admin/airlines/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '항공사 수정 실패');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['airlines'] });
      queryClient.invalidateQueries({ queryKey: ['admin-airlines'] });
    },
  });
}

/**
 * 항공사 삭제 (관리자만)
 */
export function useDeleteAirline() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const response = await apiFetch(`/api/admin/airlines/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '항공사 삭제 실패');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['airlines'] });
      queryClient.invalidateQueries({ queryKey: ['admin-airlines'] });
    },
  });
}
