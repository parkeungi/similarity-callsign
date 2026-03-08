/**
 * 조치(조사/개선) 관련 React Query 훅
 * - useAirlineActions: 조치 목록 조회 (필터/페이지 지원)
 * - useCallsigns: 호출부호 목록 조회
 * - useCreateAction: 조치 등록
 * - useUpdateAction: 조치 상태 업데이트
 * - useDeleteAction: 조치 삭제
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import {
  Action,
  Callsign,
  ActionListResponse,
  CallsignListResponse,
  CreateActionRequest,
  UpdateActionRequest,
  ActionStatisticsResponse,
} from '@/types/action';

/**
 * 전체 조치 목록 조회 (관리자 대시보드용)
 * 필터: airlineId(선택), status, search, dateFrom, dateTo
 * 페이지네이션 지원
 */
export function useAllActions(
  filters?: {
    airlineId?: string;
    status?: 'pending' | 'in_progress' | 'completed';
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  },
  options?: { enabled?: boolean }
) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const page = filters?.page || 1;
  const limit = filters?.limit || 20;

  return useQuery({
    queryKey: ['all-actions', filters?.airlineId, filters?.status, filters?.search, filters?.dateFrom, filters?.dateTo, page, limit],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const params = new URLSearchParams();
      if (filters?.airlineId) params.append('airlineId', filters.airlineId);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.append('dateTo', filters.dateTo);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const response = await fetch(`/api/actions?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('인증이 필요합니다.');
        }
        throw new Error('조치 목록 조회 실패');
      }

      const data = (await response.json()) as ActionListResponse;
      return data;
    },
    enabled: !!accessToken && (options?.enabled ?? true),
    staleTime: 60 * 1000, // 60초 (캐시 시간 증가)
    gcTime: 10 * 60 * 1000, // 10분 (캐시 보관 기간 증가)
  });
}

/**
 * 조치 목록 조회 (항공사별)
 * 필터: status, search, dateFrom, dateTo
 * 페이지네이션 지원
 */
export function useAirlineActions(filters?: {
  airlineId?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const page = filters?.page || 1;
  const limit = filters?.limit || 20;

  return useQuery({
    queryKey: ['airline-actions', filters?.airlineId, filters?.status, filters?.search, filters?.dateFrom, filters?.dateTo, page, limit],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      if (!filters?.airlineId) {
        throw new Error('항공사 ID가 필요합니다.');
      }

      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.append('dateTo', filters.dateTo);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const response = await fetch(`/api/airlines/${filters.airlineId}/actions?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('인증이 필요합니다.');
        }
        throw new Error('조치 목록 조회 실패');
      }

      const data = (await response.json()) as ActionListResponse;
      return data;
    },
    enabled: !!accessToken && !!filters?.airlineId,
    staleTime: 30 * 1000, // 30초
    gcTime: 5 * 60 * 1000, // 5분
  });
}

/**
 * 호출부호 목록 조회 (인증 필요)
 * 필터: airlineId(선택), riskLevel
 * 페이지네이션 지원
 */
export function useCallsigns(filters?: {
  airlineId?: string;
  riskLevel?: string;
  page?: number;
  limit?: number;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const page = filters?.page || 1;
  const limit = filters?.limit ?? 10;

  return useQuery({
    queryKey: ['callsigns', filters?.airlineId, filters?.riskLevel, page, limit],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const params = new URLSearchParams();
      if (filters?.airlineId) params.append('airlineId', filters.airlineId);
      if (filters?.riskLevel) params.append('riskLevel', filters.riskLevel);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const response = await fetch(`/api/callsigns?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('호출부호 목록 조회 실패');
      }

      const data = (await response.json()) as CallsignListResponse;
      return data;
    },
    enabled: !!accessToken,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * 항공사별 호출부호 목록 조회 (인증 필요)
 */
export function useAirlineCallsigns(
  airlineId: string | undefined,
  filters?: {
    riskLevel?: string;
    page?: number;
    limit?: number;
  },
  options?: { enabled?: boolean }
) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const page = filters?.page || 1;
  const limit = filters?.limit || 20;

  return useQuery({
    queryKey: ['airline-callsigns', airlineId, filters?.riskLevel, page, limit],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const params = new URLSearchParams();
      if (filters?.riskLevel) params.append('riskLevel', filters.riskLevel);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const response = await fetch(
        `/api/airlines/${airlineId}/callsigns?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('항공사별 호출부호 조회 실패');
      }

      const data = (await response.json()) as CallsignListResponse;
      return data;
    },
    enabled: !!accessToken && !!airlineId && (options?.enabled ?? true),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * 항공사별 조치 통계 조회
 */
export function useAirlineActionStats(
  airlineId?: string,
  filters?: { dateFrom?: string; dateTo?: string },
  options?: { enabled?: boolean }
) {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: ['airline-action-stats', airlineId, filters?.dateFrom, filters?.dateTo],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      if (!airlineId) {
        throw new Error('항공사 ID가 필요합니다.');
      }

      const params = new URLSearchParams();
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.append('dateTo', filters.dateTo);

      const qs = params.toString();
      const response = await fetch(
        `/api/airlines/${airlineId}/actions/stats${qs ? `?${qs}` : ''}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('조치 통계 조회 실패');
      }

      const data = (await response.json()) as ActionStatisticsResponse;
      return data;
    },
    enabled: !!accessToken && !!airlineId && (options?.enabled ?? true),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * 조치 상세 조회
 */
export function useAction(actionId: string | undefined) {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: ['action', actionId],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const response = await fetch(`/api/actions/${actionId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('조치를 찾을 수 없습니다.');
        }
        throw new Error('조치 상세 조회 실패');
      }

      return (await response.json()) as Action;
    },
    enabled: !!accessToken && !!actionId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * 조치 등록 (인증된 사용자 모두)
 */
export function useCreateAction() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateActionRequest & { airlineId: string }) => {
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const { airlineId, ...actionData } = data;

      const response = await fetch(`/api/airlines/${airlineId}/actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(actionData),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error || '조치 등록 실패');
        } else {
          const text = await response.text();
          console.error('API 응답 오류:', text);
          throw new Error('조치 등록 실패: 서버 오류');
        }
      }

      return (await response.json()) as Action;
    },
    onSuccess: () => {
      // 조치 목록, 통계 캐시만 무효화 (호출부호 목록은 유지)
      // airline-callsigns 캐시를 무효화하면 데이터가 재조회되면서
      // 로컬 incidents 데이터와 불일치가 발생하므로 제거
      queryClient.invalidateQueries({ queryKey: ['airline-actions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['airline-action-stats'], exact: false });
    },
  });
}

/**
 * 조치 상태 업데이트 (관리자만)
 */
export function useUpdateAction() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateActionRequest & { id: string }) => {
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const { id, ...updateData } = data;

      const response = await fetch(`/api/actions/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error || '조치 업데이트 실패');
        } else {
          const text = await response.text();
          console.error('API 응답 오류:', text);
          throw new Error('조치 업데이트 실패: 서버 오류');
        }
      }

      return (await response.json()) as Action;
    },
    onSuccess: () => {
      // 조치 목록, 상세, 통계 캐시만 무효화 (호출부호 목록은 유지)
      queryClient.invalidateQueries({ queryKey: ['airline-actions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['action'] });
      queryClient.invalidateQueries({ queryKey: ['airline-action-stats'], exact: false });
    },
  });
}

/**
 * 조치 삭제 (관리자만)
 */
export function useDeleteAction() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const response = await fetch(`/api/actions/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error || '조치 삭제 실패');
        } else {
          const text = await response.text();
          console.error('API 응답 오류:', text);
          throw new Error('조치 삭제 실패: 서버 오류');
        }
      }

      return response.json();
    },
    onSuccess: () => {
      // 조치 목록, 통계 캐시만 무효화 (호출부호 목록은 유지)
      queryClient.invalidateQueries({ queryKey: ['airline-actions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['airline-action-stats'], exact: false });
    },
  });
}

/**
 * 관리자용: 호출부호와 양쪽 항공사의 조치 상태를 함께 조회
 * 필터: riskLevel(선택), airlineId(선택), myActionStatus(선택)
 * 페이지네이션 지원
 */
export function useCallsignsWithActions(
  filters?: {
    riskLevel?: string;
    airlineId?: string;
    myActionStatus?: string;
    actionType?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  },
  options?: { enabled?: boolean }
) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const page = filters?.page || 1;
  const limit = filters?.limit || 20;

  return useQuery({
    queryKey: ['callsigns-with-actions', filters?.riskLevel, filters?.airlineId, filters?.myActionStatus, filters?.actionType, filters?.dateFrom, filters?.dateTo, page, limit],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const params = new URLSearchParams();
      if (filters?.riskLevel) params.append('riskLevel', filters.riskLevel);
      if (filters?.airlineId) params.append('airlineId', filters.airlineId);
      if (filters?.myActionStatus) params.append('myActionStatus', filters.myActionStatus);
      if (filters?.actionType) params.append('actionType', filters.actionType);
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.append('dateTo', filters.dateTo);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const response = await fetch(
        `/api/callsigns-with-actions?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('호출부호 조치 상태 조회 실패');
      }

      const data = (await response.json()) as CallsignListResponse;
      return data;
    },
    enabled: !!accessToken && (options?.enabled ?? true),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
