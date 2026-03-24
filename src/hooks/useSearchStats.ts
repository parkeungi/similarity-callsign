// 사전조회 검색 통계 React Query 훅
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { apiFetch } from '@/lib/api/client';
import type { DateRange } from './useAdminStats';

export interface SearchStatsSummary {
  totalSearches: number;
  uniqueCallsigns: number;
  zeroResultSearches: number;
  avgResultCount: number;
}

export interface SearchStatsResponse {
  summary: SearchStatsSummary;
  dailyTrend: { day: string; count: number }[];
  topCallsigns: { callsign: string; count: number }[];
  airlineDistribution: { airline_code: string; count: number }[];
  hourlyDistribution: { hour: string; count: number }[];
}

export function useSearchStats(dateRange?: DateRange) {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    queryKey: ['admin-search-stats', dateRange?.dateFrom, dateRange?.dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange?.dateFrom) params.append('dateFrom', dateRange.dateFrom);
      if (dateRange?.dateTo) params.append('dateTo', dateRange.dateTo);

      const response = await apiFetch(`/api/admin/search-stats?${params.toString()}`);
      if (!response.ok) throw new Error('검색 통계 조회 실패');

      const result = await response.json();
      return result.data as SearchStatsResponse;
    },
    enabled: !!accessToken,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
