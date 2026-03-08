/**
 * 공지사항 관리 시스템 - React Query Hooks
 * TanStack Query v5 기반
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import {
  Announcement,
  AnnouncementDetailResponse,
  ActiveAnnouncementsResponse,
  AnnouncementHistoryResponse,
  AnnouncementHistoryFilters,
  AdminAnnouncementFilters,
  AdminAnnouncementListResponse,
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
} from '@/types/announcement';

// ============================================
// Query Key Factory
// ============================================
export const announcementQueryKeys = {
  all: () => ['announcements'] as const,
  active: () => [...announcementQueryKeys.all(), 'active'] as const,
  history: (filters: AnnouncementHistoryFilters) =>
    [...announcementQueryKeys.all(), 'history', filters] as const,
  detail: (id: string) =>
    [...announcementQueryKeys.all(), 'detail', id] as const,
  admin: () => ['admin', 'announcements'] as const,
  adminList: (filters: AdminAnnouncementFilters) =>
    [...announcementQueryKeys.admin(), 'list', filters] as const,
};

// ============================================
// Query Hooks
// ============================================

/**
 * 활성 공지사항 조회
 * GET /api/announcements
 */
export function useActiveAnnouncements(
  filters?: Record<string, never>,
  options?: { enabled?: boolean }
) {
  const { accessToken } = useAuthStore();

  return useQuery<ActiveAnnouncementsResponse>({
    queryKey: announcementQueryKeys.active(),
    queryFn: async () => {
      const res = await fetch('/api/announcements', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('활성 공지사항 조회 실패');
      }

      return res.json();
    },
    staleTime: 30 * 1000,      // 30초
    gcTime: 5 * 60 * 1000,     // 5분
    enabled: !!accessToken && (options?.enabled ?? true),
  });
}

/**
 * 공지사항 이력 조회
 * GET /api/announcements/history
 */
export function useAnnouncementHistory(
  filters: AnnouncementHistoryFilters = {}
) {
  const { accessToken } = useAuthStore();
  const {
    level,
    status = 'all',
    dateFrom,
    dateTo,
    search,
    page = 1,
    limit = 20,
  } = filters;

  return useQuery<AnnouncementHistoryResponse>({
    queryKey: announcementQueryKeys.history(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (level) params.append('level', level);
      if (status) params.append('status', status);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (search) params.append('search', search);
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const res = await fetch(`/api/announcements/history?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('공지사항 이력 조회 실패');
      }

      return res.json();
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!accessToken,
  });
}

/**
 * 공지사항 상세 조회
 * GET /api/announcements/{id}
 */
export function useAnnouncement(id: string) {
  const { accessToken } = useAuthStore();

  return useQuery<AnnouncementDetailResponse>({
    queryKey: announcementQueryKeys.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/announcements/${id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('공지사항 조회 실패');
      }

      return res.json();
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!accessToken && !!id,
  });
}

/**
 * 관리자용 공지사항 목록 조회
 * GET /api/admin/announcements
 */
export function useAdminAnnouncements(
  filters: AdminAnnouncementFilters = {}
) {
  const { accessToken } = useAuthStore();
  const {
    level,
    status = 'all',
    dateFrom,
    dateTo,
    search,
    page = 1,
    limit = 20,
  } = filters;

  return useQuery<AdminAnnouncementListResponse>({
    queryKey: announcementQueryKeys.adminList(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (level) params.append('level', level);
      if (status) params.append('status', status);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (search) params.append('search', search);
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const res = await fetch(`/api/admin/announcements?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('공지사항 목록 조회 실패');
      }

      return res.json();
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!accessToken,
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * 공지사항 읽음 상태 기록
 * POST /api/announcements/{id}/view
 */
export function useViewAnnouncement() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (announcementId: string) => {
      const res = await fetch(`/api/announcements/${announcementId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error('읽음 상태 기록 실패');
      }

      return res.json();
    },
    onSuccess: (_, announcementId) => {
      // 상세 조회 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: announcementQueryKeys.detail(announcementId),
      });

      // 이력 캐시 무효화 (모든 필터 조건의 history 캐시를 무효화)
      // ['announcements', 'history', ...filters] 패턴의 모든 쿼리 대상
      queryClient.invalidateQueries({
        queryKey: ['announcements', 'history'],
      });
    },
  });
}

/**
 * 공지사항 생성
 * POST /api/admin/announcements
 */
export function useCreateAnnouncement() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAnnouncementRequest) => {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '공지사항 생성 실패');
      }

      return res.json();
    },
    onSuccess: () => {
      // 관리자 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: announcementQueryKeys.admin(),
      });
    },
  });
}

/**
 * 공지사항 수정
 * PATCH /api/admin/announcements/{id}
 */
export function useUpdateAnnouncement() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: { id: string } & UpdateAnnouncementRequest) => {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '공지사항 수정 실패');
      }

      return res.json();
    },
    onSuccess: (_, { id }) => {
      // 상세 조회 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: announcementQueryKeys.detail(id),
      });

      // 관리자 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: announcementQueryKeys.admin(),
      });
    },
  });
}

/**
 * 공지사항 삭제
 * DELETE /api/admin/announcements/{id}
 */
export function useDeleteAnnouncement() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/announcements/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '공지사항 삭제 실패');
      }

      return res.json();
    },
    onSuccess: () => {
      // 관리자 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: announcementQueryKeys.admin(),
      });

      // 활성 공지사항 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: announcementQueryKeys.active(),
      });
    },
  });
}
