// 시간대별 충돌 패턴 분석 React Query 훅 - GET /api/admin/time-pattern-stats
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { apiFetch } from '@/lib/api/client';

export interface TimePatternOccurrence {
  date: string;
  time: string;
  error_type: string | null;
}

export interface TimePatternItem {
  callsign_pair: string;
  my_callsign: string;
  other_callsign: string;
  airline_code: string;
  other_airline_code: string;
  risk_level: string;
  similarity: string;
  sector: string;
  departure_airport1: string;
  arrival_airport1: string;
  departure_airport2: string;
  arrival_airport2: string;
  occ_count: number;
  pattern_type: 'fixed' | 'roundtrip' | 'scattered';
  primary_hours: number[];
  time_concentration: number;
  occurrences: TimePatternOccurrence[];
}

export interface TimePatternSummary {
  total: number;
  fixed: number;
  roundtrip: number;
  scattered: number;
  structuralRate: number;
}

export interface HourlyDistribution {
  hour: number;
  count: number;
}

export interface TimePatternStatsResponse {
  data: TimePatternItem[];
  summary: TimePatternSummary;
  hourlyDistribution: HourlyDistribution[];
}

export function useTimePatternStats(options?: {
  minCount?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const minCount = options?.minCount ?? 4;
  const dateFrom = options?.dateFrom;
  const dateTo = options?.dateTo;

  return useQuery<TimePatternStatsResponse>({
    queryKey: ['timePatternStats', minCount, dateFrom, dateTo],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('minCount', String(minCount));
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const response = await apiFetch(`/api/admin/time-pattern-stats?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '데이터 조회 실패');
      }

      return response.json();
    },
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}
