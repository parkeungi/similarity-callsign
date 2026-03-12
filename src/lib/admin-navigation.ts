// 관리자 사이드바 메뉴 정의 - menuItems[](label·href·icon) 배열, AdminSidebar 컴포넌트에서 사용
import type { LucideIcon } from 'lucide-react';
import { Users, Plane, Megaphone, LockKeyhole, Settings, Database } from 'lucide-react';
import { ROUTES } from '@/lib/constants';

export const ADMIN_LINKS = {
  DASHBOARD: ROUTES.ADMIN,
  USERS_TAB: ROUTES.ADMIN_USERS,
  AIRLINES_TAB: ROUTES.ADMIN_AIRLINES,
  PASSWORD_TAB: ROUTES.ADMIN_PASSWORD_RESET,
  ANNOUNCEMENTS: ROUTES.ADMIN_ANNOUNCEMENTS,
  ACTIONS: ROUTES.ADMIN_ACTIONS,
  CALLSIGN_MANAGEMENT: ROUTES.ADMIN_CALLSIGN_MANAGEMENT,
  FILE_UPLOADS: ROUTES.ADMIN_FILE_UPLOADS,
  SETTINGS_ACTION_TYPES: ROUTES.ADMIN_SETTINGS_ACTION_TYPES,
  DATABASE: ROUTES.ADMIN_DATABASE,
} as const;

type SidebarColor = 'info' | 'purple' | 'orange' | 'danger' | 'navy' | 'success';

export interface AdminSidebarItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  color: SidebarColor;
  group?: 'main' | 'settings' | 'database';
}

export const ADMIN_SIDEBAR_ITEMS: AdminSidebarItem[] = [
  {
    id: 'users',
    label: '사용자 관리',
    href: ADMIN_LINKS.USERS_TAB,
    icon: Users,
    color: 'info',
    group: 'main',
  },
  {
    id: 'airlines',
    label: '항공사 관리',
    href: ADMIN_LINKS.AIRLINES_TAB,
    icon: Plane,
    color: 'purple',
    group: 'main',
  },
  {
    id: 'announcements',
    label: '공지사항 관리',
    href: ADMIN_LINKS.ANNOUNCEMENTS,
    icon: Megaphone,
    color: 'orange',
    group: 'main',
  },
  {
    id: 'password',
    label: '비밀번호 초기화',
    href: ADMIN_LINKS.PASSWORD_TAB,
    icon: LockKeyhole,
    color: 'danger',
    group: 'main',
  },
  {
    id: 'settings-action-types',
    label: '조치유형 관리',
    href: ADMIN_LINKS.SETTINGS_ACTION_TYPES,
    icon: Settings,
    color: 'navy',
    group: 'settings',
  },
  {
    id: 'database',
    label: '데이터베이스 관리',
    href: ADMIN_LINKS.DATABASE,
    icon: Database,
    color: 'success',
    group: 'database',
  },
];

export interface AdminDashboardCard {
  id: string;
  title: string;
  description: string;
  emoji: string;
  href: string;
}

export const ADMIN_DASHBOARD_CARDS: AdminDashboardCard[] = [
  {
    id: 'callsign-management',
    title: '유사호출부호 관리',
    description: '호출부호 쌍 등록 및 수정, 엑셀 업로드',
    emoji: '📞',
    href: ADMIN_LINKS.CALLSIGN_MANAGEMENT,
  },
  {
    id: 'users',
    title: '사용자 관리',
    description: '사용자 계정 승인, 비밀번호 재설정',
    emoji: '👥',
    href: ADMIN_LINKS.USERS_TAB,
  },
  {
    id: 'airlines',
    title: '항공사 관리',
    description: '항공사 정보 추가, 수정, 삭제',
    emoji: '✈️',
    href: ADMIN_LINKS.AIRLINES_TAB,
  },
  {
    id: 'actions',
    title: '조치 관리',
    description: '조치 이력 추적 및 상태 관리',
    emoji: '✅',
    href: ADMIN_LINKS.ACTIONS,
  },
  {
    id: 'announcements',
    title: '공지사항 관리',
    description: '공지사항 등록 및 배포',
    emoji: '📢',
    href: ADMIN_LINKS.ANNOUNCEMENTS,
  },
  {
    id: 'file-uploads',
    title: '파일 업로드',
    description: 'Excel 파일 업로드 이력 조회',
    emoji: '📁',
    href: ADMIN_LINKS.FILE_UPLOADS,
  },
];
