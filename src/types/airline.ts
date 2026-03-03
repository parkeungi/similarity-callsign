/**
 * 항공사 페이지 전용 타입 정의
 */

// 탭 타입
export type AirlineTabType = 'incidents' | 'actions' | 'statistics' | 'announcements' | 'occurrence' | 'action-history';

// 오류 유형
export type ErrorType = '관제사 오류' | '조종사 오류' | '오류 미발생';

// 세부 오류 유형
export type SubErrorType = '복창오류' | '무응답/재호출' | '고도이탈' | '비행경로이탈' | '기타';

// 위험도 레벨
export type RiskLevel = '매우높음' | '높음' | '낮음';

// 유사성 레벨
export type SimilarityLevel = '매우높음' | '높음' | '낮음';

// 조치 상태
export type ActionStatus = 'pending' | 'in_progress' | 'completed';

// 날짜 범위 타입
export type DateRangeType = 'custom' | 'today' | '1w' | '2w' | '1m';

/**
 * 발생현황 (Incident) 인터페이스
 * callsigns 데이터를 화면 표시용으로 변환한 형태
 */
export interface Incident {
  id: string;
  pair: string;           // callsign_pair
  mine: string;           // my_callsign
  other: string;          // other_callsign
  airline: string;        // airline_code
  errorType: ErrorType | string;
  subError: string;
  risk: RiskLevel | string;
  similarity: SimilarityLevel | string;
  count: number;          // occurrence_count
  firstDate: string | null;
  lastDate: string | null;
  dates: string[];        // 발생 이력 날짜 배열
  // 조치 상태
  actionId?: string | null;  // 실제 Action 레코드 ID (기존 조치 조회용)
  actionStatus?: 'no_action' | 'pending' | 'in_progress' | 'completed';
  actionType?: string | null;
  actionCompletedAt?: string | null;
}

/**
 * 호출부호 상세 정보 (모달용)
 */
export interface CallsignDetailMeta {
  occurrenceCount: number;
  firstOccurredAt: string | null;
  lastOccurredAt: string | null;
  similarity: string;
  riskLevel: string;
  myCallsign: string;
  otherCallsign: string;
  errorType: string;
  subError: string;
}

/**
 * 오류 유형별 통계
 */
export interface ErrorTypeStat {
  type: string;
  count: number;
  percentage: number;
  label: string;
  bgColor: string;
  textColor: string;
  description: string;
}

/**
 * 세부 오류 통계
 */
export interface SubTypeStat {
  key: string;
  label: string;
  count: number;
  color: string;
}

/**
 * 오류 유형 설정
 */
export interface ErrorTypeConfig {
  label: string;
  bgColor: string;
  textColor: string;
  description: string;
}

/**
 * 공지사항 요약 카드
 */
export interface AnnouncementSummaryCard {
  id: string;
  icon: string;
  title: string;
  value: number;
  description: string;
  loading: boolean;
}

/**
 * 공지레벨 메타 정보
 */
export interface AnnouncementLevelMeta {
  label: string;
  badge: string;
}

/**
 * 공지상태 메타 정보
 */
export interface AnnouncementStatusMeta {
  label: string;
  badge: string;
}

/**
 * 항공사 코드 매핑
 */
export interface AirlineCodeMap {
  [code: string]: { n: string };
}

/**
 * 쿠키에서 파싱한 사용자 정보
 */
export interface CookieUser {
  airline?: {
    id?: string;
    code?: string;
    name_ko?: string;
  };
}

/**
 * 날짜 범위 필터 상태
 */
export interface DateRangeFilterState {
  startDate: string;
  endDate: string;
  activeRange: DateRangeType;
}

/**
 * 조치이력 탭 필터 상태
 */
export interface ActionFilterState {
  page: number;
  limit: number;
  search: string;
  searchInput: string;
  statusFilter: 'all' | ActionStatus;
}

/**
 * 위험도별 색상 매핑
 */
export const RISK_COLOR_MAP: Record<RiskLevel, string> = {
  '매우높음': '#dc2626',
  '높음': '#f59e0b',
  '낮음': '#16a34a',
};

/**
 * 위험도 정렬용 숫자 매핑
 */
export const RISK_LEVEL_ORDER: Record<RiskLevel, number> = {
  '매우높음': 3,
  '높음': 2,
  '낮음': 1,
};

/**
 * 오류 유형별 설정 상수
 */
export const ERROR_TYPE_CONFIG: Record<ErrorType, ErrorTypeConfig> = {
  '관제사 오류': {
    label: 'ATC RELATED',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-600',
    description: '관제사 요인으로 판명된 사례',
  },
  '조종사 오류': {
    label: 'PILOT RELATED',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-600',
    description: '조종사 요인으로 판명된 사례',
  },
  '오류 미발생': {
    label: 'NO ERROR',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    description: '오류 없이 경고만 발생한 사례',
  },
};

/**
 * 항공사 코드 매핑 상수
 */
export const AIRLINE_CODE_MAP: AirlineCodeMap = {
  KAL: { n: '대한항공' },
  AAR: { n: '아시아나항공' },
  JJA: { n: '제주항공' },
  JNA: { n: '진에어' },
  TWB: { n: '티웨이항공' },
  ABL: { n: '에어부산' },
  ASV: { n: '에어서울' },
  ESR: { n: '이스타항공' },
  FGW: { n: '플라이강원' },
  ARK: { n: '에어로케이항공' },
  APZ: { n: '에어프레미아' },
};

/**
 * 공지사항 레벨 메타 정보
 */
export const ANNOUNCEMENT_LEVEL_META: Record<'warning' | 'info' | 'success', AnnouncementLevelMeta> = {
  warning: { label: '긴급', badge: 'bg-red-100 text-red-700' },
  info: { label: '일반', badge: 'bg-blue-100 text-blue-600' },
  success: { label: '완료', badge: 'bg-emerald-100 text-emerald-700' },
};

/**
 * 공지사항 상태 메타 정보
 */
export const ANNOUNCEMENT_STATUS_META: Record<'active' | 'expired', AnnouncementStatusMeta> = {
  active: { label: '진행중', badge: 'bg-emerald-50 text-emerald-600' },
  expired: { label: '종료', badge: 'bg-gray-100 text-gray-500' },
};
