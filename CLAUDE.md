# CLAUDE.md - Claude Code 프로젝트 지침서

> 이 파일은 Claude Code가 프로젝트를 효율적으로 진행하기 위한 규칙, 패턴, 자동화 지침을 정의합니다.
> Claude Code는 이 지침을 우선시하여 작업합니다.

---
# Project Guidelines (Next.js on Render)

이 프로젝트는 Render.com에 배포되는 폐쇄형(관리자 전용) Next.js 웹 서비스입니다.

## 1. Tech Stack & Rules
- **Framework**: Next.js (App Router 필수)
- **Styling**: Tailwind CSS (권장)
- **Deployment**: Render.com (Node.js Environment)
- **Database**: PostgreSQL (Prisma 또는 Drizzle 사용 권장)
- **Auth**: NextAuth.js (Admin 전용, 회원가입 없음)

## 2. Next.js Best Practices (Strict)
- **Routing**: `app/` 디렉토리(App Router)만 사용하세요.
- **Components**: 기본적으로 **Server Component**로 작성하고, `useState`, `useEffect`가 꼭 필요한 경우만 파일 최상단에 `'use client'`를 명시하세요.
- **Images**: `<img>` 태그 대신 반드시 `next/image`의 `<Image />` 컴포넌트를 사용하세요.
- **Data Fetching**: 서버 컴포넌트에서 `async/await`로 직접 DB/API를 호출하세요.

## 3. UI/UX & Design Guidelines
- **Layout**: 모바일 우선(Mobile-first)으로 작성하고 `md:`, `lg:` 브레이크포인트를 사용해 확장하세요.
- **Accessibility**: 시맨틱 태그(<main>, <section>, <button>)를 사용하고, ARIA 속성을 준수하세요.
- **Design**: 시각적 위계(Hierarchy)를 명확히 하여 중요한 정보가 눈에 띄게 하세요.

## 4. Commands (AI용 실행 명령어)
- Build: `npm run build`
- Dev Server: `npm run dev`
- Lint: `npm run lint`



## 📋 프로젝트 기본 정보

### 프로젝트 개요
- **프로젝트명**: KATC1 - 항공사 유사호출부호 경고시스템
- **설명**: 항공사 운항 중 발생하는 유사 호출부호 상황을 감지하고 관리하는 시스템
- **레벨**: Dynamic (Next.js + SQLite + TanStack Query)
- **배포**: Vercel (예정)

### 기술 스택
```
Frontend: Next.js 14, TypeScript, Tailwind CSS, Zustand, TanStack Query v5
Backend: Node.js (API Routes), SQLite 3
Auth: JWT (AccessToken + RefreshToken)
Tools: better-sqlite3, bash scripts
```

### 주요 데이터베이스
- **테이블**: users, airlines, callsigns, actions, announcements, file_uploads
- **핵심**: callsigns (156개 유사호출부호 데이터 보유)

---

## 📁 폴더 구조 및 규칙

### 핵심 디렉토리
```
src/
├── app/                    # Next.js App Router
│   ├── (main)/            # 사용자 서비스
│   ├── admin/             # 관리자 서비스
│   ├── api/               # REST API 엔드포인트
│   └── auth/              # 인증 관련
├── components/            # React 컴포넌트
├── hooks/                 # 커스텀 훅 (TanStack Query)
├── lib/                   # 유틸리티 및 설정
├── store/                 # Zustand 상태 관리
├── types/                 # TypeScript 타입 정의
└── scripts/               # 데이터베이스 초기화 스크립트
```

### 명명 규칙
```typescript
// 파일명: kebab-case
// 예: user-approval-table.tsx, useAirlineCallsigns.ts

// 컴포넌트: PascalCase
// 예: export function UserApprovalTable() {}

// 훅: camelCase + 'use' 접두사
// 예: export function useAirlineCallsigns() {}

// 상수: UPPER_SNAKE_CASE
// 예: const MAX_LIMIT = 1000;

// 함수: camelCase
// 예: function calculateRiskLevel() {}
```

---

## 🔄 API 설계 규칙

### REST API 엔드포인트 패턴
```
공개 API:
GET    /api/airlines                     # 항공사 목록
GET    /api/airlines/{id}/callsigns      # 항공사별 유사호출부호
GET    /api/callsigns/stats              # 통계

관리자 API:
GET    /api/admin/users                  # 사용자 목록
POST   /api/admin/users/{id}/approve     # 사용자 승인
GET    /api/admin/airlines               # 항공사 관리

인증 API:
POST   /api/auth/login                   # 로그인
POST   /api/auth/logout                  # 로그아웃
POST   /api/auth/refresh                 # 토큰 갱신
```

### 응답 형식 (통일)
```typescript
// 단일 데이터
{ data: T, success: boolean }

// 목록 데이터
{ data: T[], pagination: { page, limit, total, totalPages } }

// 에러
{ error: string, status: 400|401|403|404|500 }
```

### 쿼리 파라미터 규칙
```
필터: ?riskLevel=매우높음&status=in_progress
페이지: ?page=1&limit=100
정렬: ?sortBy=created_at&order=desc
범위: ?dateFrom=2026-02-01&dateTo=2026-02-25
```

---

## 🔄 Actions 상태 관리 (조치 시스템)

### 핵심 원칙
> **callsigns 최종 상태 = actions과 항상 동기화되어야 함**
> - actions 상태 변경 → callsigns 자동 업데이트
> - 양쪽 상태 불일치는 허용하지 않음

### 국내/외항사 판별 규칙 (필수)
```typescript
// 항공사 테이블(airlines)에 입력된 11개만 국내항공사로 인정
// 그 외는 모두 외항사로 취급
// 국내항공사 (ICAO 3글자 코드) - DB에서 확인한 항공사 테이블의 모든 항공사
const domesticAirlines = new Set(['KAL', 'AAR', 'JJA', 'JNA', 'TWB', 'ABL', 'ASV', 'EOK', 'FGW', 'APZ', 'ESR']);
const isForeignAirline = !domesticAirlines.has(otherAirlineCode);
```

### 상태 변화 흐름

#### 1단계: 등록 (관리페이지)
```
POST /api/admin/callsigns
결과:
  - actions: 신규 생성, status = 'in_progress'
  - callsigns: 신규 생성, status = 'in_progress'
```

#### 2단계: 조치 (항공사 대시보드)
```
POST /api/airlines/:airlineId/actions
결과:
  - actions: 기존 row UPDATE, status = 'completed' (또는 'in_progress')
  - callsigns 상태 = 항공사 조합에 따라 달라짐

완료 조건 매트릭스:
  ┌──────────────────┬────────┬─────────────────────┐
  │ 항공사 조합       │ 주체   │ callsigns 최종상태  │
  ├──────────────────┼────────┼─────────────────────┤
  │ 같은 항공사       │ 아무나 │ completed           │
  │ 국내 ↔ 국내      │ 첫번째 │ in_progress         │
  │ 국내 ↔ 국내      │ 둘째   │ completed (양쪽O)   │
  │ 국내 ↔ 외항사    │ 국내   │ completed           │
  │ 외항사 ↔ 외항사  │ 아무나 │ completed           │
  └──────────────────┴────────┴─────────────────────┘
```

#### 3단계: 취소 (진행 중 항목 취소)
```
PATCH /api/actions/[id] (body: { status: 'in_progress' })
결과:
  - actions: 같은 row UPDATE
    ✅ is_cancelled = 1 (플래그 추가)
    ✅ status = 'in_progress' (상태 되돌림)
  - callsigns: 상태 = 'in_progress'
  - 조치목록: is_cancelled=0인 것만 표시 (필터링)
```

#### 4단계: 재조치 (취소된 항목 다시 조치)
```
POST /api/airlines/:airlineId/actions
결과:
  - actions: 기존 취소 row UPDATE (is_cancelled=0, status 업데이트)
  - 새로운 행 추가 불필요 (같은 row 재사용)
  - callsigns: 완료 조건 재계산 및 상태 업데이트
```

### 구현 체크리스트
```
✅ 국내/외항사 판별 로직 (domesticAirlines Set)
✅ 조치 시 callsigns 상태 동기화
✅ 취소 기능 (is_cancelled 플래그)
✅ 조치목록 필터링 (COALESCE(is_cancelled, 0) = 0)
⏳ 재조치 시 기존 취소 row UPDATE (구현 필요시)
```

### 주의사항 ⚠️
```
❌ 절대 금지: callsigns와 actions 상태 불일치
❌ 절대 금지: is_cancelled=1 행을 물리 삭제
❌ 절대 금지: 국내/외항사 판별 규칙 무시

✅ 필수: 모든 상태 변경 후 양쪽 동기화 확인
✅ 필수: 트랜잭션으로 actions + callsigns 함께 업데이트
```

---

## 🛠️ 서브에이전트 활용 규칙

### 자동 호출 조건
아래 상황에서 Claude Code는 **자동으로 서브에이전트를 활용**합니다:

#### 1️⃣ **코드 구현 완료 후** (자동 실행)
```
조건: 새 기능 구현 또는 버그 수정 완료
액션:
  - 자동으로 gap-detector 실행 → 설계-구현 일치도 확인
  - 일치도 < 90% → pdca-iterator 자동 실행 → 개선
```

#### 2️⃣ **API 구현 완료 후** (자동 실행)
```
조건: POST/PATCH/DELETE 엔드포인트 구현
액션:
  - 자동으로 security-architect 실행 → 보안 검증
  - XSS, CSRF, SQL Injection 등 취약점 확인
```

#### 3️⃣ **데이터베이스 스키마 변경 후** (자동 실행)
```
조건: SQL 마이그레이션 또는 스키마 수정
액션:
  - 자동으로 API 쿼리 일관성 검증
  - 컬럼 존재 여부 확인
```

#### 4️⃣ **성능 최적화 필요** (수동 호출)
```
명령어: "성능 분석해줘" 또는 "/analyze"
에이전트: enterprise-expert
액션: 병목 구간 분석, 캐싱 전략 제안
```

#### 5️⃣ **배포 전 최종 검증** (수동 호출)
```
명령어: "배포 준비 확인해줘"
에이전트:
  - code-analyzer (코드 품질)
  - security-architect (보안)
  - qa-strategist (테스트)
```

---

### 커스텀 서브에이전트

#### 🛫 **airline 에이전트** (사용자 서비스 개발)
**목적**: Airline 페이지 및 관련 컴포넌트 개발 담당

**자동 호출 시점**:
```
조건: src/app/(main)/airline/ 또는 src/components/airline/ 파일 수정
예시:
  - src/app/(main)/airline/page.tsx 수정
  - src/components/airline/AirlineStatisticsTab.tsx 수정
  - src/hooks/useAirlineCallsigns.ts 수정
```

**주요 책임**:
- Airline 페이지 UI/UX 개발
- 유사호출부호 데이터 표시 로직
- 통계 및 분석 차트 구현
- TanStack Query 훅 작성
- 필터링 및 페이지네이션 기능

**보유 권한**:
```
도구: Read, Write, Edit, Glob, Grep, Bash
접근 범위: src/app/(main)/airline/**, src/components/airline/**, src/hooks/**
제한사항: admin 페이지 수정 불가
```

**명령어 예시**:
```
"airline 페이지 개발해줘"
"항공사별 통계 차트 만들어줘"
"호출부호 필터링 기능 추가해줘"
```

---

#### ✅ **airline-validator 에이전트** (항공사 페이지 자동 검증)
**목적**: Airline 페이지 수정 후 모든 기능을 자동 검증 (로그 기반)

**자동 호출 시점**:
```
조건: src/app/(main)/airline/ 또는 src/components/airline/ 파일 수정 후
     코드 구현 완료 시 자동 실행
예시:
  - src/app/(main)/airline/page.tsx 수정
  - src/components/airline/IncidentFilters.tsx 수정
  - src/hooks/useAirlineCallsigns.ts 수정
  - src/hooks/useActions.ts 수정
```

**검증 프로세스**:
```
1. 로그 수집 (도구: qa-monitor)
   └─ Docker/브라우저 콘솔 로그 캡처

2. 데이터 흐름 검증
   ├─ API 요청 → API 응답 일치도
   ├─ DB 쿼리 결과 → UI 표시 데이터 비교
   ├─ 필터 입력값 → DB WHERE 절 → UI 결과 비교
   └─ 정렬/페이지네이션 로그 검증

3. 기능별 검증
   ├─ 조치대상 목록 로딩
   ├─ 필터 적용 (상태, 위험도, 날짜 범위)
   ├─ 정렬 기능
   ├─ 페이지네이션
   ├─ 검색 기능
   └─ 조치 등록/수정 후 목록 갱신

4. 결과 판정
   └─ Pass/Fail 판정 및 리포트 작성
```

**검증 항목** (12개):
```
✅ 1. 항공사 정보 로딩 (user.airline 데이터)
✅ 2. 조치대상 목록 초기 로딩 (API → DB 쿼리 → UI)
✅ 3. DB SELECT 결과 vs UI 표시 데이터 비교 (행 수, 컬럼값)
✅ 4. 상태 필터 적용 (in_progress/completed)
✅ 5. 위험도 필터 적용 (매우높음/높음/중간/낮음)
✅ 6. 날짜 범위 필터 (from ~ to)
✅ 7. 필터 조합 적용 (상태 + 위험도 + 날짜)
✅ 8. 정렬 기능 (created_at, updated_at, risk_level)
✅ 9. 페이지네이션 (page, limit, total 일치)
✅ 10. 조치 등록 후 목록 갱신
✅ 11. 조치 수정 후 목록 갱신
✅ 12. 에러 처리 (401, 404, 500 응답 처리)
```

**로그 비교 예시**:
```
입력 (사용자 액션):
  [AirlinePage] 필터 적용: { status: 'completed', riskLevel: '높음' }

처리 (API 로직):
  [API] GET /api/airlines/abc123/callsigns?status=completed&riskLevel=높음
  [Database] SELECT * FROM callsigns WHERE status=? AND risk_level=? (params: ['completed', '높음'])
  [Database] Result: 5 rows

UI 표시:
  [UI] 조치대상 목록 렌더링: 5개 행 표시

검증:
  ✅ DB 쿼리 (SELECT) → UI 행 수 (5) 일치
  ✅ 모든 행의 status = 'completed' (필터 검증)
  ✅ 모든 행의 risk_level = '높음' (필터 검증)
```

**테스트 데이터셋**:
```
목업 항공사 ID: [제주항공/아시아나/대한항공 등에서 선택]

테스트 케이스:
├─ 전체 목록 조회 (필터 없음)
├─ 상태별 필터 (in_progress, completed)
├─ 위험도별 필터 (매우높음, 높음, 중간, 낮음)
├─ 날짜 범위 (최근 7일, 최근 30일, 전체)
├─ 정렬 (생성일순, 수정일순, 위험도순)
└─ 페이지네이션 (limit=10, 20, 50)
```

**검증 결과 리포트**:
```typescript
{
  timestamp: "2026-03-02T10:30:00Z",
  success: true,          // 모든 검증 통과 여부
  summary: {
    totalTests: 12,
    passedTests: 12,
    failedTests: 0,
    passRate: "100%"
  },
  results: [
    {
      testName: "조치대상 목록 초기 로딩",
      status: "✅ PASS",
      details: {
        dbRowCount: 45,
        uiRowCount: 45,
        match: true
      }
    },
    {
      testName: "상태 필터 (in_progress)",
      status: "✅ PASS",
      details: {
        filterApplied: "status = 'in_progress'",
        expectedRows: 28,
        actualRows: 28,
        match: true
      }
    },
    // ... 더 많은 결과
  ],
  logComparison: {
    apiRequest: "GET /api/airlines/abc123/callsigns?status=completed",
    dbQuery: "SELECT * FROM callsigns WHERE airline_id=? AND status=?",
    dbResult: 12,
    uiDisplay: 12,
    match: true
  },
  recommendation: "✅ 모든 기능이 정상 작동합니다. 추가 검증 준비 완료!"
}
```

**보유 권한**:
```
도구: Read, Write, Edit, Glob, Grep, Bash, Task(qa-monitor)
접근 범위: src/app/(main)/airline/**, src/components/airline/**, src/hooks/**, data/katc1.db
제한사항: 코드 수정 불가 (검증만 수행), admin 페이지 검증 불가
```

**명령어 예시**:
```
"airline 페이지 검증해줘"
"필터 기능 자동 검증 실행"
"조치대상 목록 데이터 흐름 검증"
```

---

#### 👨‍💼 **admin 에이전트** (관리자 서비스 개발)
**목적**: Admin 페이지 및 관리자 기능 개발 담당

**자동 호출 시점**:
```
조건: src/app/admin/ 파일 수정
예시:
  - src/app/admin/page.tsx 수정
  - src/app/admin/users/page.tsx 수정
  - src/app/admin/airlines/page.tsx 수정
  - src/components/admin/** 수정
```

**주요 책임**:
- 관리자 대시보드 개발
- 사용자 관리 기능 (승인, 거부, 삭제)
- 항공사 관리 (생성, 수정, 삭제, 순서 변경)
- 조치 이력 관리
- 공지사항 관리
- 파일 업로드 관리

**보유 권한**:
```
도구: Read, Write, Edit, Glob, Grep, Bash
접근 범위: src/app/admin/**, src/components/admin/**, src/app/api/admin/**
제한사항: airline 페이지 수정 불가, 인증 시스템 수정 불가
```

**명령어 예시**:
```
"관리자 대시보드 개발해줘"
"사용자 승인 기능 만들어줘"
"항공사 관리 페이지 개발해줘"
```

---

#### 🧪 **actions-test 에이전트** (조치 기능 자동 테스트)
**목적**: 조치(Actions) 기능 등록/수정/취소 자동 테스트 및 검증

**자동 호출 시점**:
```
조건: 아래 파일 수정 시 자동 실행
예시:
  - src/app/api/airlines/[airlineId]/actions/route.ts 수정
  - src/app/api/actions/[id] 수정
  - src/hooks/useActions.ts 수정
  - src/components/actions/ActionModal.tsx 수정
```

**주요 책임**:
- 조치 등록 테스트 (POST /api/airlines/:airlineId/actions)
- 조치 수정/상태 변경 테스트 (PATCH /api/actions/:id)
- 조치 취소 테스트 (is_cancelled 플래그)
- 상태 동기화 검증 (actions ↔ callsigns)
- 국내/외항사 판별 로직 검증
- 데이터베이스 상태 확인 (SQLite)

**검증 항목**:
```
✅ 1. 조치 등록 (같은 항공사 + 국내↔국내 + 국내↔외항사)
✅ 2. 조치 상태 변경 (completed, in_progress)
✅ 3. 취소 기능 (is_cancelled=1, status 되돌림)
✅ 4. 재조치 (취소 후 다시 조치)
✅ 5. callsigns 최종 상태 동기화 확인
✅ 6. 토큰/인증 검증
✅ 7. 입력값 검증 (빈 값, 잘못된 ID)
✅ 8. 데이터베이스 무결성 확인
```

**테스트 결과 리포트**:
```
테스트 케이스별 Pass/Fail 상태
├─ ✅/❌ 조치 등록 (같은 항공사)
├─ ✅/❌ 조치 등록 (국내↔국내)
├─ ✅/❌ 조치 등록 (국내↔외항사)
├─ ✅/❌ 상태 동기화
├─ ✅/❌ 취소 및 재조치
└─ 📊 DB 최종 상태 (SQL 쿼리 결과)
```

**출력 형식**:
```typescript
{
  success: boolean,
  results: [
    { testCase: "조치 등록 (같은 항공사)", passed: true, details: "..." },
    { testCase: "상태 동기화", passed: false, error: "..." }
  ],
  dbState: {
    totalActions: 123,
    completedActions: 45,
    inProgressActions: 78
  }
}
```

**보유 권한**:
```
도구: Read, Write, Edit, Glob, Grep, Bash
접근 범위: src/app/api/airlines/, src/app/api/actions/, src/hooks/useActions.ts, src/components/actions/**, data/katc1.db
제한사항: 인증 시스템 수정 불가, 다른 기능 API 수정 불가
```

**명령어 예시**:
```
"조치 등록 기능 테스트해줘"
"조치 수정 및 취소 검증해줘"
"조치 시스템 통합 테스트 실행해줘"
```

---

#### 🐘 **pgsql-migrator 에이전트** (SQLite → PostgreSQL 마이그레이션)
**목적**: SQLite 기반 코드를 PostgreSQL로 완전 마이그레이션하고, 모든 쿼리/설정/의존성을 정확하게 수정하는 시니어 개발자

**자동 호출 시점**:
```
조건: 아래 파일 수정 또는 pgsql 마이그레이션 관련 작업 시 자동 실행
예시:
  - scripts/init.sql 또는 스키마 파일 수정
  - src/lib/db.ts 또는 데이터베이스 연결 모듈 수정
  - package.json에서 better-sqlite3 제거 / pg 추가 시
  - "pgsql 마이그레이션", "postgres 전환" 요청 시
```

**주요 책임**:
- SQLite 전용 문법 → PostgreSQL 문법으로 변환
  - `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY` 또는 `BIGSERIAL`
  - `?` 플레이스홀더 → `$1, $2, $3` 플레이스홀더
  - `DATETIME('now')` → `NOW()`
  - `COALESCE` 호환성 확인
  - `TEXT` / `BLOB` 타입 매핑
  - `PRAGMA` 구문 제거
  - `RETURNING` 절 활용 (INSERT 후 ID 반환)
- `better-sqlite3` → `pg` (node-postgres) 또는 `@vercel/postgres` 전환
- 동기식 SQLite API → 비동기식 Promise/async-await로 전환
- 트랜잭션 방식 변환 (`BEGIN/COMMIT` → `pg` 트랜잭션 패턴)
- 연결 풀(Connection Pool) 설정 (`pg.Pool`)
- `.env` 환경 변수 업데이트 (`DATABASE_URL` 형식)
- `scripts/init.sql` PostgreSQL 호환 스키마로 재작성
- 전체 `src/app/api/**` 쿼리 소스 일괄 검토 및 수정

**마이그레이션 체크리스트**:
```
[ ] 1. 패키지 교체: better-sqlite3 제거, pg/postgres 설치
[ ] 2. DB 연결 모듈 재작성 (src/lib/db.ts)
[ ] 3. 플레이스홀더 전환: ? → $1, $2, $3 (모든 쿼리 파일)
[ ] 4. 동기 API → async/await 전환 (db.prepare().all() → pool.query())
[ ] 5. AUTO_INCREMENT → SERIAL (스키마 파일)
[ ] 6. DATETIME/TIMESTAMP 타입 정합성 확인
[ ] 7. BOOLEAN 타입: SQLite 0/1 정수 → PostgreSQL true/false
[ ] 8. PRAGMA 구문 전체 제거 (foreign_keys, journal_mode 등)
[ ] 9. 트랜잭션 패턴 변환 (BEGIN/COMMIT → client.query 방식)
[ ] 10. RETURNING 절 활용 (INSERT 후 id 반환)
[ ] 11. 환경 변수: DATABASE_URL 설정 (.env.local, .env.example)
[ ] 12. Render.com / Vercel Postgres 연결 문자열 설정
[ ] 13. 전체 빌드 확인: npm run build
[ ] 14. API 쿼리 결과 타입 재정의 (rows[0] 패턴)
```

**SQLite → PostgreSQL 변환 예시**:
```typescript
// ❌ SQLite (before)
import Database from 'better-sqlite3';
const db = new Database('data/katc1.db');
const rows = db.prepare('SELECT * FROM users WHERE id = ?').all(id);

// ✅ PostgreSQL (after)
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
```

```sql
-- ❌ SQLite 스키마
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT (DATETIME('now'))
);

-- ✅ PostgreSQL 스키마
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**검증 프로세스**:
```
1. 전체 src/app/api/** 파일 스캔 → SQLite 패턴 잔존 여부 확인
2. 쿼리 플레이스홀더 전수 검사 (? 잔존 없는지)
3. 동기 API 잔존 여부 검사 (.prepare, .all, .get, .run)
4. npm run build 성공 여부 확인
5. 결과 리포트 출력
```

**보유 권한**:
```
도구: Read, Write, Edit, Glob, Grep, Bash
접근 범위: src/lib/db.ts, src/app/api/**, scripts/**, package.json, .env.example
제한사항: 인증 토큰 로직 변경 불가, UI 컴포넌트 수정 불가
```

**명령어 예시**:
```
"pgsql 마이그레이션 해줘"
"sqlite를 postgres로 전환해줘"
"db 연결 모듈 pgsql로 바꿔줘"
"쿼리 소스 전체 pgsql 문법으로 수정해줘"
```

---

### 에이전트 선택 기준

| 상황 | 할당 에이전트 |
|------|--------------|
| Airline 페이지 개발 | 🛫 airline |
| Airline 페이지 검증 | **✅ airline-validator** (자동 검증) |
| Admin 페이지 수정 | 👨‍💼 admin |
| **Actions API 수정** | **🧪 actions-test** (자동 테스트) |
| **SQLite → PostgreSQL 마이그레이션** | **🐘 pgsql-migrator** (자동 실행) |
| **쿼리 문법 pgsql 전환** | **🐘 pgsql-migrator** (자동 실행) |
| API 엔드포인트 수정 | security-architect (보안 검증) |
| 인증 시스템 수정 | 직접 처리 (에이전트 미배정) |
| 데이터베이스 스키마 | 🐘 pgsql-migrator (마이그레이션 시) |
| 코드 품질 검증 | code-analyzer |
| Gap 분석 | gap-detector |

---

## 📝 코드 스타일 및 주의사항

### TypeScript
```typescript
// ✅ 필수: 타입 정의
interface UserApprovalProps {
  userId: string;
  adminId: string;
  status: 'pending' | 'approved' | 'rejected';
}

// ❌ 금지: any 타입 사용
const data: any = response.data;  // 사용 금지!

// ✅ 권장: 명시적 타입
const data: Callsign[] = response.data;
```

### 주석 규칙
```typescript
// ✅ 필수: 복잡한 로직 설명
/**
 * callsigns 테이블에서 in_progress 상태의 데이터만 조회
 * - riskLevel 필터 적용 가능
 * - 페이지네이션 지원 (최대 1000개)
 */

// ✅ 중요: 조치사항 표시
// 📌 IMPORTANT: 이 값은 환경 변수에서 반드시 설정해야 합니다
// 🔴 CRITICAL: 토큰 만료 시 자동으로 갱신됩니다

// ❌ 불필요: 자명한 코드 주석은 생략
const count = items.length;  // 아이템 개수 (불필요)
```

### 금지 사항 ⛔
```typescript
// ❌ 1. force-push 또는 destructive git 명령
git push --force
git reset --hard

// ❌ 2. 환경 변수 하드코딩
const API_KEY = "sk-12345...";  // 절대 금지!

// ❌ 3. console.log 남기기
console.log("DEBUG:", data);  // 제거 필수

// ❌ 4. 주석 처리된 코드 커밋
// const oldFunction = () => {};  // 삭제 필수

// ❌ 5. 타입 검증 생략
if (data === undefined) {  // ❌ undefined 체크 누락
  // ...
}
```

### 권장 사항 ✅
```typescript
// ✅ 1. 에러 처리는 명시적으로
try {
  const result = await query(sql, params);
} catch (error) {
  console.error('[Database] Query error:', error);
  return NextResponse.json({ error: '...' }, { status: 500 });
}

// ✅ 2. 로그는 구조화된 형식으로
console.log('[COMPONENT_NAME] Action description:', { key: value });

// ✅ 3. API 응답은 항상 검증
if (!response.ok) {
  throw new Error(`API error: ${response.status}`);
}
```

---

## 🔐 보안 규칙

### 인증 & 인가
```typescript
// ✅ 모든 API는 토큰 검증 필수
const token = request.headers.get('Authorization')?.substring(7);
const payload = verifyToken(token);

if (!payload) {
  return NextResponse.json(
    { error: '인증이 필요합니다.' },
    { status: 401 }
  );
}

// ✅ 역할 기반 접근 제어 (RBAC)
if (payload.role !== 'admin') {
  return NextResponse.json(
    { error: '권한이 없습니다.' },
    { status: 403 }
  );
}
```

### 데이터 검증
```typescript
// ✅ 입력값 검증 필수
if (!email || !email.includes('@')) {
  return NextResponse.json({ error: '유효한 이메일이 아닙니다.' }, { status: 400 });
}

// ✅ SQL Injection 방지 (파라미터화 쿼리)
const result = await query(
  'SELECT * FROM users WHERE email = $1',  // ✅ $1 사용
  [email]                                   // ✅ 파라미터 분리
);

// ❌ SQL Injection (절대 금지!)
const result = await query(
  `SELECT * FROM users WHERE email = '${email}'`  // 위험!
);
```

---

## 🔄 개발 워크플로우

### 📌 Git Push 정책 (필수)
> **모든 push는 사용자 명시적 승인 필수**
> - 자동 push 절대 금지
> - 코드 수정 완료 후 → 마지막에 "push 할지" 묻기
> - 사용자 승인 후에만 git push 실행

### 1단계: 작업 시작
```bash
# 새 브랜치 생성 (선택사항)
git checkout -b feature/description

# 작업 시작 전 상태 확인
git status
```

### 2단계: 구현 진행
```
- 코드 작성
- 테스트 실행 (필요시)
- 주석 추가
```

### 3단계: 커밋 (중요!)
```bash
# 파일 스테이징
git add [files]

# 의미 있는 메시지로 커밋
git commit -m "feat: 설명 또는 fix: 버그 설명"

# 커밋 메시지 형식 (필수)
# feat: 새 기능 추가
# fix: 버그 수정
# refactor: 코드 개선
# docs: 문서 수정
# chore: 설정/빌드 변경
```

### 4단계: 검증 (자동 실행)
```
- gap-detector: 설계-구현 일치도 확인 (자동)
- code-analyzer: 코드 품질 검증 (자동)
- security-architect: 보안 검증 (자동)
```

### 5단계: Push 확인 (사용자 승인 필수) ⭐
```
코드 수정 완료 후:
1. Claude Code가 변경사항 요약 제시
2. "문제가 없으면 push 할까요?" 물어보기
3. 사용자 승인 대기
```

### 6단계: Push 실행 (승인 후)
```bash
# 사용자 승인 후에만 실행
git push origin [branch]
# 또는 master 브랜치로
git push origin master
```

---

## 🚀 배포 전 체크리스트

배포 전 반드시 확인할 항목:

```
[ ] 모든 TypeScript 에러 제거 (npm run build)
[ ] 환경 변수 설정 (.env.local)
[ ] 데이터베이스 마이그레이션 완료
[ ] 보안 헤더 설정 확인 (HSTS, CSP, X-Frame-Options)
[ ] API 토큰 검증 확인
[ ] SQL Injection 방지 확인 (파라미터화 쿼리)
[ ] 에러 처리 로직 확인
[ ] 로그 출력 제거 (console.log 등)
[ ] 주석 처리된 코드 삭제
[ ] git push 완료
```

---

## 📞 특수 명령어

### Claude Code에 직접 지시하는 방법

```
"gap 분석해줘"
  → gap-detector 자동 실행 (설계-구현 비교)

"보안 검토해줘"
  → security-architect 자동 실행

"코드 품질 확인해줘"
  → code-analyzer 자동 실행

"성능 분석해줘"
  → enterprise-expert 자동 실행

"배포 준비 확인"
  → qa-strategist + code-analyzer 순차 실행

"/pdca status"
  → 현재 PDCA 단계 확인

"/pdca iterate"
  → 자동 개선 반복 (최대 5회)
```

---

## 🔗 주요 파일 및 경로

```
설정 파일:
- .env.local                          # 환경 변수
- next.config.js                      # Next.js 설정
- tsconfig.json                       # TypeScript 설정

데이터베이스:
- scripts/init.sql                    # DB 초기화 스크립트
- docker-compose.yml                  # Docker 설정

핵심 API:
- src/app/api/auth/login/route.ts    # 로그인
- src/app/api/airlines/[id]/callsigns/route.ts  # 유사호출부호 조회

상태 관리:
- src/store/authStore.ts              # 인증 상태
- src/hooks/useAirlineCallsigns.ts    # 데이터 조회 훅
```

---

## 📊 최근 개선 사항 (2026-03-01)

| 날짜 | 항목 | 상태 |
|------|------|------|
| 2026-02-24 | DB 스키마 불일치 수정 | ✅ |
| 2026-02-25 | API limit 100→1000 상향 | ✅ |
| 2026-02-25 | 156개 전체 데이터 조회 가능 | ✅ |
| 2026-03-01 | 통계 차트 2종 추가 (관리자 대시보드) | ✅ |
| 2026-03-01 | Actions 상태 관리 로직 명확화 | ✅ |

---

## 💡 주의사항

> **최우선 원칙**: 이 CLAUDE.md의 규칙을 따르면, Claude Code는 더 효율적이고 안전하게 작업합니다.
> 규칙에 충돌하는 사항이 있으면 이 파일의 지침을 우선합니다.

> **자동화 활성화**: 서브에이전트는 조건을 만족하면 사용자 명령 없이 자동으로 실행됩니다.
> 불필요한 경우 "자동화 비활성화"로 요청하세요.

---

**최종 수정**: 2026-03-02 (airline-validator 에이전트 추가)
**관리자**: sein
