// 전역 상수 - PASSWORD_REGEX·AUTH_ERRORS·ROUTES·AIRLINES(국내항공사 11개 Set)·MAX_LIMIT·STATUS_LABELS 등 프로젝트 공용 상수
/**
 * 환경 변수
 */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || '유사호출부호 공유시스템';

/**
 * 비밀번호 규칙 (완화됨)
 * - 최소 4자
 * - 문자, 숫자 등 제한 없음
 */
export const PASSWORD_REGEX = /^.{4,}$/;
export const PASSWORD_RULE = '4자 이상 입력';

/**
 * 에러 메시지 (열거 공격 방어: 이메일/비밀번호 구분 없이 동일 메시지)
 */
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다.',
  USER_NOT_FOUND: '이메일 또는 비밀번호가 올바르지 않습니다.',
  INVALID_EMAIL: '유효한 이메일을 입력해주세요.',
  WEAK_PASSWORD: PASSWORD_RULE,
  PENDING_APPROVAL: '관리자의 승인을 기다리는 중입니다.',
  SUSPENDED_ACCOUNT: '정지된 계정입니다.',
  NETWORK_ERROR: '네트워크 오류가 발생했습니다.',
  UNKNOWN_ERROR: '오류가 발생했습니다.',
};

/**
 * 쿠키 설정
 */
export const COOKIE_OPTIONS = {
  REFRESH_TOKEN_NAME: 'refreshToken',
  REFRESH_TOKEN_MAX_AGE: 7 * 24 * 60 * 60, // 7일 (초 단위)
  PATH: '/',
  HTTP_ONLY: true,
  SECURE: process.env.NODE_ENV === 'production',
  SAME_SITE: 'strict' as const,
};

/**
 * 폴링 설정
 */
export const POLLING = {
  PENDING_INTERVAL: 30000, // 30초
  PENDING_MAX_ATTEMPTS: 120, // 최대 60분
};

/**
 * 라우트 설정
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/',
  FORGOT_PASSWORD: '/forgot-password',
  CHANGE_PASSWORD: '/change-password',
  AIRLINE: '/airline',
  ANNOUNCEMENTS: '/airline/announcements',
  ADMIN: '/callsign-management?tab=occurrences',
  ADMIN_USERS: '/admin/users',
  ADMIN_PASSWORD_RESET: '/admin/password-reset',
  ADMIN_AIRLINES: '/admin/airlines',
  ADMIN_ACTIONS: '/admin/actions',
  ADMIN_FILE_UPLOADS: '/admin/file-uploads',
  ADMIN_ANNOUNCEMENTS: '/admin/announcements',
  ADMIN_CALLSIGN_MANAGEMENT: '/admin/callsign-management',
  ADMIN_SETTINGS: '/admin/settings/action-types',
  ADMIN_SETTINGS_ACTION_TYPES: '/admin/settings/action-types',
  ADMIN_DATABASE: '/admin/database',
  CALLSIGN_MANAGEMENT: '/callsign-management',
};

/**
 * 사용자 상태 (변경됨: pending 제거 → 사전등록만 지원)
 */
export const USER_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
} as const;


/**
 * 사용자 역할
 */
export const USER_ROLE = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

/**
 * 공지사항 긴급도 레벨
 */
export const ANNOUNCEMENT_LEVEL = {
  WARNING: 'warning',    // 🚨 경고 (빨강)
  INFO: 'info',          // 📢 일반 (파랑)
  SUCCESS: 'success',    // ✅ 완료 (초록)
} as const;

/**
 * 공지사항 상태
 */
export const ANNOUNCEMENT_STATUS = {
  ACTIVE: 'active',      // 현재 표시 중
  EXPIRED: 'expired',    // 종료됨
} as const;

/**
 * 공지사항 긴급도 색상 맵
 */
export const ANNOUNCEMENT_LEVEL_COLORS = {
  warning: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-900',
    badge: 'bg-red-100 text-red-800',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-900',
    badge: 'bg-blue-100 text-blue-800',
  },
  success: {
    bg: 'bg-green-50',
    border: 'border-green-300',
    text: 'text-green-900',
    badge: 'bg-green-100 text-green-800',
  },
} as const;
