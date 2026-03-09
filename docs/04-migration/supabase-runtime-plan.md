# Supabase 실행 환경 전환 설계 (start.sh / .env)

## 1. 요구사항 정리

| 항목 | 내용 |
|------|------|
| 최종 목표 | `start.sh` 실행 시 **(A) SQLite 로컬 개발**과 **(B) Supabase 연결 모드**를 선택적으로 구성 |
| 환경 변수 | `.env.local` 자동 생성 시 모드별로 필요한 값 주입 (민감 값은 사용자 입력/기존 파일에서 재사용) |
| 개발 흐름 | 프론트엔드는 Supabase JS를, Next API는 `DB_PROVIDER=postgresql` + `DATABASE_URL`을 사용 |
| 검증 | 스크립트 끝에 `.env.local` 요약과 접속 테스트 커맨드 안내 |

## 2. start.sh 개선 설계

### 2.1 모드 선택 UX

1. `read -p "Select DB mode (1=SQLite, 2=Supabase) [1]: "` 형태로 입력 받기 (기본값 1).
2. 선택값에 따라 분기:
   - **SQLite 모드**: 기존 로직 유지 (`setup_sqlite`).
   - **Supabase 모드**: `setup_supabase` 신규 함수 실행.

### 2.2 Supabase 모드 함수 개략

```bash
setup_supabase() {
  echo "Supabase 모드 설정"
  read -p "DATABASE_URL (Postgres): " DATABASE_URL_INPUT
  read -p "NEXT_PUBLIC_SUPABASE_URL: " SUPABASE_URL_INPUT
  read -p "NEXT_PUBLIC_SUPABASE_ANON_KEY: " SUPABASE_ANON_INPUT
  read -p "SUPABASE_SERVICE_ROLE_KEY (optional): " SUPABASE_SERVICE_ROLE_INPUT

  cat > .env.local <<EOF
  DB_PROVIDER=postgresql
  DATABASE_URL=${DATABASE_URL_INPUT}
  NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL_INPUT}
  NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_INPUT}
  SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_INPUT}
  JWT_SECRET=dev-secret-key-for-local-only
  NEXT_PUBLIC_API_URL=http://localhost:3000
  EOF
}
```

보안상 입력값을 그대로 출력하지 않고, 마지막에 `envsubst` 유사 방식으로 `***` 처리하여 요약만 보여준다.

### 2.3 사전 체크

- Supabase 모드 진입 시 `psql` 명령 존재 여부 확인 (`command -v psql >/dev/null || warn`).
- `DATABASE_URL`이 `supabase.co` 도메인인지 간단히 패턴 검사하여 사용자 실수 방지.
- `.env.local`이 이미 존재하면 백업(`cp .env.local .env.local.bak-$(date +%s)`).

### 2.4 안내 메시지

Supabase 모드 완료 후:
```
Supabase 모드가 설정되었습니다.
검증:
  psql "$DATABASE_URL" -c '\dt'
  npm run dev (DB_PROVIDER=postgresql)
```

SQLite 모드 시 기존 메시지를 유지.

## 3. .env.example 업데이트 계획

1. `DB_PROVIDER` 설명에 “값: sqlite | postgresql | supabase (postgresql 동일)” 문구 추가.
2. Supabase 관련 변수 묶음을 “Supabase Direct Access (필수)”로 승격.
3. `SUPABASE_SERVICE_ROLE_KEY` 항목 설명에 “Next API 서버에서 RLS 무시 작업 시 필요” 추가.
4. `DATABASE_URL` 예제 문자열을 `<project>.supabase.co/postgres?sslmode=require` 형식으로 수정.

## 4. 실행 흐름 요약

1. `./start.sh` 실행 → 모드 선택.
2. Supabase 모드라면 `.env.local`에 Postgres/Supabase 키 입력.
3. `DB_PROVIDER=postgresql`이므로 `src/lib/db/index.ts`가 `PostgreSQLProvider`를 로드.
4. React Query 훅 중 Supabase JS를 쓰는 항목은 `.env`의 공개 키를 활용.
5. 로컬에서 입력/수정/삭제 시 Supabase DB에 즉시 반영.

## 5. 추후 작업 메모

- `.env.local`을 git에 무조건 ignore하되, 민감 값이 터미널 히스토리에 남지 않도록 `read -s` 옵션 고려 (특히 Service Role Key).
- Supabase Auth로 전환 시 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 외에 `NEXT_PUBLIC_SUPABASE_PROJECT_REF` 등의 추가 변수가 필요할 수 있음.
- start.sh 개선 후 README “빠른 시작” 섹션에 “Supabase 모드 실행” 챕터 추가 예정.
