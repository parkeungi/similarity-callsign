// 파일 업로드 React Query 훅 - useFileUploads(이력 목록)·useForceDeleteUpload(강제 삭제)
/**
 * 파일 업로드 이력 조회 훅
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { apiFetch } from '@/lib/api/client';

export interface FileUploadItem {
  id: string;
  file_name: string;
  file_size: number;
  uploaded_by: string;
  uploader_email: string;
  uploaded_at: string;
  total_rows: number;
  success_count: number;
  failed_count: number;
  error_message?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processed_at?: string;
  can_delete?: boolean;
  actions_count?: number;
  // camelCase 버전
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  uploaderEmail: string;
  uploadedAt: string;
  totalRows: number;
  successCount: number;
  failedCount: number;
  errorMessage?: string;
  processedAt?: string;
}

export interface FileUploadListResponse {
  data: FileUploadItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useFileUploads(
  filters?: {
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    page?: number;
    limit?: number;
  }
) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const page = filters?.page || 1;
  const limit = filters?.limit || 20;

  return useQuery({
    queryKey: ['file-uploads', filters?.status, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const response = await apiFetch(`/api/admin/file-uploads?${params.toString()}`);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('인증이 필요합니다.');
        }
        if (response.status === 403) {
          throw new Error('관리자 권한이 필요합니다.');
        }
        throw new Error('파일 업로드 이력 조회 실패');
      }

      const data = (await response.json()) as FileUploadListResponse;
      return data;
    },
    enabled: !!accessToken,
    staleTime: 30 * 1000, // 30초
    gcTime: 5 * 60 * 1000, // 5분
  });
}

/**
 * 파일 업로드 이력 삭제 mutation
 */
export function useDeleteFileUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fileUploadId: string) => {
      const response = await apiFetch(`/api/admin/file-uploads/${fileUploadId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 409) {
          throw new Error(errorData.error || '항공사가 작성한 조치가 있어 삭제할 수 없습니다.');
        }
        if (response.status === 401) {
          throw new Error('인증이 필요합니다.');
        }
        if (response.status === 403) {
          throw new Error('관리자 권한이 필요합니다.');
        }
        if (response.status === 404) {
          throw new Error('업로드 이력을 찾을 수 없습니다.');
        }
        throw new Error(errorData.error || '업로드 이력 삭제 실패');
      }

      return response.json();
    },
    onSuccess: () => {
      // 캐시 무효화: file-uploads와 관련된 모든 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['file-uploads'] });
      queryClient.invalidateQueries({ queryKey: ['callsigns'] });
      queryClient.invalidateQueries({ queryKey: ['airline-callsigns'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['callsigns-with-actions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['callsigns-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['airline-action-stats'], exact: false });
    },
  });
}

/**
 * 파일 강제삭제 mutation (관리자 비밀번호 재검증)
 */
export function useForceDeleteFileUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fileUploadId, adminPassword }: { fileUploadId: string; adminPassword: string }) => {
      if (!adminPassword) {
        throw new Error('관리자 비밀번호가 필요합니다.');
      }

      const response = await apiFetch(`/api/admin/file-uploads/${fileUploadId}/force-delete`, {
        method: 'DELETE',
        body: JSON.stringify({ adminPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 400) {
          throw new Error(errorData.error || '비밀번호가 맞지 않습니다.');
        }
        if (response.status === 401) {
          throw new Error('인증이 필요합니다.');
        }
        if (response.status === 403) {
          throw new Error('관리자 권한이 필요합니다.');
        }
        if (response.status === 404) {
          throw new Error('업로드 이력을 찾을 수 없습니다.');
        }
        throw new Error(errorData.error || '파일 강제 삭제 실패');
      }

      return response.json();
    },
    onSuccess: () => {
      // 캐시 무효화: file-uploads와 관련된 모든 쿼리 무효화
      // (강제삭제는 callsigns과 actions도 삭제하므로 관련 캐시도 함께 무효화)
      queryClient.invalidateQueries({ queryKey: ['file-uploads'] });
      queryClient.invalidateQueries({ queryKey: ['callsigns'] });
      queryClient.invalidateQueries({ queryKey: ['airline-callsigns'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['callsigns-with-actions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['callsigns-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['airline-action-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

/**
 * 전체 데이터 강제삭제 mutation (모든 callsigns, occurrences, actions, file_uploads 삭제)
 */
export function useForceDeleteAllData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (adminPassword: string) => {
      if (!adminPassword) {
        throw new Error('관리자 비밀번호가 필요합니다.');
      }

      const response = await apiFetch('/api/admin/callsigns/force-delete-all', {
        method: 'DELETE',
        body: JSON.stringify({ adminPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 400) {
          throw new Error(errorData.error || '비밀번호가 맞지 않습니다.');
        }
        if (response.status === 401) {
          throw new Error('인증이 필요합니다.');
        }
        if (response.status === 403) {
          throw new Error('관리자 권한이 필요합니다.');
        }
        throw new Error(errorData.error || '전체 데이터 삭제 실패');
      }

      return response.json();
    },
    onSuccess: () => {
      // 캐시 무효화: 모든 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['file-uploads'] });
      queryClient.invalidateQueries({ queryKey: ['callsigns'] });
      queryClient.invalidateQueries({ queryKey: ['airline-callsigns'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['callsigns-with-actions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['callsigns-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['airline-action-stats'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      queryClient.invalidateQueries({ queryKey: ['airline-actions'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}
