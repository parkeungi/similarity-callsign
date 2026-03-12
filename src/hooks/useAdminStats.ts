// 관리자 통계 React Query 훅 - useAdminOverview·useComprehensiveStats·useAirlineStats, 대시보드 데이터 조회
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { apiFetch } from '@/lib/api/client';

/**
 * 조치 유형별 분포 통계
 */
export interface ActionTypeStats {
  action_type: string;
  total_count: number;
  completed_count: number;
  in_progress_count: number;
  pending_count: number;
  completion_rate: number;
}

export interface DateRange {
  dateFrom?: string;
  dateTo?: string;
}

export function useActionTypeStats(dateRange?: DateRange) {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: ['admin-action-type-stats', dateRange?.dateFrom, dateRange?.dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.dateFrom) params.append('dateFrom', dateRange.dateFrom);
      if (dateRange?.dateTo) params.append('dateTo', dateRange.dateTo);

      const response = await apiFetch(`/api/admin/action-type-stats?${params.toString()}`);

      if (!response.ok) {
        throw new Error('통계 조회 실패');
      }

      const result = await response.json();
      return result.data as ActionTypeStats[];
    },
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
  });
}

/**
 * 중복 유사호출부호 현황 통계
 */
export interface DuplicateCallsignsByType {
  airline_code: string;
  airline_name_ko: string;
  action_type: string;
  count: number;
  total_actions: number;
  percentage: number;
  opportunity_score: number;
}

export interface DuplicateCallsignsSummary {
  airline_code: string;
  airline_name_ko: string;
  unique_action_types: number;
  total_actions: number;
  unique_callsigns: number;
  duplicate_rate: number;
}

export interface DuplicateCallsignsResponse {
  action_types: DuplicateCallsignsByType[];
  summary: DuplicateCallsignsSummary[];
}

export function useDuplicateCallsignsStats() {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: ['admin-duplicate-callsigns-stats'],
    queryFn: async () => {
      const response = await apiFetch('/api/admin/duplicate-callsigns-stats');

      if (!response.ok) {
        throw new Error('통계 조회 실패');
      }

      return (await response.json()) as DuplicateCallsignsResponse;
    },
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
  });
}

/**
 * 항공사별 집계 통계
 */
export interface AirlineDetailStats {
  airline_id: string;
  airline_code: string;
  airline_name_ko: string;
  total_callsigns: number;
  pending_callsigns: number;  // 미조치 호출부호
  in_progress_actions: number;  // 진행중 (pending + in_progress 통합)
  completed_actions: number;  // 완료
  action_rate: number;  // 조치율 = (진행중+완료)/전체 × 100%
  completion_rate: number;  // 완료율 = 완료/(진행중+완료) × 100%
}

export function useAirlineDetailStats(dateRange?: DateRange) {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: ['admin-airline-stats', dateRange?.dateFrom, dateRange?.dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.dateFrom) params.append('dateFrom', dateRange.dateFrom);
      if (dateRange?.dateTo) params.append('dateTo', dateRange.dateTo);

      const response = await apiFetch(`/api/admin/airline-stats?${params.toString()}`);

      if (!response.ok) {
        throw new Error('통계 조회 실패');
      }

      const result = await response.json();
      return result.data as AirlineDetailStats[];
    },
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
  });
}

/**
 * 종합 통계 (관리자용 대시보드 메인 다차원 분석 데이터)
 */
export interface SystemStatsResponse {
  monthlyTrend: { month: string; count: number }[];
  dailyTrend: { day: string; count: number }[];
  topAirlines: { name: string; count: number }[];
  errorDistribution: { name: string; value: number }[];
  routeDistribution: { name: string; count: number }[];
  timeDistribution: { name: string; count: number }[];
}

export function useSystemStats(dateRange?: DateRange) {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: ['admin-system-stats', dateRange?.dateFrom, dateRange?.dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.dateFrom) params.append('dateFrom', dateRange.dateFrom);
      if (dateRange?.dateTo) params.append('dateTo', dateRange.dateTo);

      const response = await apiFetch(`/api/admin/comprehensive-stats?${params.toString()}`);

      if (!response.ok) {
        throw new Error('통계 조회 실패');
      }

      const result = await response.json();
      return result.data as SystemStatsResponse;
    },
    enabled: !!accessToken,
    staleTime: 60 * 1000, // 1분
    gcTime: 5 * 60 * 1000, // 5분
  });
}
