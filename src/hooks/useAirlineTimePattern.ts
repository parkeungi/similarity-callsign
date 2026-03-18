// 항공사별 시간대별 충돌 패턴 분석 React Query 훅 - GET /api/airlines/[airlineId]/time-pattern-stats
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { apiFetch } from '@/lib/api/client';
import type { TimePatternStatsResponse } from '@/hooks/useTimePatternStats';

export function useAirlineTimePattern(
  airlineId: string | undefined,
  options?: {
    minCount?: number;
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const minCount = options?.minCount ?? 2;
  const dateFrom = options?.dateFrom;
  const dateTo = options?.dateTo;

  return useQuery<TimePatternStatsResponse>({
    queryKey: ['airlineTimePattern', airlineId, minCount, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('minCount', String(minCount));
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const response = await apiFetch(`/api/airlines/${airlineId}/time-pattern-stats?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '데이터 조회 실패');
      }

      return data;
    },
    enabled: !!accessToken && !!airlineId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
