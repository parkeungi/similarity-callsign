-- 항공교통본부 인증 시스템 데이터베이스 초기화
-- 이 스크립트는 Docker 컨테이너 시작 시 자동 실행됨

-- 항공사 테이블 생성
CREATE TABLE IF NOT EXISTS airlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name_ko VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 사용자 테이블 생성 (수정됨: airline_id 및 비밀번호 추적 필드 추가)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  airline_id UUID NOT NULL REFERENCES airlines(id),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),

  -- 비밀번호 정책 추적
  is_default_password BOOLEAN DEFAULT true,
  password_change_required BOOLEAN DEFAULT true,
  last_password_changed_at TIMESTAMP,

  -- 로그인 보안 (행안부 지침)
  failed_login_attempts INT NOT NULL DEFAULT 0,   -- 연속 실패 횟수 (5회 초과 시 잠금)
  locked_until TIMESTAMP NULL,                     -- 계정 잠금 해제 시각

  -- JWT RefreshToken 무효화
  refresh_token_hash VARCHAR(64) NULL,             -- SHA-256 해시 (로그아웃 시 NULL)

  -- 기타 필드
  last_login_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 비밀번호 이력 테이블 생성 (NEW)
CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  password_hash VARCHAR(255) NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  changed_by VARCHAR(50)
);

-- 자주 조회하는 항목의 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_airline_id ON users(airline_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
-- 성능 최적화: 관리자 사용자 목록 조회
CREATE INDEX IF NOT EXISTS idx_users_status_created ON users(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_airlines_code ON airlines(code);
CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);

-- Create audit log table for tracking changes
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(50),
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- 국내 항공사 12개 데이터 삽입 (display_order 포함)
INSERT INTO airlines (code, name_ko, name_en, display_order) VALUES
('KAL', '대한항공', 'KOREAN AIR', 1),
('AAR', '아시아나항공', 'ASIANA AIRLINES', 2),
('JJA', '제주항공', 'JEJUair', 3),
('JNA', '진에어', 'JIN AIR', 4),
('TWB', '티웨이항공', 't''way Air', 5),
('ABL', '에어부산', 'AIR BUSAN', 6),
('ASV', '에어서울', 'AIR SEOUL', 7),
('EOK', '이스타항공', 'EASTAR JET', 8),
('FGW', '플라이강원', 'Aero K', 9),
('APZ', '에어프레미아', 'Air Premia', 10),
('ESR', '이스타항공', 'EASTAR JET', 11),
('ARK', '에어로케이', 'Aero K Airlines', 12),
('FOREIGN', '외항사', 'Foreign Airlines', 99)
ON CONFLICT (code) DO NOTHING;

-- ================================================================
-- 기본 사용자 계정 (모든 비밀번호: 1234)
-- bcrypt hash for '1234': $2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm
-- ================================================================

-- 관리자 계정 (2명)
INSERT INTO users (email, password_hash, airline_id, status, role, is_default_password, password_change_required)
SELECT 'parkeungi21@korea.kr', '$2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm',
  airlines.id, 'active', 'admin', false, false
FROM airlines WHERE airlines.code = 'KAL'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, airline_id, status, role, is_default_password, password_change_required)
SELECT 'parkeungi21@korea.kr', '$2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm',
  airlines.id, 'active', 'admin', false, false
FROM airlines WHERE airlines.code = 'KAL'
ON CONFLICT (email) DO NOTHING;

-- 항공사 담당자 계정 (항공사별 1명, 초기 로그인 시 비밀번호 변경 필요)
INSERT INTO users (email, password_hash, airline_id, status, role, is_default_password, password_change_required)
SELECT 'kal@test.com', '$2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm',
  airlines.id, 'active', 'user', true, true
FROM airlines WHERE airlines.code = 'KAL'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, airline_id, status, role, is_default_password, password_change_required)
SELECT 'aar@test.com', '$2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm',
  airlines.id, 'active', 'user', true, true
FROM airlines WHERE airlines.code = 'AAR'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, airline_id, status, role, is_default_password, password_change_required)
SELECT 'jja@test.com', '$2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm',
  airlines.id, 'active', 'user', true, true
FROM airlines WHERE airlines.code = 'JJA'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, airline_id, status, role, is_default_password, password_change_required)
SELECT 'jna@test.com', '$2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm',
  airlines.id, 'active', 'user', true, true
FROM airlines WHERE airlines.code = 'JNA'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, airline_id, status, role, is_default_password, password_change_required)
SELECT 'twb@test.com', '$2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm',
  airlines.id, 'active', 'user', true, true
FROM airlines WHERE airlines.code = 'TWB'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, airline_id, status, role, is_default_password, password_change_required)
SELECT 'abl@test.com', '$2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm',
  airlines.id, 'active', 'user', true, true
FROM airlines WHERE airlines.code = 'ABL'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, airline_id, status, role, is_default_password, password_change_required)
SELECT 'asv@test.com', '$2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm',
  airlines.id, 'active', 'user', true, true
FROM airlines WHERE airlines.code = 'ASV'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, airline_id, status, role, is_default_password, password_change_required)
SELECT 'eok@test.com', '$2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm',
  airlines.id, 'active', 'user', true, true
FROM airlines WHERE airlines.code = 'EOK'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, airline_id, status, role, is_default_password, password_change_required)
SELECT 'fgw@test.com', '$2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm',
  airlines.id, 'active', 'user', true, true
FROM airlines WHERE airlines.code = 'FGW'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, airline_id, status, role, is_default_password, password_change_required)
SELECT 'apz@test.com', '$2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm',
  airlines.id, 'active', 'user', true, true
FROM airlines WHERE airlines.code = 'APZ'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password_hash, airline_id, status, role, is_default_password, password_change_required)
SELECT 'esr@test.com', '$2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm',
  airlines.id, 'active', 'user', true, true
FROM airlines WHERE airlines.code = 'ESR'
ON CONFLICT (email) DO NOTHING;

-- ================================================================
-- Phase 4: 항공사 데이터 및 조치 관리 시스템
-- ================================================================

-- 1. file_uploads 테이블 (엑셀 업로드 이력)
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name VARCHAR(255) NOT NULL,
  file_size INT,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- 처리 결과
  total_rows INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  error_message TEXT,

  -- 상태
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_file_uploads_uploaded_at ON file_uploads(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_uploads_status ON file_uploads(status);
CREATE INDEX IF NOT EXISTS idx_file_uploads_uploaded_by ON file_uploads(uploaded_by);

-- 2. callsigns 테이블 (유사호출부호 마스터 데이터)
CREATE TABLE IF NOT EXISTS callsigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airline_id UUID NOT NULL REFERENCES airlines(id) ON DELETE CASCADE,
  airline_code VARCHAR(10) NOT NULL,

  -- 호출부호 쌍 정보
  callsign_pair VARCHAR(50) NOT NULL,        -- "KAL852 | KAL851"
  my_callsign VARCHAR(20) NOT NULL,          -- "KAL852"
  other_callsign VARCHAR(20) NOT NULL,       -- "KAL851"
  other_airline_code VARCHAR(10),            -- "AAR", "JJA" 등

  -- 관할 섹터 및 공항 정보 (엑셀 추가 필드)
  sector VARCHAR(20),                        -- 관할섹터명 (EL, GL, JN 등)
  departure_airport1 VARCHAR(10),            -- 편명1 출발공항 (RKSI 등)
  arrival_airport1 VARCHAR(10),              -- 편명1 목적공항
  departure_airport2 VARCHAR(10),            -- 편명2 출발공항
  arrival_airport2 VARCHAR(10),              -- 편명2 목적공항

  -- 유사도 분석 정보
  same_airline_code VARCHAR(10),             -- 항공사코드동일여부 (일치/불일치)
  same_callsign_length VARCHAR(10),          -- 편명번호길이동일여부 (일치/불일치)
  same_number_position VARCHAR(20),          -- 편명번호동일숫자위치 (앞/뒤/앞뒤/전체)
  same_number_count INT,                     -- 편명번호동일숫자갯수
  same_number_ratio DECIMAL(5,2),            -- 편명번호동일숫자구성비율(%)
  similarity VARCHAR(20),                    -- 편명유사도 (매우높음/높음/낮음/정의되지않음)

  -- 관제 정보
  max_concurrent_traffic INT,                -- 최대동시관제량
  coexistence_minutes INT,                   -- 공존시간(분)
  error_probability INT,                     -- 오류발생가능성 (0-100)
  atc_recommendation VARCHAR(50),            -- 관제사권고사항 (즉시조치/주의감시/-)

  -- 오류 정보
  error_type VARCHAR(30),                    -- 오류유형 (관제사오류/조종사오류/오류미발생)
  sub_error VARCHAR(30),                     -- 세부오류유형 (복창오류/응답오류/기타 등)
  risk_level VARCHAR(20),                    -- 위험도 (매우높음/높음/낮음) - 기존 호환

  -- 발생 통계
  occurrence_count INT DEFAULT 0,            -- 발생 건수
  first_occurred_at TIMESTAMP,               -- 첫 발생 시간
  last_occurred_at TIMESTAMP,                -- 최근 발생 시간

  -- 업로드 정보
  file_upload_id UUID REFERENCES file_uploads(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP,

  -- 상태 관리
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed')),

  -- 항공사별 조치 상태 (내 항공사 / 상대 항공사)
  my_action_status VARCHAR(20) DEFAULT 'no_action'
    CHECK (my_action_status IN ('no_action', 'pending', 'in_progress', 'completed')),
  other_action_status VARCHAR(20) DEFAULT 'no_action'
    CHECK (other_action_status IN ('no_action', 'pending', 'in_progress', 'completed')),

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- 제약조건
  UNIQUE(airline_id, callsign_pair),
  UNIQUE(airline_code, callsign_pair)
);

CREATE INDEX IF NOT EXISTS idx_callsigns_airline_id ON callsigns(airline_id);
CREATE INDEX IF NOT EXISTS idx_callsigns_airline_code ON callsigns(airline_code);
CREATE INDEX IF NOT EXISTS idx_callsigns_pair ON callsigns(callsign_pair);
CREATE INDEX IF NOT EXISTS idx_callsigns_risk_level ON callsigns(risk_level);
CREATE INDEX IF NOT EXISTS idx_callsigns_status ON callsigns(status);
CREATE INDEX IF NOT EXISTS idx_callsigns_created_at ON callsigns(created_at DESC);
-- 성능 최적화 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_callsigns_risk_occurrence ON callsigns(risk_level, occurrence_count DESC, last_occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_callsigns_airline_id_code ON callsigns(airline_id, airline_code);
CREATE INDEX IF NOT EXISTS idx_callsigns_airports ON callsigns(departure_airport1, arrival_airport1);
CREATE INDEX IF NOT EXISTS idx_callsigns_uploaded_at ON callsigns(uploaded_at DESC);

-- 2-1. callsign_occurrences 테이블 (호출부호 쌍의 발생 이력)
-- 같은 호출부호 쌍이 여러 날짜에 발생한 경우를 별도로 관리
CREATE TABLE IF NOT EXISTS callsign_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  callsign_id UUID NOT NULL REFERENCES callsigns(id) ON DELETE CASCADE,

  -- 발생 날짜 및 정보
  occurred_date DATE NOT NULL,                     -- 발생 날짜
  occurred_time TIMESTAMP,                         -- 발생 시간 (선택사항)

  -- 발생 상황 정보
  error_type VARCHAR(30),                         -- "관제사 오류", "조종사 오류", "오류 미발생"
  sub_error VARCHAR(30),                          -- "복창오류", "무응답/재호출" 등
  location VARCHAR(100),                          -- 발생 위치 (공역, 공항 등)
  flight_level VARCHAR(20),                       -- 비행 고도

  -- 메타정보
  file_upload_id UUID REFERENCES file_uploads(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- 제약조건: 같은 callsign에서 같은 날짜+시간의 중복 방지
  -- (같은 날짜라도 다른 섹터/시간대의 발생은 별도 기록)
  UNIQUE(callsign_id, occurred_date, occurred_time)
);

CREATE INDEX IF NOT EXISTS idx_callsign_occurrences_callsign_id ON callsign_occurrences(callsign_id);
CREATE INDEX IF NOT EXISTS idx_callsign_occurrences_occurred_date ON callsign_occurrences(occurred_date DESC);
-- 성능 최적화: LATERAL JOIN 발생이력 조회용
CREATE INDEX IF NOT EXISTS idx_occurrences_callsign_date_time ON callsign_occurrences(callsign_id, occurred_date DESC, occurred_time DESC NULLS LAST);

-- 3. actions 테이블 (조치 이력 관리)
CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airline_id UUID NOT NULL REFERENCES airlines(id) ON DELETE CASCADE,
  callsign_id UUID NOT NULL REFERENCES callsigns(id) ON DELETE CASCADE,

  -- 조치 정보
  action_type VARCHAR(100) NOT NULL,         -- "편명 변경", "브리핑 시행", "모니터링 강화" 등
  description TEXT,                          -- 조치 상세 설명
  manager_name VARCHAR(100),                 -- 담당자명
  manager_email VARCHAR(255),                -- 담당자 이메일
  planned_due_date DATE,                     -- 조치 예정일

  -- 상태 추적
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  result_detail TEXT,                        -- 조치 결과 상세
  completed_at TIMESTAMP,                    -- 완료 날짜시간

  -- 등록자/수정자
  registered_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- 관리자 검토 (선택사항)
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_comment TEXT,

  -- 취소 여부 (취소 시 true, 물리 삭제 금지)
  is_cancelled BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_actions_airline_id ON actions(airline_id);
CREATE INDEX IF NOT EXISTS idx_actions_callsign_id ON actions(callsign_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_registered_by ON actions(registered_by);
CREATE INDEX IF NOT EXISTS idx_actions_registered_at ON actions(registered_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_completed_at ON actions(completed_at DESC);
-- 성능 최적화 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_actions_callsign_cancelled_registered ON actions(callsign_id, is_cancelled, registered_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_completed_active ON actions(status, completed_at) WHERE COALESCE(is_cancelled, false) = false;
CREATE INDEX IF NOT EXISTS idx_actions_airline_action_type ON actions(airline_id, action_type) WHERE action_type IS NOT NULL AND action_type != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_actions_airline_callsign_active ON actions(airline_id, callsign_id) WHERE COALESCE(is_cancelled, false) = false;

-- 4. action_history 테이블 (조치 수정 이력 - 감사 추적)
CREATE TABLE IF NOT EXISTS action_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),

  field_name VARCHAR(50),                    -- 변경된 필드명
  old_value TEXT,                            -- 기존값
  new_value TEXT,                            -- 새 값

  -- 제약조건
  FOREIGN KEY (action_id) REFERENCES actions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_action_history_action_id ON action_history(action_id);
CREATE INDEX IF NOT EXISTS idx_action_history_changed_at ON action_history(changed_at DESC);

-- ================================================================
-- Phase 5: 공지사항 관리 시스템
-- ================================================================

-- 1. announcements 테이블 (공지사항 마스터 데이터)
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기본 정보
  title VARCHAR(255) NOT NULL,          -- "KAL-AAL 호출부호 개선 조치"
  content TEXT NOT NULL,                -- 공지사항 본문

  -- 긴급도 레벨
  level VARCHAR(20) NOT NULL DEFAULT 'info'
    CHECK (level IN ('warning', 'info', 'success')),

  -- 기간 설정
  start_date TIMESTAMP NOT NULL,        -- 공지 시작 일시
  end_date TIMESTAMP NOT NULL,          -- 공지 종료 일시
  is_active BOOLEAN DEFAULT true,       -- 활성 여부

  -- 대상 설정 (NULL = 전체 항공사, 또는 쉼표로 구분된 airline_id)
  target_airlines TEXT,                 -- 대상 항공사 IDs (JSON 배열 형식 또는 CSV)

  -- 메타데이터
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- 제약조건
  CONSTRAINT chk_announcement_date_range CHECK (start_date < end_date)
);

CREATE INDEX IF NOT EXISTS idx_announcements_start_date ON announcements(start_date);
CREATE INDEX IF NOT EXISTS idx_announcements_end_date ON announcements(end_date);
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_level ON announcements(level);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON announcements(created_by);

-- 2. announcement_views 테이블 (사용자별 읽음 상태 추적)
CREATE TABLE IF NOT EXISTS announcement_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 읽음 상태
  viewed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  dismissed_at TIMESTAMP,               -- 팝업 닫은 시간 (선택사항)

  -- 복합 인덱스 및 제약조건
  UNIQUE(announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_views_announcement_id ON announcement_views(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_views_user_id ON announcement_views(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_views_viewed_at ON announcement_views(viewed_at DESC);
-- 성능 최적화: NOT EXISTS 조회용 역방향 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_announcement_views_user_announcement ON announcement_views(user_id, announcement_id);

-- 샘플 데이터 제거됨 - 실제 데이터는 엑셀 업로드를 통해 등록

-- ================================================================
-- Phase 6: 조치 유형 관리 시스템
-- ================================================================

CREATE TABLE IF NOT EXISTS action_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,       -- "편명 변경", "브리핑 시행" 등
  description TEXT,                        -- 조치 유형 설명
  display_order INT NOT NULL DEFAULT 0,    -- 표시 순서
  is_active BOOLEAN NOT NULL DEFAULT true, -- 활성 여부
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_types_display_order ON action_types(display_order);
CREATE INDEX IF NOT EXISTS idx_action_types_is_active ON action_types(is_active);

-- 기본 조치 유형 6개 시드 데이터
INSERT INTO action_types (name, description, display_order) VALUES
('편명 변경',    '항공편 편명을 변경하여 유사호출부호 혼동 방지',             1),
('브리핑 시행',  '조종사 및 관제사 대상 유사호출부호 관련 안전 브리핑 실시', 2),
('모니터링 강화','해당 호출부호 쌍에 대한 관제 모니터링 강도 강화',          3),
('절차 개선',    '관련 운항 및 관제 절차를 검토하고 개선',                   4),
('시스템 개선',  '항공 시스템 또는 소프트웨어 관련 개선 조치 수행',          5),
('기타',         '위 분류에 해당하지 않는 기타 조치',                        6)
ON CONFLICT (name) DO NOTHING;

-- ================================================================
-- Phase 7: AI 유사호출부호 우선순위 분석
-- ================================================================

CREATE TABLE IF NOT EXISTS callsign_ai_analysis (
  id SERIAL PRIMARY KEY,
  callsign_pair TEXT NOT NULL UNIQUE,
  ai_score INT NOT NULL CHECK (ai_score BETWEEN 1 AND 100),
  ai_reason TEXT NOT NULL,
  reason_type TEXT NOT NULL DEFAULT 'LOW_RISK',
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_by TEXT DEFAULT 'claude',
  coexistence_snapshot INT NULL,
  occurrence_snapshot INT NULL,
  atc_snapshot VARCHAR(50) NULL,
  needs_reanalysis BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_pair ON callsign_ai_analysis(callsign_pair);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_score ON callsign_ai_analysis(ai_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_reason_type ON callsign_ai_analysis(reason_type);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_reanalysis ON callsign_ai_analysis(needs_reanalysis) WHERE needs_reanalysis = TRUE;

-- ================================================================
-- Phase 8: AI 자동 분석 작업 이력
-- ================================================================

CREATE TABLE IF NOT EXISTS ai_analysis_jobs (
  id SERIAL PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  provider VARCHAR(20) NOT NULL,
  model VARCHAR(50) NOT NULL,
  total_pairs INT NOT NULL DEFAULT 0,
  processed_pairs INT NOT NULL DEFAULT 0,
  inserted_count INT DEFAULT 0,
  updated_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  error_message TEXT,
  token_input INT,
  token_output INT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);
