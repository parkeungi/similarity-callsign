import { useQuery } from '@tanstack/react-query';
import { authStore } from '@/store/authStore';

interface MonthlyTrendData {
  month: string;
  newDetections: number;
  repeatDetections: number;
  totalDetections: number;
  newRate: number;
  repeatRate: number;
}

export function useMonthlyDetectionTrend() {
  const accessToken = authStore((state) => state.accessToken);

  return useQuery<MonthlyTrendData[]>({
    queryKey: ['monthlyDetectionTrend'],
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('인증 토큰이 없습니다.');
      }

      const response = await fetch('/api/admin/monthly-detection-trend', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

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
