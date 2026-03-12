// 공지사항 타입 - Announcement(id·title·content·target_airline_ids·importance·is_active), announcements 테이블 매핑
/**
 * 공지사항 관리 시스템 타입 정의
 */

// 공지사항 마스터 데이터
export interface Announcement {
  id: string;
  title: string;
  content: string;
  level: 'warning' | 'info' | 'success';
  startDate: string;        // ISO 8601
  endDate: string;          // ISO 8601
  targetAirlines?: string | null;  // CSV 형식 또는 null
  isActive?: boolean;
  createdBy: string;
  createdAt: string;
  updatedBy?: string | null;
  updatedAt?: string;
  createdByEmail?: string;  // 관리자용
}

// 사용자별 읽음 상태
export interface AnnouncementView {
  id: string;
  announcementId: string;
  userId: string;
  viewedAt: string;
  dismissedAt?: string | null;
}

// 공지사항 생성 요청
export interface CreateAnnouncementRequest {
  title: string;
  content: string;
  level: 'warning' | 'info' | 'success';
  startDate: string;
  endDate: string;
  targetAirlines?: string[];  // 없으면 전체
}

// 공지사항 수정 요청 (부분 업데이트)
export interface UpdateAnnouncementRequest {
  title?: string;
  content?: string;
  level?: 'warning' | 'info' | 'success';
  startDate?: string;
  endDate?: string;
  targetAirlines?: string[];
  isActive?: boolean;
}

// 활성 공지사항 응답
export interface ActiveAnnouncementsResponse {
  announcements: Announcement[];
  total: number;
}

// 공지사항 이력 응답
export interface AnnouncementHistoryResponse {
  announcements: Array<Announcement & { status?: 'active' | 'expired'; isViewed?: boolean }>;
  total: number;
  page: number;
  limit: number;
}

// 공지사항 상세 응답 (읽음 여부 포함)
export interface AnnouncementDetailResponse extends Announcement {
  isViewed: boolean;
  viewedAt: string | null;
  status?: 'active' | 'expired';
  viewCount?: number;
}

// 공지사항 이력 필터
export interface AnnouncementHistoryFilters {
  level?: 'warning' | 'info' | 'success';
  status?: 'active' | 'expired' | 'all';
  dateFrom?: string;
  dateTo?: string;
  search?: string;  // 제목/내용 검색
  page?: number;
  limit?: number;
}

// 관리자 공지사항 필터
export interface AdminAnnouncementFilters {
  level?: 'warning' | 'info' | 'success';
  status?: 'active' | 'expired' | 'all';
  dateFrom?: string;
  dateTo?: string;
  search?: string;  // 제목/내용 검색
  page?: number;
  limit?: number;
}

// 관리자 공지사항 응답 (viewCount 포함)
export interface AdminAnnouncementResponse extends Announcement {
  status: 'active' | 'expired';
  viewCount: number;
}

// 관리자 공지사항 목록 응답
export interface AdminAnnouncementListResponse {
  announcements: AdminAnnouncementResponse[];
  total: number;
  page: number;
  limit: number;
}
