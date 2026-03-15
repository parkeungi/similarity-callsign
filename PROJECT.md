# 유사호출부호 공유시스템 — 프로젝트 문서

> 이 문서 하나로 전체 시스템을 이해하고 재현할 수 있도록 작성된 기술 통합 문서입니다.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [환경 변수](#3-환경-변수)
4. [폴더 구조](#4-폴더-구조)
5. [데이터베이스 스키마](#5-데이터베이스-스키마)
6. [API 설계](#6-api-설계)
7. [인증 흐름](#7-인증-흐름)
8. [조치(Actions) 상태 관리 규칙](#8-조치actions-상태-관리-규칙)
9. [컴포넌트 구조](#9-컴포넌트-구조)
10. [커스텀 훅](#10-커스텀-훅)
11. [상태 관리](#11-상태-관리)
12. [라이브러리 및 유틸리티](#12-라이브러리-및-유틸리티)
13. [타입 정의](#13-타입-정의)
14. [상수 정의](#14-상수-정의)
15. [UI/UX 규칙](#15-uiux-규칙)
16. [코딩 컨벤션](#16-코딩-컨벤션)
17. [보안 규칙](#17-보안-규칙)
18. [배포](#18-배포)

---

## 1. 프로젝트 개요

- **시스템명**: 유사호출부호 공유시스템
- **운영 기관**: 한국공항공사 (KAC)
- **목적**: 항공사 운항 중 발생하는 유사 호출부호 상황을 감지하고, 항공사별로 조치 현황을 관리하는 폐쇄형 웹 서비스
- **사용자**: 관리자(항교통본부), 항공사 담당자
- **배포 환경**: Render.com (Node.js), 데이터베이스: Supabase (PostgreSQL)

### 핵심 기능

| 기능 | 설명 |
|------|------|
| 유사호출부호 등록 | 엑셀 파일 업로드로 유사호출부호 데이터 일괄 등록 |
| 조치 관리 | 항공사별 조치 등록·수정·취소·재조치 |
| 상태 동기화 | 조치 완료 시 callsigns 상태 자동 업데이트 |
| 공지사항 | 관리자가 항공사별 대상 공지사항 발행 |
| 통계 대시보드 | 위험도·조치유형·월별 추이 등 다양한 통계 |

---

## 2. 기술 스택

```
Frontend:  Next.js 14 (App Router), TypeScript, Tailwind CSS
State:     Zustand (전역 인증 상태), TanStack Query v5 (서버 상태)
Forms:     react-hook-form + zod
Charts:    recharts
Database:  PostgreSQL (Supabase)
ORM:       없음 — 직접 SQL (pg 드라이버)
Auth:      JWT (AccessToken + RefreshToken / httpOnly 쿠키)
Email:     nodemailer
Excel:     xlsx
Icons:     lucide-react
```

### 주요 패키지 (package.json 기준)

```json
{
  "next": "^14",
  "@tanstack/react-query": "^5",
  "zustand": "^4",
  "react-hook-form": "^7",
  "zod": "^3",
  "@supabase/supabase-js": "^2",
  "pg": "^8",
  "bcryptjs": "^3",
  "jsonwebtoken": "^9",
  "recharts": "^3",
  "xlsx": "^0.18",
  "nodemailer": "^8",
  "date-fns": "^4",
  "lucide-react": "^0.294"
}
```

---

## 3. 환경 변수

`.env.local` 파일에 설정 (`.env.example` 참조)

```bash
# DB 선택 ('sqlite' | 'postgresql')
DB_PROVIDER=postgresql

# PostgreSQL 연결 (트랜잭션 풀러 포트 6543 권장)
DATABASE_URL=postgresql://postgres:[password]@[host]:6543/postgres

# Supabase (서버 사이드)
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...

# JWT (openssl rand -base64 32 로 생성)
JWT_SECRET=...

# 앱 설정
NODE_ENV=production
NEXT_PUBLIC_APP_NAME=유사호출부호 공유시스템

# 이메일 (선택)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
```

---

## 4. 폴더 구조

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 비인증 페이지
│   │   ├── change-password/      # 비밀번호 변경
│   │   └── forgot-password/      # 비밀번호 찾기
│   ├── (main)/                   # 인증 사용자 영역
│   │   └── airline/              # 항공사 대시보드
│   │       └── announcements/    # 공지사항
│   ├── admin/                    # 관리자 영역
│   │   ├── users/
│   │   ├── airlines/
│   │   ├── announcements/
│   │   ├── actions/
│   │   ├── callsign-management/
│   │   ├── file-uploads/
│   │   ├── password-reset/
│   │   └── settings/
│   │       └── action-types/
│   ├── api/                      # REST API 라우트
│   │   ├── auth/                 # 인증 (login, logout, me, refresh, change-password)
│   │   ├── airlines/             # 항공사 (callsigns, actions, stats)
│   │   ├── actions/              # 조치 CRUD
│   │   ├── callsigns/            # 호출부호 (stats)
│   │   ├── callsigns-with-actions/
│   │   ├── announcements/        # 공지사항
│   │   ├── action-types/
│   │   └── admin/                # 관리자 전용 API
│   ├── callsign-management/      # 호출부호 관리 페이지
│   ├── layout.tsx
│   └── page.tsx                  # 루트 (로그인)
├── components/
│   ├── actions/                  # 조치 모달·테이블
│   ├── admin/                    # 관리자 컴포넌트·차트
│   │   └── settings/
│   ├── airline/                  # 항공사 대시보드 컴포넌트
│   │   └── tabs/
│   ├── announcements/            # 공지사항 컴포넌트
│   ├── callsign-management/      # 호출부호 관리 탭·카드
│   │   └── uploads/
│   ├── forms/                    # 로그인·비밀번호 폼
│   ├── layout/                   # 헤더·사이드바·셸
│   └── ui/                       # 공통 UI (Button, Input, StatusBadge 등)
├── hooks/                        # TanStack Query 커스텀 훅
├── lib/
│   ├── db/
│   │   ├── index.ts              # DB 팩토리 및 쿼리 함수
│   │   ├── interface.ts          # DB 프로바이더 인터페이스
│   │   ├── sql-helpers.ts        # SQL 헬퍼
│   │   ├── sync-callsign-status.ts
│   │   ├── providers/
│   │   │   ├── sqlite/
│   │   │   └── postgresql/
│   │   └── queries/              # 도메인별 쿼리 모듈
│   ├── supabase/
│   │   └── client.ts
│   ├── api/                      # 클라이언트 API 호출 함수
│   ├── constants.ts
│   ├── jwt.ts
│   ├── cookies.ts
│   ├── mail.ts
│   ├── admin-navigation.ts
│   └── occurrence-format.ts
├── store/
│   └── authStore.ts              # Zustand 인증 상태
└── types/                        # TypeScript 타입 정의
    ├── user.ts
    ├── airline.ts
    ├── action.ts
    ├── announcement.ts
    ├── auth.ts
    └── settings.ts
scripts/
└── init.sql                      # PostgreSQL 스키마 + 초기 데이터
```

---

## 5. 데이터베이스 스키마

PostgreSQL 기준. 전체 DDL은 `scripts/init.sql` 참조.

### 5.1 테이블 목록

| 테이블 | 역할 |
|--------|------|
| `airlines` | 국내 항공사 마스터 (12개 + FOREIGN) |
| `users` | 사용자 계정 (관리자 + 항공사 담당자) |
| `password_history` | 비밀번호 변경 이력 |
| `callsigns` | 유사호출부호 마스터 데이터 |
| `callsign_occurrences` | 호출부호 발생 이력 |
| `actions` | 조치 이력 |
| `action_history` | 조치 수정 감시 이력 |
| `action_types` | 조치 유형 정의 (동적 관리) |
| `announcements` | 공지사항 |
| `announcement_views` | 사용자별 공지사항 읽음 상태 |
| `file_uploads` | 엑셀 업로드 이력 |
| `audit_logs` | 감사 로그 |

### 5.2 기본 시드 데이터

> 모든 기본 계정의 초기 비밀번호는 `1234`입니다.
> bcrypt hash: `$2b$10$8u0KODIbldb.4gvwdHYPzeDWrlbj9bSjH4CTzUN23kywMi3z/dDUm`

#### 관리자 계정 (2명)

| 이메일 | 역할 | 소속 | 비고 |
|--------|------|------|------|
| `lsi117@airport.co.kr` | admin | KAL (관리자용) | 비밀번호 변경 불요 |
| `parkeungi21@korea.kr` | admin | KAL (관리자용) | 비밀번호 변경 불요 |

#### 항공사 담당자 계정 (항공사별 1명)

| 이메일 | 항공사 | 초기 비밀번호 | 비고 |
|--------|--------|--------------|------|
| `kal@test.com` | 대한항공 (KAL) | 1234 | 첫 로그인 시 변경 필요 |
| `aar@test.com` | 아시아나항공 (AAR) | 1234 | 첫 로그인 시 변경 필요 |
| `jja@test.com` | 제주항공 (JJA) | 1234 | 첫 로그인 시 변경 필요 |
| `jna@test.com` | 진에어 (JNA) | 1234 | 첫 로그인 시 변경 필요 |
| `twb@test.com` | 티웨이항공 (TWB) | 1234 | 첫 로그인 시 변경 필요 |
| `abl@test.com` | 에어부산 (ABL) | 1234 | 첫 로그인 시 변경 필요 |
| `asv@test.com` | 에어서울 (ASV) | 1234 | 첫 로그인 시 변경 필요 |
| `eok@test.com` | 이스타항공 (EOK) | 1234 | 첫 로그인 시 변경 필요 |
| `fgw@test.com` | 플라이강원 (FGW) | 1234 | 첫 로그인 시 변경 필요 |
| `apz@test.com` | 에어프레미아 (APZ) | 1234 | 첫 로그인 시 변경 필요 |
| `esr@test.com` | 이스타항공 (ESR) | 1234 | 첫 로그인 시 변경 필요 |

> 항공사 계정은 `is_default_password = true`, `password_change_required = true` 로 설정되어 첫 로그인 시 비밀번호 변경 페이지로 강제 이동됩니다.

### 5.3 핵심 테이블 상세

#### airlines
```sql
CREATE TABLE airlines (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  code         TEXT UNIQUE NOT NULL,   -- ICAO 3자리 코드 (KAL, AAR 등)
  name_ko      TEXT NOT NULL,
  name_en      TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

**등록된 국내 항공사 (12개 + FOREIGN)**

| code | name_ko | display_order |
|------|---------|---------------|
| KAL | 대한항공 | 1 |
| AAR | 아시아나항공 | 2 |
| JJA | 제주항공 | 3 |
| JNA | 진에어 | 4 |
| TWB | 티웨이항공 | 5 |
| ABL | 에어부산 | 6 |
| ASV | 에어서울 | 7 |
| EOK | 이스타항공 | 8 |
| FGW | 플라이강원 | 9 |
| APZ | 에어프레미아 | 10 |
| ESR | 이스타항공 | 11 |
| ARK | 에어로케이 | 12 |
| FOREIGN | 외항사 | 99 |

#### users
```sql
CREATE TABLE users (
  id                       TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email                    TEXT UNIQUE NOT NULL,
  password_hash            TEXT NOT NULL,
  airline_id               TEXT REFERENCES airlines(id),
  status                   TEXT DEFAULT 'active',  -- 'active' | 'suspended'
  role                     TEXT DEFAULT 'user',    -- 'admin' | 'user'
  is_default_password      BOOLEAN DEFAULT true,
  password_change_required BOOLEAN DEFAULT false,
  last_password_changed_at TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);
```

#### callsigns
```sql
CREATE TABLE callsigns (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  airline_id          TEXT REFERENCES airlines(id),
  airline_code        TEXT NOT NULL,          -- 자사 항공사 코드
  callsign_pair       TEXT NOT NULL,          -- "KAL123|AAR123" 형태
  my_callsign         TEXT NOT NULL,
  other_callsign      TEXT NOT NULL,
  other_airline_code  TEXT NOT NULL,          -- 타사 항공사 코드
  risk_level          TEXT,                   -- '매우높음' | '높음' | '낮음'
  similarity          TEXT,                   -- '매우높음' | '높음' | '낮음'
  error_type          TEXT,
  sub_error           TEXT,
  occurrence_count    INTEGER DEFAULT 0,
  first_occurred_at   TIMESTAMPTZ,
  last_occurred_at    TIMESTAMPTZ,
  status              TEXT DEFAULT 'in_progress',  -- 'in_progress' | 'completed'
  my_action_status    TEXT DEFAULT 'no_action',
  other_action_status TEXT DEFAULT 'no_action',
  uploaded_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

#### actions
```sql
CREATE TABLE actions (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  airline_id    TEXT REFERENCES airlines(id),
  callsign_id   TEXT REFERENCES callsigns(id),
  action_type   TEXT,                          -- 조치유형 (action_types.name 참조)
  description   TEXT,                          -- 조치 상세 내용
  manager_name  TEXT,                          -- 담당자명
  status        TEXT DEFAULT 'in_progress',    -- 'pending' | 'in_progress' | 'completed'
  is_cancelled  BOOLEAN DEFAULT false,
  registered_by TEXT REFERENCES users(id),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

#### action_types
```sql
CREATE TABLE action_types (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name          TEXT UNIQUE NOT NULL,
  description   TEXT,
  display_order INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

#### announcements
```sql
CREATE TABLE announcements (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  level           TEXT DEFAULT 'info',     -- 'warning' | 'info' | 'success'
  start_date      TIMESTAMPTZ NOT NULL,
  end_date        TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT true,
  target_airlines TEXT[],                  -- 특정 항공사 코드 배열 (null = 전체)
  created_by      TEXT REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.3 주요 인덱스

```sql
-- users
idx_users_email, idx_users_airline_id, idx_users_status, idx_users_created_at

-- callsigns
idx_callsigns_airline_id, idx_callsigns_risk_level, idx_callsigns_status

-- actions
idx_actions_airline_id, idx_actions_status, idx_actions_registered_at

-- announcements
idx_announcements_start_date, idx_announcements_is_active

-- file_uploads
idx_file_uploads_uploaded_at, idx_file_uploads_status
```

---

## 6. API 설계

### 6.1 응답 형식 (통일)

```typescript
// 단일 데이터
{ data: T, success: boolean }

// 목록 + 페이지네이션
{ data: T[], pagination: { page, limit, total, totalPages } }

// 조치 목록 (summary 포함)
{ data: T[], pagination: {...}, summary: { pending, in_progress, completed } }

// 에러
{ error: string }  // status: 400 | 401 | 403 | 404 | 500
```

### 6.2 인증 API

| 메서드 | 경로 | 기능 | 인증 |
|--------|------|------|------|
| POST | `/api/auth/login` | 이메일+비밀번호 로그인 | ✗ |
| POST | `/api/auth/logout` | 로그아웃 (쿠키 삭제) | ✓ |
| GET | `/api/auth/me` | 현재 사용자 정보 | ✓ |
| POST | `/api/auth/refresh` | AccessToken 갱신 | Refresh 쿠키 |
| POST | `/api/auth/change-password` | 비밀번호 변경 | ✓ |
| POST | `/api/auth/forgot-password` | 비밀번호 초기화 요청 | ✗ |

### 6.3 항공사 API

| 메서드 | 경로 | 기능 | 권한 |
|--------|------|------|------|
| GET | `/api/airlines` | 항공사 목록 | 공개 |
| GET | `/api/airlines/[airlineId]/callsigns` | 유사호출부호 목록 | 해당항공사·관리자 |
| GET | `/api/airlines/[airlineId]/actions` | 조치 목록 | 해당항공사·관리자 |
| POST | `/api/airlines/[airlineId]/actions` | 조치 등록/수정 | 해당항공사·관리자 |
| GET | `/api/airlines/[airlineId]/actions/stats` | 조치 통계 | 해당항공사·관리자 |

### 6.4 조치 API

| 메서드 | 경로 | 기능 | 권한 |
|--------|------|------|------|
| GET | `/api/actions` | 전체 조치 목록 | 관리자 |
| GET | `/api/actions/[id]` | 조치 상세 | 해당항공사·관리자 |
| PATCH | `/api/actions/[id]` | 상태 업데이트·취소 | 해당항공사·관리자 |
| DELETE | `/api/actions/[id]` | 조치 삭제 | 관리자 |

### 6.5 호출부호 API

| 메서드 | 경로 | 기능 | 권한 |
|--------|------|------|------|
| GET | `/api/callsigns/stats` | 통계 요약 | 관리자 |
| GET | `/api/callsigns-with-actions` | 호출부호+조치 결합 | 관리자 |

### 6.6 공지사항 API

| 메서드 | 경로 | 기능 | 권한 |
|--------|------|------|------|
| GET | `/api/announcements` | 현재 활성 공지사항 | 인증 전체 |
| POST | `/api/announcements` | 공지사항 생성 | 관리자 |
| GET | `/api/announcements/[id]` | 상세 조회 | 인증 전체 |
| PATCH | `/api/announcements/[id]` | 수정 | 관리자 |
| DELETE | `/api/announcements/[id]` | 삭제 | 관리자 |
| GET | `/api/announcements/history` | 이력 조회 | 인증 전체 |

### 6.7 관리자 전용 API

| 메서드 | 경로 | 기능 |
|--------|------|------|
| GET/POST | `/api/admin/users` | 사용자 목록·생성 |
| GET/PATCH | `/api/admin/users/[id]` | 사용자 상세·수정 |
| POST | `/api/admin/users/[id]/password-reset` | 비밀번호 초기화 |
| GET/POST | `/api/admin/airlines` | 항공사 관리 |
| PATCH/DELETE | `/api/admin/airlines/[id]` | 항공사 수정·삭제 |
| POST | `/api/admin/upload-callsigns` | 호출부호 엑셀 업로드 |
| GET | `/api/admin/file-uploads` | 업로드 이력 |
| DELETE | `/api/admin/file-uploads/[id]/force-delete` | 업로드 이력 삭제 |
| GET | `/api/admin/overview` | 대시보드 개요 통계 |
| GET | `/api/admin/comprehensive-stats` | 종합 통계 |
| GET | `/api/admin/monthly-detection-trend` | 월별 탐지 추이 |
| GET | `/api/admin/action-effectiveness` | 조치 효과성 분석 |
| GET | `/api/admin/airline-stats` | 항공사별 통계 |
| GET/POST | `/api/admin/settings/action-types` | 조치 유형 관리 |
| PATCH | `/api/admin/settings/action-types/[id]` | 조치 유형 수정 |

### 6.8 쿼리 파라미터 규칙

```
필터:     ?riskLevel=매우높음&status=in_progress
페이지:   ?page=1&limit=100
정렬:     ?sortBy=created_at&order=desc
날짜범위: ?dateFrom=2026-02-01&dateTo=2026-03-09
```

---

## 7. 인증 흐름

### 7.1 로그인

```
POST /api/auth/login
  → bcrypt 비밀번호 검증
  → JWT AccessToken 발급 (1시간)
  → RefreshToken → httpOnly 쿠키 (7일)
  → authStore에 accessToken + user 저장
```

**JWT Payload 구조**
```typescript
{
  userId: string,
  email: string,
  role: 'admin' | 'user',
  status: 'active' | 'suspended',
  airlineId: string | null
}
```

### 7.2 API 요청

```
Authorization: Bearer {accessToken}
→ verifyToken() 으로 JWT 검증
→ payload.role 로 권한 확인
```

### 7.3 비밀번호 정책

- 로그인 시 `is_default_password = true` → `/change-password` 강제 이동
- 로그인 시 `password_change_required = true` → `/change-password` 강제 이동
- 비밀번호 규칙: `8자 이상, 대문자·소문자·숫자·특수문자 모두 포함`
- 변경 이력은 `password_history` 테이블에 기록

### 7.4 토큰 갱신

```
POST /api/auth/refresh
  → 쿠키의 refreshToken 검증
  → 새 accessToken 발급
```

---

## 8. 조치(Actions) 상태 관리 규칙

> **핵심 원칙**: `callsigns` 상태와 `actions` 상태는 항상 동기화

### 8.1 국내/외항사 판별

```typescript
// constants.ts의 AIRLINES 배열 기반
const DOMESTIC_AIRLINE_CODES = new Set<string>(['KAL','AAR','JJA','JNA','TWB','ABL','ASV','EOK','FGW','APZ','ESR']);
const isForeign = !DOMESTIC_AIRLINE_CODES.has(airlineCode);
```

### 8.2 완료 조건 매트릭스

| 항공사 조합 | 조치 주체 | callsigns 최종 상태 |
|------------|---------|-------------------|
| 같은 항공사 | 아무나 | `completed` |
| 국내 ↔ 국내 | 첫 번째 항공사 | `in_progress` |
| 국내 ↔ 국내 | 두 번째 항공사 | `completed` |
| 국내 ↔ 외항사 | 국내 항공사 | `completed` |
| 외항사 ↔ 외항사 | 아무나 | `completed` |

### 8.3 상태 변화 흐름

```
1. 등록 (관리자 엑셀 업로드)
   → callsigns 생성, status = 'in_progress'
   → actions 생성, status = 'in_progress'

2. 조치 (항공사 대시보드)
   POST /api/airlines/:id/actions
   → actions 업데이트 status = 'completed'
   → 완료 조건 확인 후 callsigns.status 동기화

3. 취소
   PATCH /api/actions/:id { status: 'in_progress' }
   → actions.is_cancelled = true
   → actions.status = 'in_progress'
   → callsigns.status = 'in_progress'
   → 조치 목록 표시: is_cancelled = false 인 것만

4. 재조치
   POST /api/airlines/:id/actions
   → 기존 취소된 row UPDATE (새 row 추가 X)
   → is_cancelled = false, status 재계산
```

### 8.4 금지 사항

- `callsigns`와 `actions` 상태 불일치 방지
- `is_cancelled = true` 행 물리 삭제 금지
- 모든 상태 변경은 트랜잭션으로 양쪽 동시 업데이트

---

## 9. 컴포넌트 구조

### 9.1 페이지별 주요 컴포넌트

#### 관리자 호출부호 관리 (`/callsign-management`)
```
callsign-management/
├── OverviewTab.tsx       # 호출부호 목록, 필터, 상태 카드, 상세 모달
├── StatisticsTab.tsx     # 통계 차트
├── StatCard.tsx          # 통계 숫자 카드
└── uploads/
    ├── FileUploadZone.tsx     # 드래그&드롭 엑셀 업로드
    ├── UploadResult.tsx       # 업로드 결과 (성공/실패 행 수)
    └── UploadHistory.tsx      # 업로드 이력 목록
```

#### 항공사 대시보드 (`/airline`)
```
airline/
├── AirlineStatisticsTab.tsx       # KPI 카드 + 차트
├── AirlineAnnouncementList.tsx    # 공지사항 배너 목록
├── ActionDetailModal.tsx          # 조치 상세 모달
└── tabs/
    ├── AirlineCallsignListTab.tsx  # 호출부호 목록 탭
    ├── AirlineOccurrenceTab.tsx    # 발생이력 탭
    ├── AirlineActionHistoryTab.tsx # 조치이력 탭
    ├── AnnouncementsTab.tsx        # 공지사항 탭
    └── IncidentFilters.tsx         # 필터 컴포넌트
```

#### 조치 모달
```
actions/
├── ActionModal.tsx        # 조치 등록·수정 모달 (항공사용)
└── ActionDetailModal.tsx  # 조치 상세 조회 모달 (관리자용)
```

### 9.2 호출부호 목록 색상 규칙 (OverviewTab)

```typescript
// 외항사 여부 판별
const isMyDomestic = DOMESTIC_AIRLINE_CODES.has(myAirlineCode);
const isOtherDomestic = DOMESTIC_AIRLINE_CODES.has(otherAirlineCode);

// 색상 적용
// 국내항공사: text-blue-600 (숫자 동일) | text-red-500 (숫자 다름)
// 외항사:     text-orange-500
```

### 9.3 위험도 배지 색상

```typescript
'매우높음' → bg-red-500 text-white       // 솔리드 빨간색
'높음'     → bg-orange-100 text-orange-700  // 연한 주황색
'낮음'     → bg-emerald-50 text-emerald-600  // 연한 초록
```

---

## 10. 커스텀 훅

TanStack Query v5 기반. 모두 `src/hooks/`에 위치.

| 파일 | 주요 훅 | 역할 |
|------|--------|------|
| `useAuth.ts` | `useAuth()` | 인증 상태, 로그인·로그아웃 |
| `useAirlines.ts` | `useAirlines()`, `useAdminAirlines()` | 항공사 목록 |
| `useActions.ts` | `useCallsignsWithActions()`, `useAirlineActions()`, `useCreateAction()`, `useUpdateAction()` | 조치 CRUD |
| `useAnnouncements.ts` | `useAnnouncements()`, `useAdminAnnouncements()`, `useCreateAnnouncement()` | 공지사항 관리 |
| `useActionTypes.ts` | `useActiveActionTypes()`, `useAdminActionTypes()` | 조치 유형 |
| `useFileUploads.ts` | `useFileUploads()`, `useUploadFile()` | 파일 업로드 |
| `useSessionTimeout.ts` | `useSessionTimeout()` | 세션 만료 감지 |
| `useDateRangeFilter.ts` | `useDateRangeFilter()` | 날짜 범위 필터 상태 |

### 훅 패턴 예시

```typescript
export function useCallsignsWithActions(params: CallsignQueryParams) {
  const accessToken = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: ['callsigns-with-actions', params],
    queryFn: async () => {
      const res = await fetch(`/api/callsigns-with-actions?${qs}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('조회 실패');
      return res.json();
    },
    enabled: !!accessToken,
    staleTime: 30_000,
  });
}
```

---

## 11. 상태 관리

### Zustand — authStore

```typescript
// src/store/authStore.ts
interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setIsLoading: (v: boolean) => void;
  logout: () => void;
}
```

- AccessToken은 `authStore`에 보관 (메모리)
- RefreshToken은 httpOnly 쿠키에 보관
- 페이지 새로고침 시 `/api/auth/refresh` 호출로 복원

---

## 12. 라이브러리 및 유틸리티

### DB 추상화 (`src/lib/db/`)

```typescript
// index.ts — 환경 변수로 프로바이더 선택
const provider = process.env.DB_PROVIDER === 'postgresql'
  ? new PostgreSQLProvider()
  : new SQLiteProvider();

// 사용 예시
export async function query(sql: string, params: unknown[] = []) {
  return provider.query(sql, params);
}
```

**PostgreSQL 플레이스홀더**: `$1, $2, $3` (SQLite의 `?` 사용 금지)

### JWT (`src/lib/jwt.ts`)

```typescript
export function signToken(payload: JwtPayload): string
export function verifyToken(token: string): JwtPayload | null
```

### 상수 (`src/lib/constants.ts`)

- `AIRLINES`: 국내 항공사 배열 (code, name_ko, name_en)
- `PASSWORD_REGEX`: 비밀번호 유효성 검증 정규식
- `ROUTES`: 애플리케이션 경로 상수
- `USER_STATUS`, `USER_ROLE`: 열거형 상수
- `ANNOUNCEMENT_LEVEL`, `ANNOUNCEMENT_LEVEL_COLORS`: 공지사항 레벨

---

## 13. 타입 정의

### 핵심 타입 (`src/types/action.ts`)

```typescript
interface Callsign {
  id: string;
  airline_id: string;
  airline_code: string;
  callsign_pair: string;
  my_callsign: string;
  other_callsign: string;
  other_airline_code?: string;
  my_airline_code?: string;
  risk_level: string;
  similarity?: string;
  error_type?: string;
  sub_error?: string;
  occurrence_count?: number;
  first_occurred_at?: string;
  last_occurred_at?: string;
  status: 'in_progress' | 'completed';
  my_action_status?: string;
  other_action_status?: string;
  final_status?: 'complete' | 'partial' | 'in_progress';
  action_type?: string;
  uploaded_at?: string;
}

interface Action {
  id: string;
  airline_id: string;
  callsign_id: string;
  action_type?: string;
  description?: string;
  manager_name?: string;
  status: 'pending' | 'in_progress' | 'completed';
  is_cancelled?: boolean;
  registered_by?: string;
  registered_at?: string;
  completed_at?: string;
}
```

### 사용자 타입 (`src/types/user.ts`)

```typescript
interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  airlineId: string | null;
  airline?: { id: string; code: string; name_ko: string; name_en: string };
  isDefaultPassword?: boolean;
  passwordChangeRequired?: boolean;
}
```

---

## 14. 상수 정의

```typescript
// 국내 항공사 판별용
export const AIRLINES = [
  { code: 'KAL', name_ko: '대한항공',   name_en: 'Korean Air' },
  { code: 'AAR', name_ko: '아시아나항공', name_en: 'Asiana Airlines' },
  { code: 'JJA', name_ko: '제주항공',   name_en: 'Jeju Air' },
  { code: 'JNA', name_ko: '진에어',     name_en: 'Jin Air' },
  { code: 'TWB', name_ko: '티웨이항공', name_en: "T'way Air" },
  { code: 'ABL', name_ko: '에어부산',   name_en: 'Air Busan' },
  { code: 'ASV', name_ko: '에어서울',   name_en: 'Air Seoul' },
  { code: 'EOK', name_ko: '이스타항공', name_en: 'Eastar Jet' },
  { code: 'ESR', name_ko: '이스타항공', name_en: 'Eastar Jet' },
  { code: 'FGW', name_ko: '플라이강원', name_en: 'Fly Gangwon' },
  { code: 'APZ', name_ko: '에어프레미아', name_en: 'Air Premia' },
] as const;

// 비밀번호 규칙
export const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]).{8,}$/;
export const PASSWORD_RULE = '8자 이상, 대문자·소문자·숫자·특수문자 모두 포함';

// 쿠키
export const COOKIE_OPTIONS = {
  REFRESH_TOKEN_NAME: 'refreshToken',
  REFRESH_TOKEN_MAX_AGE: 7 * 24 * 60 * 60,  // 7일
};

// 공지사항 레벨
export const ANNOUNCEMENT_LEVEL = {
  WARNING: 'warning',  // 빨강
  INFO: 'info',        // 파랑
  SUCCESS: 'success',  // 초록
};
```

---

## 15. UI/UX 규칙

### 레이아웃

- **Mobile-first**: `md:`, `lg:` 브레이크포인트로 확장
- **Server Component 기본**, `useState`·`useEffect` 필요 시만 `'use client'`
- **이미지**: `<img>` 대신 `next/image`의 `<Image />` 사용

### 접근성

- 시맨틱 태그 (`<main>`, `<section>`, `<button>`) 사용
- ARIA 속성 준수

### 색상 시스템 (위험도)

| 값 | 배경 | 텍스트 | 적용 |
|----|------|--------|------|
| 매우높음 | `bg-red-500` | `text-white` | 솔리드 강조 |
| 높음 | `bg-orange-100` | `text-orange-700` | 중간 강도 |
| 낮음 | `bg-emerald-50` | `text-emerald-600` | 약한 강조 |

### 색상 시스템 (조치상태)

| 상태 | 스타일 |
|------|--------|
| completed | `bg-emerald-50 text-emerald-600` |
| in_progress | `bg-blue-50 text-blue-600` |
| pending | `bg-amber-50 text-amber-600` |
| no_action | `bg-gray-50 text-gray-600` |

### 색상 시스템 (호출부호)

| 조건 | 색상 |
|------|------|
| 국내항공사 + 숫자 동일 | `text-blue-600` |
| 국내항공사 + 숫자 다름 | `text-red-500` |
| 외항사 | `text-orange-500` |

---

## 16. 코딩 컨벤션

### 파일 명명

```
페이지 컴포넌트: kebab-case  →  user-approval-table.tsx
React 컴포넌트: PascalCase   →  export function UserApprovalTable() {}
커스텀 훅:      camelCase    →  export function useAirlineCallsigns() {}
상수:           UPPER_SNAKE  →  const MAX_LIMIT = 1000
함수:           camelCase    →  function calculateRiskLevel() {}
```

### TypeScript

```typescript
// ✅ 명시적 타입 사용
const data: Callsign[] = response.data;

// ❌ any 금지
const data: any = response.data;
```

### 로그 형식

```typescript
// ✅ 구조화된 로그
console.log('[COMPONENT_NAME] Action:', { key: value });
```

### API 에러 처리

```typescript
try {
  const { rows } = await query(sql, params);
  return NextResponse.json({ data: rows, success: true });
} catch (error) {
  console.error('[API] Error:', error);
  return NextResponse.json({ error: '처리 중 오류' }, { status: 500 });
}
```

### 금지 사항

- `console.log` 커밋 금지 (디버그 제거 필수)
- 주석 처리된 코드 커밋 금지
- 환경 변수 하드코딩 금지
- `git push --force` 금지
- `git reset --hard` 금지

---

## 17. 보안 규칙

### 인증 검증 (모든 API 공통)

```typescript
const token = request.headers.get('Authorization')?.substring(7);
const payload = verifyToken(token);
if (!payload) {
  return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
}
if (payload.role !== 'admin') {
  return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
}
```

### SQL Injection 방지

```typescript
// ✅ 파라미터화 쿼리 ($1, $2 사용)
const { rows } = await query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// ❌ 문자열 보간 금지
await query(`SELECT * FROM users WHERE email = '${email}'`);
```

### 비밀번호 해싱

```typescript
// bcryptjs 사용
const hash = await bcrypt.hash(password, 10);
const isValid = await bcrypt.compare(password, hash);
```

---

## 18. 배포

### Render.com 설정

```
Environment: Node.js
Build Command: npm run build
Start Command: npm start
```

**필수 환경 변수**
- `DATABASE_URL` (PostgreSQL 연결 문자열, 포트 6543)
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `JWT_SECRET`
- `NODE_ENV=production`

### 로컬 개발

```bash
# 설치
npm install

# 개발 서버
npm run dev

# 빌드 확인
npm run build

# 린트
npm run lint
```

### DB 초기화 (Supabase)

```bash
# Supabase SQL 에디터에서 실행
# scripts/init.sql 전체 실행
```

### Git 정책

- `main`/`master`로 직접 `push --force` 금지
- 모든 push는 작업자 확인 후 진행
- 커밋 메시지 prefix: `feat:` / `fix:` / `refactor:` / `docs:` / `chore:`

---

*최종 수정: 2026-03-09*
*작성자: sein (한국공항공사)*
