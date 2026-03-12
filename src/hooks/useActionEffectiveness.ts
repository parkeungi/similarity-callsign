// 조치 효과성 React Query 훅 - GET /api/admin/action-effectiveness 호출, 평균처리일수·유형별완료율 반환
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { apiFetch } from '@/lib/api/client';

interface ActionEffectivenessData {
  actionType: string;
  totalActions: number;
  noRepeatCount: number;
  repeatCount: number;
  preventionRate: number;
  avgDaysUntilRepeat: number;
  effectivenessScore: number;
}

export function useActionEffectiveness() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return useQuery<ActionEffectivenessData[]>({
    queryKey: ['actionEffectiveness'],
    queryFn: async () => {
      const response = await apiFetch('/api/admin/action-effectiveness');

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
