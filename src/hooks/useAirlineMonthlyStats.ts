// 항공사별 월별 검출·조치 통계 훅 - /api/admin/airline-monthly-stats 조회
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { apiFetch } from '@/lib/api/client';

export interface AirlineMonthlyEntry {
  month: string;           // "YYYY-MM"
  detection_count: number;
  action_count: number;
}

export interface AirlineMonthlyStatsItem {
  airline_id: string;
  airline_code: string;
  airline_name_ko: string;
  monthly: AirlineMonthlyEntry[];
  total_detection: number;
  total_action: number;
  action_rate: number;  // action_count / detection_count × 100
}

export interface AirlineMonthlyStatsResponse {
  airlines: AirlineMonthlyStatsItem[];
  months: string[];  // 헤더용 월 목록 (오름차순 "YYYY-MM")
}

export function useAirlineMonthlyStats(params?: {
  months?: number;     // 최근 N개월 (기본: 6)
  dateFrom?: string;   // YYYY-MM-DD
  dateTo?: string;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery<AirlineMonthlyStatsResponse>({
    queryKey: ['airlineMonthlyStats', params?.months, params?.dateFrom, params?.dateTo],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.months) searchParams.set('months', String(params.months));
      if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
      if (params?.dateTo) searchParams.set('dateTo', params.dateTo);

      const qs = searchParams.toString();
      const response = await apiFetch(`/api/admin/airline-monthly-stats${qs ? `?${qs}` : ''}`);

      if (!response.ok) {
        throw new Error('항공사별 월별 통계 조회 실패');
      }

      return response.json() as Promise<AirlineMonthlyStatsResponse>;
    },
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000,  // 5분
    gcTime: 15 * 60 * 1000,    // 15분
  });
}
