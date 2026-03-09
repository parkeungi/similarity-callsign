# Supabase 연결 정보 입력 체크리스트

> 마이그레이션 단계별로 어떤 파일의 어느 위치에 무엇을 입력해야 하는지 정리한 문서입니다.
> Supabase 프로젝트 생성 후 이 파일을 보면서 순서대로 채워나가세요.

---

## 📍 Supabase 대시보드에서 가져올 정보

| 변수명 | 대시보드 위치 | 용도 | 노출 범위 |
|--------|-------------|------|-----------|
| `DATABASE_URL` | Project Settings → Database → Connection string (URI) | 서버 전용 pg Pool 연결 | 서버만 |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL | 프론트 Supabase JS | 공개 가능 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon public | 프론트 TanStack Query | 공개 가능 (RLS로 보호) |
| `SUPABASE_URL` | 위와 동일 | 서버 API Route Supabase JS | 서버만 |
| `SUPABASE_ANON_KEY` | 위와 동일 | 서버 API Route Supabase JS | 서버만 |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → service_role | 서버 RLS 우회 작업 | ★절대 클라이언트 노출 금지 |

---

## 1단계: .env.local 파일

> 파일 위치: `/프로젝트루트/.env.local`
> 현재 상태: `start.sh`가 SQLite 모드로 자동 생성 중 → **직접 생성/수정 필요**

```bash
# ─── DB Provider (sqlite → postgresql 변경) ───────────────────
DB_PROVIDER=postgresql

# ─── [★ 입력 필요] PostgreSQL 연결 문자열 ─────────────────────
# 위치: Supabase 대시보드 → Project Settings → Database → Connection string → URI 탭
# 주의: 끝에 ?sslmode=require 추가, 포트는 6543(트랜잭션 풀러) 권장
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[DB_PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require

# ─── [★ 입력 필요] Supabase 공개 키 (프론트엔드용) ─────────────
# 위치: Supabase 대시보드 → Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# ─── [★ 입력 필요] Supabase 서버 키 ──────────────────────────
# 서버 전용 (NEXT_PUBLIC_ 없는 버전)
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_ANON_KEY=eyJ...

# ─── [★ 입력 필요] Service Role 키 (RLS 우회) ─────────────────
# 위치: Supabase 대시보드 → Project Settings → API → service_role
# ★★★ 이 키는 절대로 NEXT_PUBLIC_ 접두사 사용 금지 ★★★
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ─── JWT (현재 자체 인증 유지 시 필수) ────────────────────────
JWT_SECRET=your_jwt_secret_generated_with_openssl_rand_base64_32

# ─── App ──────────────────────────────────────────────────────
NEXT_PUBLIC_APP_NAME=KATC 유사호출부호 경고시스템
NODE_ENV=development
```

---

## 2단계: start.sh 수정 필요 위치

> 파일 위치: `/프로젝트루트/start.sh`
> 현재 문제: `setup_sqlite()` 함수만 있고 Supabase 모드 함수가 없음

**추가해야 할 함수** (setup_sqlite() 아래에 추가):

```bash
# 함수: Supabase 환경 설정
setup_supabase() {
  echo -e "\n${BLUE}📝 Supabase 환경 설정 중...${NC}"

  if [ ! -f .env.local ]; then
    cat > .env.local << 'EOF'
# ─── [★ 입력 필요] 아래 값을 실제 Supabase 프로젝트 값으로 변경하세요 ───

DB_PROVIDER=postgresql
DATABASE_URL=postgresql://postgres.REPLACE_ME:REPLACE_ME@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require

NEXT_PUBLIC_SUPABASE_URL=https://REPLACE_ME.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=REPLACE_ME
SUPABASE_URL=https://REPLACE_ME.supabase.co
SUPABASE_ANON_KEY=REPLACE_ME
SUPABASE_SERVICE_ROLE_KEY=REPLACE_ME

JWT_SECRET=dev-secret-key-for-local-only
NEXT_PUBLIC_APP_NAME=KATC 유사호출부호 경고시스템
EOF
    echo -e "${YELLOW}⚠️  .env.local이 생성됐습니다. Supabase 값을 입력 후 재실행하세요.${NC}"
    exit 1
  fi

  echo -e "${GREEN}✓ .env.local 확인 완료 (Supabase 모드)${NC}"
}
```

**main() 함수 안에서 모드 선택 로직 추가**:
```bash
# start.sh main() 안에서:
MODE=${1:-sqlite}   # 기본값 sqlite, "supabase" 인자 전달 시 Supabase 모드
if [ "$MODE" = "supabase" ]; then
  setup_supabase
else
  setup_sqlite
fi
```

**실행 방법**:
```bash
./start.sh           # SQLite 모드 (기존)
./start.sh supabase  # Supabase 모드
```

---

## 3단계: src/lib/supabase/client.ts

> 파일 위치: `src/lib/supabase/client.ts`
> 현재 상태: 클라이언트(anon key) 전용만 있음 → 서버용 service_role 클라이언트 추가 필요

**현재 코드** (변경 불필요, 환경변수 입력으로 해결):
```typescript
// NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY가 .env.local에 설정되면 자동 작동
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;       // ← .env.local에서 자동 주입
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // ← .env.local에서 자동 주입
```

**추가 필요 (서버 전용 admin 클라이언트)**:
> `src/lib/supabase/server.ts` 파일 생성 필요
```typescript
// src/lib/supabase/server.ts 에 추가
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 값이 .env.local에 있으면 자동 작동
```

---

## 4단계: src/lib/db/providers/postgresql/index.ts

> 파일 위치: `src/lib/db/providers/postgresql/index.ts`
> 현재 상태: `DATABASE_URL` 환경변수를 읽어서 Pool 생성 → **환경변수만 설정하면 자동 작동**

```typescript
// 이 파일은 수정 불필요
// DATABASE_URL이 .env.local에 설정되면 자동으로 pg.Pool이 Supabase에 연결됨
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,  // ← .env.local에서 자동 주입
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
```

---

## 5단계: Supabase 대시보드에서 직접 실행할 SQL

> Supabase 대시보드 → SQL Editor에서 아래 순서로 실행

### 5-1. 스키마 생성
```
scripts/init.sql 전체 내용 복사 → Supabase SQL Editor에 붙여넣기 → Run
```

### 5-2. 시드 데이터 (callsigns 156개 등)
```
docs/migration_step2_data.sql 전체 내용 복사 → Supabase SQL Editor에 붙여넣기 → Run
```

### 5-3. RLS 정책 (필요 시)
```sql
-- 각 테이블에 RLS 활성화 (service_role 키로만 관리자 API 접근)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE callsigns ENABLE ROW LEVEL SECURITY;
-- 나머지 테이블도 동일하게 추가
```

---

## 6단계: Render 배포 환경변수 (프로덕션)

> Render 대시보드 → 서비스 선택 → Environment → Add Environment Variable

| 변수명 | 값 |
|--------|-----|
| `DB_PROVIDER` | `postgresql` |
| `DATABASE_URL` | Supabase Connection string (sslmode=require 포함) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://[PROJECT_REF].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public 키 |
| `SUPABASE_URL` | `https://[PROJECT_REF].supabase.co` |
| `SUPABASE_ANON_KEY` | anon public 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 (**★ Render에서만 입력, 코드에 절대 하드코딩 금지**) |
| `JWT_SECRET` | `openssl rand -base64 32` 로 생성 |
| `NODE_ENV` | `production` |

---

## ✅ 전체 입력 체크리스트

```
[ ] .env.local 생성 및 6개 변수 입력
    [ ] DB_PROVIDER=postgresql
    [ ] DATABASE_URL (Supabase Connection string)
    [ ] NEXT_PUBLIC_SUPABASE_URL
    [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
    [ ] SUPABASE_SERVICE_ROLE_KEY
    [ ] JWT_SECRET

[ ] start.sh Supabase 모드 함수 추가 (setup_supabase)

[ ] Supabase SQL Editor에서 스키마 실행
    [ ] scripts/init.sql 실행
    [ ] docs/migration_step2_data.sql 실행

[ ] npm run dev → DB_PROVIDER=postgresql 로 서버 기동 확인

[ ] Render 배포 환경변수 6개 설정 (프로덕션 준비 시)
```

---

## ⚠️ 주의사항 요약

| 항목 | 내용 |
|------|------|
| `SUPABASE_SERVICE_ROLE_KEY` | NEXT_PUBLIC_ 접두사 절대 금지. 클라이언트에 노출 시 RLS 전체 무력화 |
| `DATABASE_URL` 포트 | 6543(트랜잭션 풀러) 권장. 5432(세션 모드)는 커넥션 제한 있음 |
| SSL 설정 | `?sslmode=require` 필수 (Supabase는 SSL 강제) |
| `.env.local` | 절대 git commit 금지 (`.gitignore` 에 이미 포함 확인 필요) |
| `DB_PROVIDER` | `sqlite` → `postgresql` 로 변경해야 Supabase 연결됨 |

---

**작성일**: 2026-03-08
**관련 파일**: `.env.example`, `start.sh`, `src/lib/supabase/client.ts`, `src/lib/db/providers/postgresql/index.ts`
