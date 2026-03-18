# ✈️ 유사호출부호 공유시스템

항공교통관제 안전을 위한 유사호출부호(Look-Alike Call Sign) 관리 및 조치 추적 시스템

## 🎯 주요 기능

- **인증 시스템**: 역할 기반 접근 제어 (Admin/User)
- **유사호출부호 관리**: 호출부호 데이터 업로드 및 조회
- **조치 추적**: 관리자 조치 등록 → 항공사 실행 → 완료 이력
- **실시간 분석**: 오류 유형별 통계 및 세부 분석
- **다중 항공사 지원**: 국내 11개 항공사 관리

## 🛠️ 기술 스택

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **State Management**: Zustand, TanStack Query v5
- **Backend**: Node.js, PostgreSQL (Supabase)
- **배포**: Vercel (Next.js App Router)

## 📋 시스템 요구사항

- Node.js 18+
- npm
- Supabase 프로젝트 (PostgreSQL DB)

## 🚀 빠른 시작

### 1️⃣ 저장소 클론

```bash
git clone https://github.com/soulmatelibrary-ux/similar-callsign.git
cd similar-callsign
```

### 2️⃣ 의존성 설치

```bash
npm install
```

### 3️⃣ 환경 변수 설정

`.env.example`을 복사하여 `.env.local`을 생성하고 Supabase 정보를 입력합니다.

```bash
cp .env.example .env.local
```

필수 환경 변수:

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | Supabase PostgreSQL 연결 문자열 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role 키 (서버 전용) |
| `JWT_SECRET` | JWT 서명 비밀키 (openssl rand -base64 32) |

Supabase 연결 설정은 `docs/supabase-setup-checklist.md`를 참고하세요.

### 4️⃣ 데이터베이스 초기화

`scripts/init.sql`을 Supabase SQL Editor에서 실행하여 스키마를 생성합니다.

### 5️⃣ 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 열기

### 6️⃣ 빌드 및 배포

```bash
npm run build
npm run start
```

## 📁 프로젝트 구조

```
.
├── src/
│   ├── app/                    # Next.js 앱 라우터
│   │   ├── (main)/             # 인증된 사용자 영역
│   │   ├── admin/              # 관리자 대시보드
│   │   ├── api/                # REST API 엔드포인트
│   │   └── auth/               # 인증 페이지
│   ├── components/             # React 컴포넌트
│   ├── hooks/                  # React 커스텀 훅
│   ├── lib/                    # 유틸리티 함수
│   ├── types/                  # TypeScript 타입 정의
│   └── store/                  # 상태 관리 (Zustand)
├── scripts/
│   └── init.sql                # 데이터베이스 스키마
├── public/                     # 정적 파일
└── package.json
```

## 🔐 인증 흐름

### 로그인
1. `/auth/login` - 로그인
2. JWT 토큰 발급 (accessToken + refreshToken)

### 역할 기반 접근
- **Admin**: 조치 등록, 항공사 관리, 전체 현황 조회
- **User**: 자사 항공사 현황 조회, 조치 실행, 완료 등록

## 📊 주요 API 엔드포인트

### 인증
- `POST /api/auth/login` - 로그인
- `POST /api/auth/refresh-token` - 토큰 갱신

### 조치 관리
- `GET /api/airlines/[airlineId]/actions` - 항공사별 조치 목록
- `POST /api/airlines/[airlineId]/actions` - 조치 등록
- `PATCH /api/actions/[id]` - 조치 수정/완료
- `GET /api/callsigns` - 유사호출부호 조회

### 항공사 관리
- `GET /api/airlines` - 항공사 목록
- `POST /api/admin/airlines` - 항공사 생성
- `PATCH /api/admin/airlines/[id]` - 항공사 수정
- `DELETE /api/admin/airlines/[id]` - 항공사 삭제

## 📈 데이터베이스 스키마

### 주요 테이블

**airlines** - 항공사
```sql
id, code, name_ko, name_en, display_order
```

**callsigns** - 유사호출부호
```sql
id, airline_id, callsign_pair, my_callsign, other_callsign,
risk_level, similarity, error_type, sub_error, occurrence_count
```

**actions** - 조치 이력
```sql
id, airline_id, callsign_id, action_type, description,
manager_name, status, result_detail, completed_at,
registered_by, registered_at, updated_at, reviewed_by, reviewed_at
```

자세한 스키마는 `scripts/init.sql` 참고

## 🔒 보안 기능

- ✅ JWT 토큰 기반 인증
- ✅ 401/403 자동 에러 처리
- ✅ HSTS, CSP 보안 헤더
- ✅ 비밀번호 강화 규칙 (8자 이상, 대문자, 숫자 포함)
- ✅ 서버사이드 라우트 보호 (middleware)

## 📦 배포 옵션

### Vercel (권장)
```bash
npm install -g vercel
vercel
```

Vercel 프로젝트 환경 변수에 `.env.local`과 동일한 값을 설정하세요.

### 수동 배포
```bash
npm run build
npm run start
```

## 🧪 테스트 계정

### 관리자 (단일 계정)
- Email: `parkeungi21@korea.kr`
- Password: `1234`

> ⚠️ 프로덕션 환경에서는 반드시 변경하세요!

## 🐛 문제 해결

### "JWT_SECRET 에러"
- `.env.local` 파일에 JWT_SECRET 입력
- 최소 32자 이상의 임의 문자열 권장 (`openssl rand -base64 32`)
- `npm run dev` 재실행

### "DATABASE_URL 연결 실패"
- Supabase 대시보드 → Project Settings → Database → Connection string 확인
- `?sslmode=require` 추가 여부 확인
- IP 허용 목록(Supabase → Network) 확인

### "포트 3000이 이미 사용 중"
```bash
npm run dev -- -p 3001
```

## 🚫 제외 대상

- `callsign.xlsx` 등 원본 데이터 엑셀 파일
- `docs/` 이하 설계·보고·로그 문서
- 환경 변수 파일 (`.env*`)
- 빌드 산출물 및 캐시 (`.next/`, `out/`, `coverage/`)
- 의존성 폴더 (`node_modules/`)

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능

---

**마지막 업데이트**: 2026-03-09
**버전**: 2.0.0 (PostgreSQL/Supabase)
**상태**: ✅ Production Ready
