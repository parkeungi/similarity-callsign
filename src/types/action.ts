// 핵심 타입 정의 - Action(조치)·Callsign(호출부호, AI분석 필드 포함)·FileUpload·CreateActionRequest·UpdateActionRequest·ActionListResponse·CallsignListResponse 등
import { Airline } from './airline';
import { User } from './user';

/**
 * 파일 업로드 인터페이스 (file_uploads 테이블)
 * 엑셀 파일 업로드 이력 및 처리 결과 추적
 */
export interface FileUpload {
  id: string;
  file_name: string;
  file_size?: number;
  uploaded_by: string;
  uploaded_at: string;

  // 처리 결과
  total_rows: number;
  success_count: number;
  failed_count: number;
  error_message?: string;

  // 상태
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processed_at?: string;

  // API 응답용 camelCase 필드
  fileName?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  totalRows?: number;
  successCount?: number;
  failedCount?: number;
  errorMessage?: string;
  processedAt?: string;
}

/**
 * 유사호출부호 인터페이스 (callsigns 테이블)
 * 항공사별 유사호출부호 마스터 데이터 및 위험도 정보
 */
export interface Callsign {
  id: string;
  airline_id: string;
  airline_code: string;

  // 글로벌 쌍 키 (신규: 알파벳 순 정렬)
  callsign_a?: string;        // LEAST(편명1, 편명2)
  callsign_b?: string;        // GREATEST(편명1, 편명2)
  airline_a_code?: string;
  airline_b_code?: string;
  action_status_a?: 'no_action' | 'pending' | 'in_progress' | 'completed';
  action_status_b?: 'no_action' | 'pending' | 'in_progress' | 'completed';
  error_probability_score?: number | null;

  // 호출부호 쌍 정보 (하위 호환 - optional로 유지)
  callsign_pair: string; // "KAL852 | KAL851"
  my_callsign: string; // "KAL852"
  other_callsign: string; // "KAL851"
  other_airline_code?: string; // "AAR", "JJA" 등

  // 위험도 정보
  error_type?: string; // "관제사 오류", "조종사 오류", "오류 미발생"
  sub_error?: string; // "복창오류", "무응답/재호출" 등
  risk_level?: string; // "매우높음", "높음", "낮음"
  similarity?: string; // "매우높음", "높음", "낮음"

  // 추가 분석 정보
  sector?: string; // "EL", "GL", "JN" 등 관할섹터
  atc_recommendation?: string; // "즉시조치", "주의감시", "-" 등

  // 발생 통계
  occurrence_count: number;
  first_occurred_at?: string; // 첫 발생 시간
  last_occurred_at?: string; // 최근 발생 시간

  // 업로드 정보
  file_upload_id?: string;
  uploaded_at?: string;

  // 공항 정보
  departure_airport1?: string | null;
  arrival_airport1?: string | null;
  departureAirport?: string | null;
  arrivalAirport?: string | null;

  created_at: string;
  updated_at: string;

  // 조치 상태 정보 (단일 항공사 - 사용자 API 호환성)
  action_id?: string | null;
  action_status?: 'no_action' | 'pending' | 'in_progress' | 'completed';
  action_type?: string | null;
  action_completed_at?: string | null;
  action_description?: string | null; // 조치 설명/내용

  // 발생이력 및 오류유형 집계 (관리자 API용)
  occurrence_dates?: string; // "2026-02-28 11:37,2026-02-27 08:22,..." 형태
  occurrences?: any[];
  errorTypeSummary?: any[];
  error_type_counts?: Record<string, number>; // 오류유형별 건수 (동적)

  // 양쪽 항공사 조치 상태 정보 (관리자 API)
  my_airline_id?: string;
  my_airline_code?: string; // 자사 항공사 코드 (airline_code와 동일, 명시성을 위해 추가)
  my_action_status?: 'no_action' | 'pending' | 'in_progress' | 'completed';
  my_action_type?: string | null;
  my_action_description?: string | null;
  my_manager_name?: string | null;
  other_action_status?: 'no_action' | 'pending' | 'in_progress' | 'completed';
  other_action_type?: string | null;
  other_action_type_detail?: string | null;
  other_action_description?: string | null;
  other_manager_name?: string | null;
  other_completed_at?: string | null;
  // 최종 조치 상태
  // - 상대 항공사가 국외: 자사만 조치하면 완료
  // - 상대 항공사가 국내: 양쪽 모두 조치해야 완료
  final_status?: 'complete' | 'partial' | 'in_progress';

  // 최근 조치 정보 (하위호환성)
  latest_action_id?: string;
  latest_action_status?: 'pending' | 'in_progress' | 'completed';
  latest_action_manager?: string | null;
  latest_action_responsible_staff?: string | null;
  latest_action_updated_at?: string | null;

  // API 응답용 camelCase 필드
  airlineId?: string;
  airlineCode?: string;
  callsignPair?: string;
  myCallsign?: string;
  otherCallsign?: string;
  otherAirlineCode?: string;
  errorType?: string;
  subError?: string;
  riskLevel?: string;
  occurrenceCount?: number;
  firstOccurredAt?: string; // 첫 발생 시간
  lastOccurredAt?: string; // 최근 발생 시간
  fileUploadId?: string;
  uploadedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  actionId?: string | null;
  actionStatus?: 'no_action' | 'pending' | 'in_progress' | 'completed';
  actionType?: string | null;
  actionCompletedAt?: string | null;
  actionDescription?: string | null; // camelCase 버전
  // 양쪽 항공사 조치 상태 (camelCase 버전)
  myAirlineId?: string;
  myActionStatus?: 'no_action' | 'pending' | 'in_progress' | 'completed';
  myActionType?: string | null;
  otherActionStatus?: 'no_action' | 'pending' | 'in_progress' | 'completed';
  otherActionType?: string | null;
  bothCompleted?: boolean;
  latestActionId?: string;
  latestActionStatus?: 'pending' | 'in_progress' | 'completed';
  latestActionManager?: string | null;
  latestActionResponsibleStaff?: string | null;
  latestActionUpdatedAt?: string | null;
  atcRecommendation?: string;
  occurrenceDates?: string; // camelCase 버전
  atcCount?: number; // camelCase 버전
  pilotCount?: number; // camelCase 버전
  unknownCount?: number; // camelCase 버전

  // AI 분석 데이터
  ai_score?: number | null;
  ai_reason?: string | null;
  reason_type?: string | null;
  aiScore?: number | null;
  aiReason?: string | null;
  reasonType?: string | null;
}

/**
 * 조치 인터페이스 (actions 테이블)
 * 항공사별 조치 이력 관리 및 상태 추적
 */
export interface Action {
  id: string;
  airline_id: string;
  callsign_id: string;
  callsign_pair?: string; // API 응답 시 최상위 포함

  // 조치 정보
  action_type: string; // "편명 변경", "브리핑 시행", "모니터링 강화" 등
  description?: string;
  manager_name?: string; // 관리자 담당자
  manager_email?: string;
  responsible_staff?: string; // 항공사 담당자명
  planned_due_date?: string;

  // 상태 추적
  status: 'pending' | 'in_progress' | 'completed';
  result_detail?: string;
  completed_at?: string;

  // 등록자/수정자
  registered_by: string;
  registered_at: string;
  updated_at: string;

  // 관리자 검토 (선택사항)
  reviewed_by?: string;
  reviewed_at?: string;
  review_comment?: string;
  is_virtual?: boolean;

  // API 응답 시 포함 정보
  // ✅ CRITICAL FIX: any 제거 → 명시적 타입
  airline?: Airline; // Airline 객체
  callsign?: Callsign; // Callsign 객체
  registeredUser?: User; // User 객체

  // 발생이력 (callsign_occurrences 조인)
  occurrence_dates?: string; // "2026-02-28T11:37:00,2026-02-27T08:22:00,..." 형태
  error_type_counts?: Record<string, number>; // 오류유형별 건수 (동적)

  // API 응답용 camelCase 필드
  airlineId?: string;
  callsignId?: string;
  actionType?: string;
  managerName?: string;
  managerEmail?: string;
  responsibleStaff?: string; // 항공사 담당자명 (camelCase)
  plannedDueDate?: string;
  resultDetail?: string;
  completedAt?: string;
  registeredBy?: string;
  registeredAt?: string;
  updatedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  isVirtual?: boolean;
  occurrenceDates?: string; // camelCase 버전
  atcCount?: number; // camelCase 버전
  pilotCount?: number; // camelCase 버전
  unknownCount?: number; // camelCase 버전
}

/**
 * 조치 수정 이력 인터페이스 (action_history 테이블)
 * 감사 추적 용도로 조치 변경 이력 기록
 */
export interface ActionHistory {
  id: string;
  action_id: string;
  changed_by?: string;
  changed_at: string;

  field_name?: string;
  old_value?: string;
  new_value?: string;

  // API 응답용 camelCase 필드
  actionId?: string;
  changedBy?: string;
  changedAt?: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
}

/**
 * 조치 등록/수정 요청 타입
 */
export interface CreateActionRequest {
  callsign_id: string;
  action_type: string;
  description?: string;
  manager_name?: string;
  manager_email?: string;
  responsible_staff?: string; // 항공사 담당자명
  planned_due_date?: string;
  completed_at?: string; // 처리일자
  status?: 'pending' | 'in_progress' | 'completed'; // 초기 상태 (기본값: pending)
}

export interface UpdateActionRequest {
  status?: 'pending' | 'in_progress' | 'completed';
  description?: string;
  action_type?: string;
  manager_name?: string;
  manager_email?: string;
  responsible_staff?: string; // 항공사 담당자명
  planned_due_date?: string;
  result_detail?: string;
  completed_at?: string;
  review_comment?: string;
}

/**
 * 조치 목록 조회 응답 타입
 */
export interface ActionListResponse {
  data: Action[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary?: {
    pending: number;
    in_progress: number;
    completed: number;
  };
}

export interface ActionStatisticsResponse {
  total: number;
  completionRate: number;
  averageCompletionDays: number;
  statusCounts: {
    waiting: number;
    in_progress: number;
    completed: number;
  };
  typeDistribution: Array<{ name: string; count: number; percentage: number }>;
  monthlyTrend: Array<{ month: string; count: number }>;
  filters?: {
    dateFrom: string;
    dateTo: string;
  };
}

/**
 * 호출부호 목록 조회 응답 타입
 */
export interface CallsignListResponse {
  data: Callsign[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary?: {
    total: number;
    completed: number; // 조치 완료
    partial: number; // 부분 완료
    in_progress: number; // 진행중
  };
}

/**
 * 파일 업로드 응답 타입
 */
export interface UploadResponse {
  fileUpload: FileUpload;
  callsignsCreated: number;
  errors?: Array<{ row: number; reason: string }>;
}

/**
 * 조치 요약 통계 (대시보드용)
 */
export interface ActionStats {
  airline_id: string;
  total_actions: number;
  pending_count: number;
  in_progress_count: number;
  completed_count: number;
  completion_rate: number; // 0-100 (%)
}

/**
 * 호출부호별 조치 정보 (상세 조회용)
 */
export interface CallsignActionDetail {
  callsign: Callsign;
  actions: Action[];
  actionStats: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
  };
}
