# 계획: PostgreSQL 초기화 스크립트 (scripts/postgresql-init.sql)

**문서 ID**: SCHEMA-001
**작성일**: 2026-02-28
**상태**: Draft

---

## 개요

이 문서는 `scripts/postgresql-init.sql` 파일의 구조와 내용을 정의합니다.
Docker Compose의 `initdb.d` 디렉토리에서 자동으로 실행되어 PostgreSQL 스키마를 초기화합니다.

---

## 파일 위치 및 역할

```
scripts/postgresql-init.sql
├─ 목적: PostgreSQL 데이터베이스 스키마 초기화
├─ 실행 타이밍: Docker 컨테이너 시작 시 자동 실행 (처음 1회)
├─ 사용자: docker-compose.yml의 initdb.d 마운트
└─ 특징: IF NOT EXISTS로 멱등성 보장
```

---

## 스크립트 구조

### 1단계: 확장 활성화

```sql
-- UUID 타입 지원
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- UUID 생성 함수 활성화
-- gen_random_uuid() 사용 가능
```

### 2단계: 테이블 생성

#### 2.1 airlines (항공사)

```sql
CREATE TABLE IF NOT EXISTS airlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL,
  name_ko VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**필드 설명**:
- `id`: UUID 자동 생성
- `code`: 항공사 코드 (예: KAL, AAR) - 유니크
- `name_ko`: 한글 항공사명
- `name_en`: 영문 항공사명
- `display_order`: 화면 표시 순서
- `created_at`: 생성 일시 (자동)

#### 2.2 users (사용자)

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  airline_id UUID NOT NULL REFERENCES airlines(id),
  status VARCHAR(50) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended')),
  role VARCHAR(50) NOT NULL DEFAULT 'user'
    CHECK (role IN ('admin', 'user')),
  is_default_password BOOLEAN DEFAULT true,
  password_change_required BOOLEAN DEFAULT true,
  last_password_changed_at TIMESTAMP,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**필드 설명**:
- `id`: UUID 자동 생성
- `email`: 로그인 이메일 - 유니크
- `password_hash`: bcrypt 해시
- `airline_id`: 소속 항공사 (외래키)
- `status`: 활성/휴지 상태
- `role`: admin/user
- `is_default_password`: 기본 비밀번호 여부
- `password_change_required`: 비밀번호 변경 필수 여부
- `last_login_at`: 마지막 로그인 시각

**제약**:
- `REFERENCES airlines(id)`: 항공사 필수
- CHECK 제약: status, role의 유효한 값만 허용

#### 2.3 password_history (비밀번호 이력)

```sql
CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  changed_by VARCHAR(50)
);
```

**용도**: 비밀번호 변경 이력 추적

#### 2.4 audit_logs (감시 로그)

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  table_name VARCHAR(50),
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**용도**: 데이터 변경 이력 (INSERT/UPDATE/DELETE)

#### 2.5 file_uploads (파일 업로드 이력)

```sql
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name VARCHAR(255) NOT NULL,
  file_size INT,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
  total_rows INT DEFAULT 0,
  success_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  error_message TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  processed_at TIMESTAMP
);
```

**용도**: Excel 파일 업로드 기록

#### 2.6 callsigns (유사호출부호 마스터)

```sql
CREATE TABLE IF NOT EXISTS callsigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airline_id UUID NOT NULL REFERENCES airlines(id) ON DELETE CASCADE,
  airline_code VARCHAR(10) NOT NULL,
  callsign_pair VARCHAR(50) NOT NULL,
  my_callsign VARCHAR(20) NOT NULL,
  other_callsign VARCHAR(20) NOT NULL,
  other_airline_code VARCHAR(10),
  sector VARCHAR(20),
  departure_airport1 VARCHAR(10),
  arrival_airport1 VARCHAR(10),
  departure_airport2 VARCHAR(10),
  arrival_airport2 VARCHAR(10),
  same_airline_code VARCHAR(10),
  same_callsign_length VARCHAR(10),
  same_number_position VARCHAR(20),
  same_number_count INT,
  same_number_ratio DECIMAL(5,2),
  similarity VARCHAR(20),
  max_concurrent_traffic INT,
  coexistence_minutes INT,
  error_probability INT,
  atc_recommendation VARCHAR(50),
  error_type VARCHAR(30),
  sub_error VARCHAR(30),
  risk_level VARCHAR(20),
  occurrence_count INT DEFAULT 0,
  first_occurred_at TIMESTAMP,
  last_occurred_at TIMESTAMP,
  file_upload_id UUID REFERENCES file_uploads(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(airline_id, callsign_pair),
  UNIQUE(airline_code, callsign_pair)
);
```

**특징**:
- 156개의 유사호출부호 데이터 저장
- 이중 유니크 제약 (airline_id + callsign_pair)
- 리스크 레벨, 상태 관리
- CASCADE DELETE (삭제 시 관련 데이터 제거)

#### 2.7 callsign_occurrences (호출부호 발생 이력)

```sql
CREATE TABLE IF NOT EXISTS callsign_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  callsign_id UUID NOT NULL REFERENCES callsigns(id) ON DELETE CASCADE,
  occurred_date DATE NOT NULL,
  occurred_time TIMESTAMP,
  error_type VARCHAR(30),
  sub_error VARCHAR(30),
  location VARCHAR(100),
  flight_level VARCHAR(20),
  file_upload_id UUID REFERENCES file_uploads(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(callsign_id, occurred_date)
);
```

**용도**: 호출부호 실제 발생 이력

#### 2.8 actions (조치 이력)

```sql
CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airline_id UUID NOT NULL REFERENCES airlines(id) ON DELETE CASCADE,
  callsign_id UUID NOT NULL REFERENCES callsigns(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL,
  description TEXT,
  manager_name VARCHAR(100),
  manager_email VARCHAR(255),
  planned_due_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed')),
  result_detail TEXT,
  completed_at TIMESTAMP,
  registered_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_comment TEXT
);
```

**특징**:
- 항공사별 조치 관리
- 상태 추적 (pending → in_progress → completed)
- 리뷰 기능 (reviewed_by, reviewed_at, review_comment)

#### 2.9 action_history (조치 수정 이력)

```sql
CREATE TABLE IF NOT EXISTS action_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  field_name VARCHAR(50),
  old_value TEXT,
  new_value TEXT
);
```

**용도**: 조치 변경 이력 (감사 목적)

#### 2.10 announcements (공지사항)

```sql
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  level VARCHAR(20) NOT NULL DEFAULT 'info'
    CHECK (level IN ('warning', 'info', 'success')),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  target_airlines TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_announcement_date_range CHECK (start_date < end_date)
);
```

**특징**:
- 관리자가 사용자에게 알림
- 유효 기간 관리 (start_date, end_date)
- 심각도 레벨 (warning, info, success)

#### 2.11 announcement_views (공지사항 읽음 상태)

```sql
CREATE TABLE IF NOT EXISTS announcement_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  dismissed_at TIMESTAMP,
  UNIQUE(announcement_id, user_id)
);
```

**용도**: 사용자별 공지사항 읽음 상태 추적

---

### 3단계: 인덱스 생성

```sql
-- users 인덱스
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_airline_id ON users(airline_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- airlines 인덱스
CREATE INDEX IF NOT EXISTS idx_airlines_code ON airlines(code);

-- callsigns 인덱스
CREATE INDEX IF NOT EXISTS idx_callsigns_airline_id ON callsigns(airline_id);
CREATE INDEX IF NOT EXISTS idx_callsigns_airline_code ON callsigns(airline_code);
CREATE INDEX IF NOT EXISTS idx_callsigns_pair ON callsigns(callsign_pair);
CREATE INDEX IF NOT EXISTS idx_callsigns_risk_level ON callsigns(risk_level);
CREATE INDEX IF NOT EXISTS idx_callsigns_status ON callsigns(status);
CREATE INDEX IF NOT EXISTS idx_callsigns_created_at ON callsigns(created_at DESC);

-- callsign_occurrences 인덱스
CREATE INDEX IF NOT EXISTS idx_callsign_occurrences_callsign_id ON callsign_occurrences(callsign_id);
CREATE INDEX IF NOT EXISTS idx_callsign_occurrences_occurred_date ON callsign_occurrences(occurred_date DESC);

-- actions 인덱스
CREATE INDEX IF NOT EXISTS idx_actions_airline_id ON actions(airline_id);
CREATE INDEX IF NOT EXISTS idx_actions_callsign_id ON actions(callsign_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_registered_by ON actions(registered_by);
CREATE INDEX IF NOT EXISTS idx_actions_registered_at ON actions(registered_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_completed_at ON actions(completed_at DESC);

-- action_history 인덱스
CREATE INDEX IF NOT EXISTS idx_action_history_action_id ON action_history(action_id);
CREATE INDEX IF NOT EXISTS idx_action_history_changed_at ON action_history(changed_at DESC);

-- announcements 인덱스
CREATE INDEX IF NOT EXISTS idx_announcements_start_date ON announcements(start_date);
CREATE INDEX IF NOT EXISTS idx_announcements_end_date ON announcements(end_date);
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_level ON announcements(level);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON announcements(created_by);

-- announcement_views 인덱스
CREATE INDEX IF NOT EXISTS idx_announcement_views_announcement_id ON announcement_views(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_views_user_id ON announcement_views(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_views_viewed_at ON announcement_views(viewed_at DESC);

-- file_uploads 인덱스
CREATE INDEX IF NOT EXISTS idx_file_uploads_uploaded_at ON file_uploads(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_uploads_status ON file_uploads(status);
CREATE INDEX IF NOT EXISTS idx_file_uploads_uploaded_by ON file_uploads(uploaded_by);

-- password_history 인덱스
CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON password_history(user_id);

-- audit_logs 인덱스
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

**인덱스 전략**:
- WHERE 절에 자주 사용되는 컬럼 (email, status 등)
- ORDER BY DESC에 사용되는 컬럼 (created_at 등)
- 외래키 (airline_id, user_id 등)
- 조회 성능 향상

---

### 4단계: 기본 데이터 삽입

#### 항공사 11개

```sql
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
  ('ESR', '이스타항공', 'EASTAR JET', 11)
ON CONFLICT (code) DO NOTHING;
```

**특징**:
- ON CONFLICT DO NOTHING: 중복 시 무시 (멱등성)
- display_order로 화면 표시 순서 제어

#### 기본 사용자 계정

```sql
INSERT INTO users (email, password_hash, airline_id, status, role)
SELECT u.email, u.password_hash, a.id, 'active', u.role
FROM (VALUES
  ('parkeungi21@korea.kr',  '$2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm', 'KAL', 'admin'),
  ('parkeungi21@korea.kr',  '$2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm', 'KAL', 'admin'),
  ('kal@test.com',          '$2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm', 'KAL', 'user'),
  ... (더 많은 계정)
) AS u(email, password_hash, airline_code, role)
JOIN airlines a ON a.code = u.airline_code
ON CONFLICT (email) DO NOTHING;
```

**비밀번호**: 모두 `1234`로 설정 (bcrypt 해시 동일)

---

## SQLite vs PostgreSQL 마이그레이션 체크리스트

| 항목 | SQLite | PostgreSQL | 확인 |
|------|--------|-----------|------|
| **UUID** | TEXT | UUID (gen_random_uuid) | ✓ |
| **BOOLEAN** | INTEGER (0/1) | BOOLEAN | ✓ |
| **타임스탬프** | DATETIME | TIMESTAMP | ✓ |
| **IF NOT EXISTS** | ✓ | ✓ | ✓ |
| **외래키** | PRAGMA foreign_keys ON | REFERENCES | ✓ |
| **CHECK 제약** | ✓ | ✓ | ✓ |
| **인덱스** | CREATE INDEX | CREATE INDEX | ✓ |
| **ON CONFLICT** | ✓ | ON CONFLICT | ✓ |

---

## 검증 방법

### Docker에서 스키마 확인

```bash
# PostgreSQL 컨테이너 접속
docker exec -it katc1-postgres psql -U katc1_user -d katc1

# 테이블 목록
\dt

# 특정 테이블 스키마
\d airlines

# 인덱스 목록
\di

# 나가기
\q
```

### 데이터 확인

```sql
SELECT COUNT(*) FROM airlines;  -- 11행
SELECT COUNT(*) FROM users;     -- 13행
SELECT * FROM airlines LIMIT 5;
```

---

## 주의사항

1. **멱등성**: 모든 CREATE TABLE/INDEX는 IF NOT EXISTS 사용
2. **순서**: 외래키 제약이 있으므로 airlines → users → callsigns 순서 필수
3. **CASCADE**: ON DELETE CASCADE로 관련 데이터 자동 삭제
4. **트리거**: 추후 TRIGGER로 audit_logs 자동 기록 가능

---

**작성자**: Claude Code
**최종 수정**: 2026-02-28
