# 계획서: DB Provider 분리 (SQLite → PostgreSQL 지원)

**문서 ID**: PLAN-001
**작성일**: 2026-02-28
**상태**: Completed (2026-03-09 마이그레이션 완료)
**버전**: 1.0

---

## 📋 요구사항 정의

### 문제 배경
- **현황**: 유사호출부호 공유시스템 프로젝트는 SQLite를 사용하여 로컬에서는 정상 작동
- **문제점**: Render 배포 시 SQLite의 ephemeral 파일시스템으로 인해 데이터가 재배포 시마다 초기화됨
- **영향**: 프로덕션 환경에서 데이터 손실 위험, 배포 불가

### 목표
```
✅ SQLite와 PostgreSQL을 모두 지원하는 구조 구현
✅ Provider Pattern으로 깔끔하게 분리
✅ 기존 API 코드 수정 없음 (투명성 유지)
✅ 로컬: SQLite (기존) 또는 Docker PostgreSQL 선택 가능
✅ 배포: Render PostgreSQL 지원
```

### 성공 기준
| 기준 | 확인 |
|------|------|
| 기존 API Routes 수정 없음 | 31개 API 모두 호환 |
| SQL 쿼리 수정 없음 | ? 플레이스홀더 자동 변환 |
| 로컬 개발 가능 | SQLite + Docker PostgreSQL 동시 지원 |
| 배포 가능 | Render PostgreSQL 연결 성공 |
| 코드 품질 | TypeScript 빌드 에러 없음 |
| 성능 | 응답시간 유사 수준 유지 |

---

## 🎯 범위 정의

### 포함 (In-Scope)
```
✅ Provider Pattern 아키텍처 설계
✅ DatabaseProvider 인터페이스 정의
✅ SQLiteProvider 구현 (기존 코드 이동)
✅ PostgreSQLProvider 신규 구현
✅ Factory 패턴으로 Provider 선택
✅ Docker Compose 설정
✅ 환경변수 표준화 (.env.example)
✅ 패키지 관리 (pg 라이브러리 추가)
✅ 문서화 (설계서, 구현 명세)
```

### 제외 (Out-of-Scope)
```
❌ 데이터 마이그레이션 도구 (별도 프로젝트)
❌ 성능 튜닝 (인덱스는 포함)
❌ 모니터링 시스템 (Render 기본 제공)
❌ 백업/복구 전략 (Render 관리)
❌ 다른 DB 지원 (MongoDB 등은 추후)
```

---

## 📊 현황 분석

### 현재 아키텍처

```
src/lib/db/
├── index.ts           ← SQLite 하드코딩
├── sqlite.ts          ← better-sqlite3
├── sqlite-schema.ts   ← SQLite 스키마
└── queries/           ← ? 플레이스홀더
    ├── auth.ts
    ├── users.ts
    ├── airlines.ts
    ├── callsigns.ts
    ├── actions.ts
    ├── announcements.ts
    └── file-uploads.ts
```

**문제점**:
- index.ts에서 SQLite 로직이 직접 포함
- PostgreSQL 지원 시 조건문으로 분기 필요 (유지보수 어려움)
- Provider 간 인터페이스 표준화 부재

### 기술 스택

| 항목 | 현재 | 변경후 |
|------|------|--------|
| **로컬 DB** | SQLite (better-sqlite3) | SQLite (유지) |
| **배포 DB** | SQLite (문제 있음) | PostgreSQL (Render) |
| **패키지** | better-sqlite3만 | better-sqlite3 + pg |
| **드라이버** | 단일 | Provider Pattern (다중) |
| **SQL 호환성** | ? 플레이스홀더 | 자동 변환 (투명) |

---

## 🏗️ 솔루션 개요

### 아키텍처 원칙

1. **Provider Pattern**
   - 각 DB 구현체가 DatabaseProvider 인터페이스 구현
   - 새로운 DB 추가 용이 (MongoDB, Supabase 등)

2. **투명한 전환**
   - API Routes 수정 없음
   - SQL 파일 수정 없음 (자동 플레이스홀더 변환)
   - 기존 호환성 100% 유지

3. **싱글톤 Factory**
   - 조건 분기는 최초 1회만 실행
   - 이후 호출은 캐시된 Provider 재사용

4. **환경 기반 선택**
   ```env
   로컬 개발:    DB_PROVIDER=sqlite
   Docker 테스트: DB_PROVIDER=postgresql
   배포:         DB_PROVIDER=postgresql (Render)
   ```

---

## 📈 구현 로드맵

### Phase 1: 설계 (Plan + Design) ✅
**목표**: 아키텍처 정의 및 상세 설계

**산출물**:
- [x] 계획서 (이 문서)
- [x] 아키텍처 설계서
- [x] 구현 명세서
- [x] PostgreSQL 스키마 계획

**예상 기간**: 1일

---

### Phase 2: 구현 (Do) 📅
**목표**: 설계를 바탕으로 소스코드 작성

**작업 항목**:
1. DatabaseProvider 인터페이스 생성
2. SQLiteProvider 분리 (기존 코드 이동)
3. PostgreSQLProvider 신규 구현
4. Factory 패턴 적용
5. Docker Compose 작성
6. 패키지 설치 및 설정
7. 기본 테스트

**예상 기간**: 2-3일
**담당**: Claude Code

---

### Phase 3: 검증 (Check) 📅
**목표**: 설계-구현 일치도 검증 및 품질 확인

**검증 항목**:
- [ ] Gap Analysis (설계 vs 구현)
- [ ] 코드 품질 검토
- [ ] 보안 검토
- [ ] 테스트 실행
  - [ ] 로컬 SQLite 테스트
  - [ ] 로컬 PostgreSQL 테스트 (Docker)
  - [ ] API 엔드포인트 검증
  - [ ] 트랜잭션 테스트

**도구**: gap-detector, code-analyzer, security-architect

**예상 기간**: 1일

---

### Phase 4: 개선 (Act) 📅
**목표**: 검증 결과 개선 및 최종 정리

**개선 항목**:
- 발견된 이슈 수정
- 성능 최적화
- 문서 업데이트
- 커밋 및 PR

**예상 기간**: 1-2일

---

## 🔍 상세 계획

### 작업 분해 (WBS)

#### 1. 인터페이스 정의
```
1.1 DatabaseProvider 인터페이스 작성
    ├─ query() 메서드
    ├─ transaction() 메서드
    └─ closePool() 메서드
1.2 QueryResult 인터페이스 정의
```

#### 2. SQLiteProvider 분리
```
2.1 기존 sqlite.ts → providers/sqlite/index.ts로 이동
2.2 기존 sqlite-schema.ts → providers/sqlite/schema.ts로 이동
2.3 DatabaseProvider 인터페이스 구현
2.4 클래스화 (SQLiteProvider)
```

#### 3. PostgreSQLProvider 구현
```
3.1 PostgreSQLProvider 클래스 작성
3.2 플레이스홀더 변환 함수 (? → $N)
3.3 Connection Pool 관리
3.4 트랜잭션 처리
3.5 SSL/TLS 설정
```

#### 4. Factory 패턴 적용
```
4.1 src/lib/db/index.ts 수정
4.2 getProvider() 싱글톤 함수
4.3 환경변수 기반 선택
4.4 기존 query(), transaction() 함수 유지
```

#### 5. 환경 설정
```
5.1 docker-compose.yml 작성
5.2 .env.example 업데이트
5.3 package.json 수정 (pg 추가)
5.4 .gitignore 확인
```

#### 6. 테스트
```
6.1 TypeScript 빌드 검증
6.2 로컬 SQLite 테스트
6.3 로컬 PostgreSQL 테스트
6.4 API 엔드포인트 검증
6.5 트랜잭션 테스트
```

---

## 📋 리소스 계획

### 인력
- **구현**: Claude Code AI
- **리뷰**: 사용자

### 기술 스택
```
언어/프레임워크:
  - TypeScript
  - Node.js
  - Next.js

라이브러리:
  - better-sqlite3 (SQLite)
  - pg (PostgreSQL)
  - @types/pg (TypeScript 타입)

인프라:
  - Docker (로컬 개발)
  - Render (프로덕션)
```

### 의존성
```
패키지:
  npm install pg @types/pg

버전 호환성:
  - Node.js >= 18.0.0
  - PostgreSQL >= 12.0
  - SQLite >= 3.0
```

---

## 🚨 위험 분석

### 위험 1: 기존 코드 호환성 손상
**확률**: 낮음 | **영향**: 높음
**대응**:
- API Routes 수정 없음 (투명성)
- SQL 플레이스홀더 자동 변환
- 철저한 호환성 테스트

### 위험 2: 데이터 마이그레이션 이슈
**확률**: 중간 | **영향**: 높음
**대응**:
- 데이터 마이그레이션은 별도 프로젝트 (현재는 포함 X)
- 초기 배포 시 기존 데이터 백업 필수
- 롤백 계획 수립

### 위험 3: 성능 저하
**확률**: 낮음 | **영향**: 중간
**대응**:
- Connection Pool 최적화 (PostgreSQL)
- 인덱스 생성 (성능 향상)
- 로컬 테스트로 벤치마킹

### 위험 4: Render 배포 실패
**확률**: 낮음 | **영향**: 높음
**대응**:
- Render PostgreSQL URL 형식 사전 검증
- TLS/SSL 설정 확인
- 로컬 Docker로 사전 테스트
- Render 지원팀 연락처 준비

---

## ✅ 성공 기준 및 검증 방법

### 검증 항목

| 항목 | 검증 방법 | 통과 기준 |
|------|---------|----------|
| **호환성** | 31개 API 테스트 | 모두 정상 작동 |
| **SQL 호환** | 쿼리 로그 확인 | 수정 없음 |
| **빌드** | npm run build | 에러 0개 |
| **로컬 SQLite** | npm run dev | 조회/조작 성공 |
| **로컬 PostgreSQL** | docker + npm run dev | 조회/조작 성공 |
| **배포 PostgreSQL** | Render 환경 테스트 | 연결 성공 |
| **트랜잭션** | 트랜잭션 테스트 | ROLLBACK 정상 |
| **코드 품질** | TypeScript | 타입 에러 없음 |

---

## 📚 참고 자료

### 기술 문서
- PostgreSQL 공식: https://www.postgresql.org/
- pg 라이브러리: https://github.com/brianc/node-postgres
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3
- Provider Pattern: https://refactoring.guru/design-patterns/provider
- Factory Pattern: https://refactoring.guru/design-patterns/factory-method

### 프로젝트 문서
- CLAUDE.md (프로젝트 규칙)
- docs/02-design/db-provider-pattern.design.md (설계서)
- docs/02-design/db-provider-implementation-spec.md (구현 명세)
- docs/02-design/postgresql-schema-plan.md (스키마 계획)

---

## 📞 의사결정 및 승인

### 주요 결정사항

1. **Provider Pattern 채택**
   - ✅ 결정: Provider Pattern 도입
   - 근거: 확장성, 유지보수성, 미래 DB 추가 용이

2. **조건분기 최소화**
   - ✅ 결정: Factory에서만 분기 (1회)
   - 근거: 코드 복잡도 감소, 가독성 향상

3. **플레이스홀더 자동 변환**
   - ✅ 결정: ? → $N 자동 변환 (Provider 내부)
   - 근거: 기존 SQL 파일 수정 불필요

4. **환경변수 기반 선택**
   - ✅ 결정: DB_PROVIDER 환경변수
   - 근거: 배포 시 유연성, 로컬 테스트 용이

### 승인 상태

| 단계 | 승인자 | 상태 | 날짜 |
|------|--------|------|------|
| 계획 | - | 📋 대기중 | - |
| 설계 | - | 📋 대기중 | - |
| 구현 | - | 📋 예정 | - |
| 검증 | - | 📋 예정 | - |

---

## 📝 변경 이력

| 버전 | 날짜 | 변경사항 | 작성자 |
|------|------|---------|--------|
| 1.0 | 2026-02-28 | 초안 작성 | Claude Code |

---

## 🎯 핵심 요약

```
문제: Render 배포 시 SQLite 데이터 손실
해결: Provider Pattern으로 PostgreSQL 지원 추가
방식: 기존 코드 수정 최소화 (투명한 전환)
효과: SQLite + PostgreSQL 동시 지원, 배포 가능
```

**성공하면**: 유사호출부호 공유시스템을 Render에 안전하게 배포할 수 있음 ✅

---

**작성자**: Claude Code
**최종 수정**: 2026-02-28
**다음 단계**: Design Phase 진행 또는 Implementation Phase 시작
