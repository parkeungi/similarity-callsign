// 항공사/UI 타입 - Airline·Incident(화면표시용 Callsign 변환)·RiskLevel·ErrorType·SortOrder·REASON_TYPE_CONFIG(AI 7종)·getAiScoreColor(점수→색상) 등
/**
 * 항공사 페이지 전용 타입 정의
 */

// 탭 타입
export type AirlineTabType = 'statistics' | 'announcements' | 'occurrence' | 'action-history';

// 오류 유형
export type ErrorType = '관제사 오류' | '조종사 오류' | '오류 미발생';

// 세부 오류 유형
export type SubErrorType = '복창오류' | '무응답/재호출' | '고도이탈' | '비행경로이탈' | '기타';

// 위험도 레벨
export type RiskLevel = '매우높음' | '높음';

// 유사성 레벨
export type SimilarityLevel = '매우높음' | '높음';

// 조치 상태
export type ActionStatus = 'pending' | 'in_progress' | 'completed';

// 날짜 범위 타입
export type DateRangeType = 'custom' | 'today' | '1w' | '2w' | '1m';

/**
 * 발생 이력 상세 정보
 */
export interface OccurrenceDetail {
  occurredDate: string;      // 발생 날짜
  occurredTime: string | null; // 발생 시간 (HH:MM, 24시간제)
  errorType: string;         // 오류 유형
  subError: string;          // 세부 오류
}

/**
 * 오류 유형별 집계
 */
export interface ErrorTypeSummary {
  errorType: string;         // 오류 유형
  count: number;             // 발생 건수
}

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
  departureAirport?: string | null;
  arrivalAirport?: string | null;
  // 발생 이력 상세 정보 (callsign_occurrences에서 가져옴)
  occurrences?: OccurrenceDetail[];      // 발생 이력 상세 (날짜+시간+오류유형)
  errorTypeSummary?: ErrorTypeSummary[]; // 오류 유형별 집계
  // 조치 상태
  actionId?: string | null;  // 실제 Action 레코드 ID (기존 조치 조회용)
  actionStatus?: 'no_action' | 'pending' | 'in_progress' | 'completed';
  actionType?: string | null;
  actionCompletedAt?: string | null;
  // AI 분석 데이터
  aiScore?: number | null;
  aiReason?: string | null;
  reasonType?: string | null;
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
 * 페이지네이션 상태 (발생현황 탭용)
 */
export interface PaginationState {
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

/**
 * 검색 상태 (발생현황 탭용)
 */
export interface SearchState {
  input: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

/**
 * 필터 상태 (발생현황 탭용)
 */
export interface FiltersState {
  errorType: 'all' | ErrorType;
  onChange: (filter: 'all' | ErrorType) => void;
}

/**
 * 내보내기 설정 (발생현황 탭용)
 */
export interface ExportConfig {
  isLoading: boolean;
  onExport: () => void;
}

/**
 * 위험도별 색상 매핑
 */
export const RISK_COLOR_MAP: Record<RiskLevel, string> = {
  '매우높음': '#dc2626',
  '높음': '#f59e0b',
};

/**
 * 위험도 정렬용 숫자 매핑
 */
export const RISK_LEVEL_ORDER: Record<RiskLevel, number> = {
  '매우높음': 3,
  '높음': 2,
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
 * AI 분석 reason_type 한글 라벨 및 색상
 */
export const REASON_TYPE_CONFIG: Record<string, { label: string; bgColor: string; textColor: string }> = {
  SAME_NUMBER: { label: '편명번호 동일', bgColor: 'bg-red-50', textColor: 'text-red-700' },
  CONTAINMENT: { label: '편명 포함관계', bgColor: 'bg-orange-50', textColor: 'text-orange-700' },
  TRANSPOSITION: { label: '숫자 전치', bgColor: 'bg-amber-50', textColor: 'text-amber-700' },
  SIMILAR_CODE: { label: '항공사코드 유사', bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
  DIGIT_OVERLAP: { label: '숫자 겹침', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  PHONETIC_DIGIT: { label: '발음 혼동', bgColor: 'bg-indigo-50', textColor: 'text-indigo-700' },
  LOW_RISK: { label: '낮은 위험', bgColor: 'bg-gray-50', textColor: 'text-gray-600' },
};

/**
 * AI 점수 등급별 색상
 */
export function getAiScoreColor(score: number): { bg: string; text: string; label: string } {
  if (score >= 80) return { bg: 'bg-red-100', text: 'text-red-700', label: '긴급' };
  if (score >= 60) return { bg: 'bg-orange-100', text: 'text-orange-700', label: '주의' };
  if (score >= 40) return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '관찰' };
  return { bg: 'bg-green-100', text: 'text-green-700', label: '낮음' };
}

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
