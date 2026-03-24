// 조치 React Query 훅 - useAirlineActions(목록)·useCreateAction(POST)·useUpdateAction(PATCH)·useDeleteAction(DELETE), invalidateQueries로 캐시 갱신
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
import { apiFetch } from '@/lib/api/client';
import { supabaseClient } from '@/lib/supabase/client';
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
      const params = new URLSearchParams();
      if (filters?.airlineId) params.append('airlineId', filters.airlineId);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.append('dateTo', filters.dateTo);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const response = await apiFetch(`/api/actions?${params.toString()}`);

      if (!response.ok) {
        throw new Error('조치 목록 조회 실패');
      }

      const data = (await response.json()) as ActionListResponse;
      return data;
    },
    enabled: !!accessToken && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 10 * 60 * 1000, // 10분
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
}, options?: { enabled?: boolean }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const page = filters?.page || 1;
  const limit = filters?.limit || 20;

  return useQuery({
    queryKey: ['airline-actions', filters?.airlineId, filters?.status, filters?.search, filters?.dateFrom, filters?.dateTo, page, limit],
    queryFn: async () => {
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

      const response = await apiFetch(`/api/airlines/${filters.airlineId}/actions?${params.toString()}`);

      if (!response.ok) {
        throw new Error('조치 목록 조회 실패');
      }

      const data = (await response.json()) as ActionListResponse;
      return data;
    },
    enabled: !!accessToken && !!filters?.airlineId && (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 10 * 60 * 1000, // 10분
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
  const page = filters?.page || 1;
  const limit = filters?.limit ?? 10;

  return useQuery({
    queryKey: ['callsigns', filters?.airlineId, filters?.riskLevel, page, limit],
    queryFn: async () => {
      return fetchCallsignsFromSupabase({
        airlineId: filters?.airlineId,
        riskLevel: filters?.riskLevel,
        page,
        limit,
      });
    },
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
      if (!airlineId) {
        throw new Error('항공사 ID가 필요합니다.');
      }

      const params = new URLSearchParams();
      if (filters?.riskLevel) params.append('riskLevel', filters.riskLevel);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const response = await apiFetch(
        `/api/airlines/${airlineId}/callsigns?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('호출부호 목록 조회 실패');
      }

      const data = (await response.json()) as CallsignListResponse;
      return data;
    },
    enabled: !!accessToken && !!airlineId && (options?.enabled ?? true),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

type CallsignQueryParams = {
  airlineId?: string;
  riskLevel?: string;
  page: number;
  limit: number;
};

async function fetchCallsignsFromSupabase({
  airlineId,
  riskLevel,
  page,
  limit,
}: CallsignQueryParams): Promise<CallsignListResponse> {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabaseClient
    .from('callsigns')
    .select(
      `
        id,
        airline_id,
        airline_code,
        callsign_pair,
        my_callsign,
        other_callsign,
        other_airline_code,
        error_type,
        sub_error,
        risk_level,
        similarity,
        sector,
        atc_recommendation,
        occurrence_count,
        last_occurred_at,
        file_upload_id,
        uploaded_at,
        created_at,
        updated_at,
        status,
        my_action_status,
        other_action_status,
        actions!actions_callsign_id_fkey (
          id,
          status,
          manager_name,
          updated_at,
          registered_at
        )
      `,
      { count: 'exact' }
    )
    .range(from, to)
    .order('risk_level', { ascending: false })
    .order('occurrence_count', { ascending: false });

  if (airlineId) {
    query = query.eq('airline_id', airlineId);
  }

  if (riskLevel) {
    query = query.eq('risk_level', riskLevel);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[useCallsigns] Supabase fetch error', error);
    throw new Error('호출부호 목록 조회 실패');
  }

  const normalized = (data || []).map(transformCallsignRow);

  const summary = buildCallsignSummary(normalized);
  const total = count ?? normalized.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return {
    data: normalized,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    summary,
  };
}

function transformCallsignRow(row: any): Callsign & {
  latest_action_id?: string | null;
  latest_action_status?: string | null;
  latest_action_manager_name?: string | null;
  latest_action_updated_at?: string | null;
  final_status?: 'completed' | 'partial' | 'in_progress';
} {
  const latestAction = row.actions?.[0];
  const finalStatus = calculateFinalStatus(row);

  const mapped = {
    ...row,
    latest_action_id: latestAction?.id ?? null,
    latest_action_status: latestAction?.status ?? null,
    latest_action_manager_name: latestAction?.manager_name ?? null,
    latest_action_updated_at: latestAction?.updated_at ?? null,
    final_status: finalStatus,
    airlineId: row.airline_id,
    airlineCode: row.airline_code,
    callsignPair: row.callsign_pair,
    myCallsign: row.my_callsign,
    otherCallsign: row.other_callsign,
    otherAirlineCode: row.other_airline_code,
    errorType: row.error_type,
    subError: row.sub_error,
    riskLevel: row.risk_level,
    occurrenceCount: row.occurrence_count,
    lastOccurredAt: row.last_occurred_at,
    fileUploadId: row.file_upload_id,
    uploadedAt: row.uploaded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    latestActionId: latestAction?.id ?? null,
    latestActionStatus: latestAction?.status ?? null,
    latestActionManager: latestAction?.manager_name ?? null,
    latestActionUpdatedAt: latestAction?.updated_at ?? null,
  };

  delete (mapped as any).actions;
  return mapped;
}

/**
 * 서버가 계산한 status와 양쪽 action_status를 기반으로 최종 표시 상태 결정
 * - completed: 서버가 completed로 판정 (완료 조건 매트릭스 충족)
 * - partial: 서버는 아직 in_progress이지만 한쪽은 completed
 * - in_progress: 양쪽 모두 미완료
 */
function calculateFinalStatus(row: any): 'completed' | 'partial' | 'in_progress' {
  // 서버가 계산한 최종 상태를 우선 사용
  if (row.status === 'completed') {
    return 'completed';
  }

  const myCompleted = (row.my_action_status || 'no_action') === 'completed';
  const otherCompleted = (row.other_action_status || 'no_action') === 'completed';

  if (myCompleted || otherCompleted) {
    return 'partial';
  }
  return 'in_progress';
}

function buildCallsignSummary(rows: Array<{ final_status?: string }>) {
  const summary = {
    total: rows.length,
    completed: 0,
    partial: 0,
    in_progress: 0,
  };

  rows.forEach((row) => {
    switch (row.final_status) {
      case 'completed':
        summary.completed += 1;
        break;
      case 'partial':
        summary.partial += 1;
        break;
      default:
        summary.in_progress += 1;
    }
  });

  return summary;
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
      if (!airlineId) {
        throw new Error('항공사 ID가 필요합니다.');
      }

      const params = new URLSearchParams();
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.append('dateTo', filters.dateTo);

      const qs = params.toString();
      const response = await apiFetch(
        `/api/airlines/${airlineId}/actions/stats${qs ? `?${qs}` : ''}`
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
      const response = await apiFetch(`/api/actions/${actionId}`);

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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateActionRequest & { airlineId: string }) => {
      const { airlineId, ...actionData } = data;

      const response = await apiFetch(`/api/airlines/${airlineId}/actions`, {
        method: 'POST',
        body: JSON.stringify(actionData),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error || '조치 등록 실패');
        } else {
          throw new Error('조치 등록 실패: 서버 오류');
        }
      }

      return (await response.json()) as Action;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['airline-actions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['airline-action-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['airline-callsigns'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['callsigns-with-actions'], exact: false });
    },
  });
}

/**
 * 조치 상태 업데이트 (관리자만)
 */
export function useUpdateAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateActionRequest & { id: string }) => {
      const { id, ...updateData } = data;

      const response = await apiFetch(`/api/actions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error || '조치 업데이트 실패');
        } else {
          throw new Error('조치 업데이트 실패: 서버 오류');
        }
      }

      return (await response.json()) as Action;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['airline-actions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['action'] });
      queryClient.invalidateQueries({ queryKey: ['airline-action-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['airline-callsigns'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['callsigns-with-actions'], exact: false });
    },
  });
}

/**
 * 조치 삭제 (관리자만)
 */
export function useDeleteAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiFetch(`/api/actions/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error || '조치 삭제 실패');
        } else {
          throw new Error('조치 삭제 실패: 서버 오류');
        }
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['airline-actions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['airline-action-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['airline-callsigns'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['callsigns-with-actions'], exact: false });
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
    airlineFilter?: string;
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
    queryKey: ['callsigns-with-actions', filters?.riskLevel, filters?.airlineId, filters?.airlineFilter, filters?.myActionStatus, filters?.actionType, filters?.dateFrom, filters?.dateTo, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.riskLevel) params.append('riskLevel', filters.riskLevel);
      if (filters?.airlineId) params.append('airlineId', filters.airlineId);
      if (filters?.airlineFilter) params.append('airlineFilter', filters.airlineFilter);
      if (filters?.myActionStatus) params.append('myActionStatus', filters.myActionStatus);
      if (filters?.actionType) params.append('actionType', filters.actionType);
      if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.append('dateTo', filters.dateTo);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const response = await apiFetch(
        `/api/callsigns-with-actions?${params.toString()}`
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

/**
 * 재검출 항목 확인 처리
 * PATCH /api/airlines/:airlineId/callsigns/:callsignId/acknowledge
 */
export function useAcknowledgeReDetection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ airlineId, callsignId }: { airlineId: string; callsignId: string }) => {
      const response = await apiFetch(
        `/api/airlines/${airlineId}/callsigns/${callsignId}/acknowledge`,
        { method: 'PATCH' }
      );

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const error = await response.json();
          throw new Error(error.error || '재검출 확인 처리 실패');
        } else {
          throw new Error('재검출 확인 처리 실패: 서버 오류');
        }
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['airline-callsigns'], exact: false });
    },
  });
}
