import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { apiFetch } from '@/lib/api/client';

interface MonthlyTrendData {
  month: string;
  newDetections: number;
  repeatDetections: number;
  totalDetections: number;
  newRate: number;
  repeatRate: number;
}

export function useMonthlyDetectionTrend() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery<MonthlyTrendData[]>({
    queryKey: ['monthlyDetectionTrend'],
    queryFn: async () => {
      const response = await apiFetch('/api/admin/monthly-detection-trend');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '데이터 조회 실패');
      }

      const data = await response.json();
      return data.data;
    },
    enabled: !!accessToken,
    staleTime: 5 * 60 * 1000, // 5분
    retry: 2
  });
}
