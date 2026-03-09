# DB 쿼리/런타임 전환 로드맵 & 테스트 전략

> 대상: `src/lib/db/queries/*.ts`, App Router API 경로 (`src/app/api/**`), React Query 훅  
> 목적: SQLite 의존 SQL/런타임을 Supabase PostgreSQL + Supabase JS 구조로 안정적으로 이전

---

## 1. 쿼리 자산 분류

| 범주 | 파일/위치 | 현재 상태 | 전환 방향 |
|------|-----------|-----------|-----------|
| 서버 API (Next) | `src/lib/db/queries/{auth,users,airlines,callsigns,actions,announcements,file-uploads}.ts` | `?` 플레이스홀더, `CURRENT_TIMESTAMP`, SQLite 전용 함수 소수 존재 | Provider 레이어(placeholders 변환) 활용 가능 → SQL은 유지하되 TIMESTAMP/BOOLEAN 표현만 점검 |
| 프런트 훅 (React Query) | `src/hooks/useActions.ts`, `useAirlines.ts`, `useAnnouncements.ts` | 이미 `supabaseClient` 직접 사용 | Supabase Auth/Row Level Security 결정에 따라 권한 조정, 호출 패턴 고도화 |
| 로컬 스크립트 | `scripts/init.sql` | PostgreSQL 기준 설계 | Supabase 인스턴스에 맞춰 `pgcrypto`, `uuid-ossp` 등 확장 확인 필요 |

※ `src/lib/db/providers/postgresql/index.ts`의 `convertPlaceholders()` 덕분에 `?` → `$1` 변환은 자동 (레거시 SQL 수정 최소화 가능).

---

## 2. 변경 단계

### 2.1 SQL 검토
1. **타임스탬프**: `CURRENT_TIMESTAMP`, `NOW()` 모두 PostgreSQL 호환 → 현행 유지.
2. **Boolean**: SQLite에서 `0/1`로 사용했던 컬럼(`users.is_default_password`, `actions.is_cancelled`)은 Postgres에서도 BOOLEAN으로 선언되어 있어 문제 없음. 단, API 응답에서 `!!row.flag` 처리 확인.
3. **AUTOINCREMENT**: 모든 테이블이 `UUID DEFAULT gen_random_uuid()` 구조 → Postgres 친화적.
4. **전용 함수**: `datetime('now', '-90 days')` 등의 SQLite 함수 사용 여부를 전수 검색(`rg "datetime\\(" src/app -n`). 발견 시 `NOW() - INTERVAL '90 days'`로 변경 리스트 작성.

### 2.2 트랜잭션 / 연결
1. `src/lib/db/index.ts`는 Provider 패턴 완성 → `DB_PROVIDER=postgresql`일 때 자동으로 `PostgreSQLProvider` 사용.
2. 트랜잭션 헬퍼(`transaction(callback)`)가 존재 → API 코드가 동기 SQLite에 맞춰 작성된 부분(동기 콜백)을 `async`/`await`로 감싸는지 확인.
3. 커넥션 풀 종료는 `closePool()`로 일괄 통제 → dev server hot reload 시 누수 여부 모니터링.

### 2.3 프런트엔드 전용화 전략
| 기능 | 현재 | 목표 |
|------|------|------|
| 호출부호 목록 | Supabase JS (완료) | Supabase Auth 연동 시 RLS 정책 작성 |
| 공지사항 | Supabase JS (useAnnouncements) | 읽기/쓰기 권한 정책 + Edge Function 필요 여부 검토 |
| 조치 등록/수정 | Next API + SQL | 단기: Next API 유지(Postgres 연결) / 장기: Supabase Function 또는 RPC |
| 인증 | 커스텀 JWT | Supabase Auth 로드맵 별도 작성 (본 문서 범위 밖, 단 연계 필요) |

---

## 3. 테스트 전략

| 레벨 | 도구/방법 | 커버 범위 | 체크 포인트 |
|------|-----------|-----------|-------------|
| SQL 단위 | Supabase SQL Editor / `psql` | 각 `SELECT/INSERT/UPDATE` | 플레이스홀더 매핑, FK 에러 |
| API 통합 | `npm run dev` + Thunder Client/HTTPie | 주요 API 31개 | 응답 포맷, 트랜잭션 성공, 오류 처리 |
| 프런트 수동 | 브라우저 (admin + airline) | CRUD/필터 · React Query | Supabase 데이터 즉시 반영, 캐싱 |
| 인증/권한 | Postman + Supabase Auth session | 로그인/토큰 | JWT → Supabase Auth 공존 기간 시나리오 |

Smoke 테스트 시나리오 초안:
1. 관리자 로그인 → 조치 등록 → Supabase DB에서 INSERT 확인.
2. 항공사 계정으로 조치 상태 변경 → DB `actions`/`callsigns` 두 테이블 모두 갱신 확인.
3. 공지 생성 → `useAnnouncements` 훅으로 즉시 읽힘 확인.

---

## 4. 위험 및 완화

| 위험 | 설명 | 완화책 |
|------|------|--------|
| 대량 INSERT 성능 | Supabase 호스트에서 400건 호출부호 삽입 시 타임아웃 가능 | CSV 업로드 대신 `docs/migration_step2_data.sql`을 Supabase SQL Editor에서 일괄 실행, 필요 시 `COPY` |
| Supabase Auth 도입 시 FK 충돌 | 기존 `users` 테이블과 Supabase Auth `auth.users` 관계 설계 필요 | Auth 전환 단계에서 매핑 테이블/Trigger 설계 |
| start.sh 비대화형 실행 | CI나 자동화에서 입력 필요 | `SUPABASE_MODE=1` 등 환경변수로 비대화형 옵션 추가 예정 |

---

## 5. 다음 액션

1. `rg "datetime('" src -n` 실행해 SQLite 전용 함수 목록화 (T1).
2. API 라우트별 의존 쿼리 표 작성 (T2) → 문제 쿼리 우선 수정.
3. Supabase smoke 테스트 체크리스트 작성 (T3) → QA 문서화.
4. start.sh 개선 구현 및 README 업데이트 (T4).
