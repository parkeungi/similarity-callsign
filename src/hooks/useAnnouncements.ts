/**
 * 공지사항 관리 시스템 - React Query Hooks
 * TanStack Query v5 기반
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { supabaseClient } from '@/lib/supabase/client';
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
  const { user } = useAuthStore();

  return useQuery<ActiveAnnouncementsResponse>({
    queryKey: announcementQueryKeys.active(),
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabaseClient
        .from('announcements')
        .select('id, title, content, level, start_date, end_date, target_airlines, is_active, created_by, created_at, updated_at')
        .eq('is_active', true)
        .lte('start_date', nowIso)
        .gte('end_date', nowIso)
        .order('start_date', { ascending: false });

      if (error) {
        console.error('[useActiveAnnouncements] Supabase error', error);
        throw new Error('활성 공지사항 조회 실패');
      }

      const airlineCode = user?.airline?.code ?? null;
      const filtered = (data ?? []).filter((row) => {
        if (!row.target_airlines) return true;
        if (!airlineCode) return false;
        return row.target_airlines.split(',').map((code: string) => code.trim()).includes(airlineCode);
      });

      const announcements = filtered.map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        level: row.level,
        startDate: row.start_date,
        endDate: row.end_date,
        targetAirlines: row.target_airlines,
        isActive: row.is_active,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return {
        announcements,
        total: announcements.length,
      };
    },
    staleTime: 2 * 60 * 1000,  // 2분
    gcTime: 10 * 60 * 1000,    // 10분
    enabled: !!user && (options?.enabled ?? true),
  });
}

/**
 * 공지사항 이력 조회
 * GET /api/announcements/history
 */
export function useAnnouncementHistory(
  filters: AnnouncementHistoryFilters = {}
) {
  const { user } = useAuthStore();
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
      if (!user) {
        throw new Error('인증 정보가 없습니다.');
      }

      let announcementsQuery = supabaseClient
        .from('announcements')
        .select(
          'id, title, content, level, start_date, end_date, target_airlines, is_active, created_by, created_at, updated_at'
        )
        .order('start_date', { ascending: false });

      if (level) {
        announcementsQuery = announcementsQuery.eq('level', level);
      }

      if (dateFrom) {
        announcementsQuery = announcementsQuery.gte('start_date', dateFrom);
      }

      if (dateTo) {
        announcementsQuery = announcementsQuery.lte('start_date', dateTo);
      }

      if (search) {
        announcementsQuery = announcementsQuery.or(
          `title.ilike.%${search}%,content.ilike.%${search}%`
        );
      }

      const [announcementRes, viewsRes] = await Promise.all([
        announcementsQuery,
        supabaseClient
          .from('announcement_views')
          .select('announcement_id, viewed_at')
          .eq('user_id', user.id),
      ]);

      if (announcementRes.error) {
        console.error('[useAnnouncementHistory] announcements error', announcementRes.error);
        throw new Error('공지사항 이력 조회 실패');
      }

      if (viewsRes.error) {
        console.error('[useAnnouncementHistory] views error', viewsRes.error);
        throw new Error('공지사항 이력 조회 실패');
      }

      const viewMap = new Map(
        (viewsRes.data ?? []).map((view) => [view.announcement_id, view.viewed_at])
      );

      const now = new Date();
      const enriched = (announcementRes.data ?? []).map((row) => {
        const start = new Date(row.start_date);
        const end = new Date(row.end_date);
        const rowStatus: 'active' | 'expired' =
          row.is_active && start <= now && end >= now ? 'active' : 'expired';
        const viewedAt = viewMap.get(row.id) ?? null;

        return {
          id: row.id,
          title: row.title,
          content: row.content,
          level: row.level,
          startDate: row.start_date,
          endDate: row.end_date,
          targetAirlines: row.target_airlines,
          isActive: row.is_active,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          status: rowStatus,
          isViewed: !!viewedAt,
          viewedAt,
        };
      });

      const filteredByStatus =
        status === 'all'
          ? enriched
          : enriched.filter((item) => item.status === status);

      const startIndex = (page - 1) * limit;
      const paginated = filteredByStatus.slice(startIndex, startIndex + limit);

      return {
        announcements: paginated,
        total: filteredByStatus.length,
        page,
        limit,
      };
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!user,
  });
}

/**
 * 공지사항 상세 조회
 * GET /api/announcements/{id}
 */
export function useAnnouncement(id: string) {
  const { user } = useAuthStore();

  return useQuery<AnnouncementDetailResponse>({
    queryKey: announcementQueryKeys.detail(id),
    queryFn: async () => {
      if (!user) {
        throw new Error('인증 정보가 없습니다.');
      }

      const [announcementRes, viewRes] = await Promise.all([
        supabaseClient
          .from('announcements')
          .select(
            'id, title, content, level, start_date, end_date, target_airlines, is_active, created_by, created_at, updated_at'
          )
          .eq('id', id)
          .maybeSingle(),
        supabaseClient
          .from('announcement_views')
          .select('announcement_id, viewed_at')
          .eq('announcement_id', id)
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (announcementRes.error || !announcementRes.data) {
        console.error('[useAnnouncement] announcements error', announcementRes.error);
        throw new Error('공지사항 조회 실패');
      }

      if (viewRes.error && viewRes.error.code !== 'PGRST116') {
        console.error('[useAnnouncement] views error', viewRes.error);
        throw new Error('공지사항 조회 실패');
      }

      const row = announcementRes.data;
      const now = new Date();
      const start = new Date(row.start_date);
      const end = new Date(row.end_date);
      const status: 'active' | 'expired' =
        row.is_active && start <= now && end >= now ? 'active' : 'expired';
      const viewedAt = viewRes.data?.viewed_at ?? null;

      return {
        id: row.id,
        title: row.title,
        content: row.content,
        level: row.level,
        startDate: row.start_date,
        endDate: row.end_date,
        targetAirlines: row.target_airlines,
        isActive: row.is_active,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        status,
        isViewed: !!viewedAt,
        viewedAt,
      };
    },
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!user && !!id,
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
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (announcementId: string) => {
      if (!user) {
        throw new Error('인증 정보가 없습니다.');
      }

      const payload = {
        announcement_id: announcementId,
        user_id: user.id,
        viewed_at: new Date().toISOString(),
      };

      const { error } = await supabaseClient
        .from('announcement_views')
        .upsert(payload, { onConflict: 'announcement_id,user_id' });

      if (error) {
        console.error('[useViewAnnouncement] Supabase error', error);
        throw new Error('읽음 상태 기록 실패');
      }

      return payload;
    },
    onSuccess: (_, announcementId) => {
      queryClient.invalidateQueries({ queryKey: announcementQueryKeys.detail(announcementId) });
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === 'announcements' &&
          query.queryKey[1] === 'history',
      });
      queryClient.invalidateQueries({ queryKey: announcementQueryKeys.active() });
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
