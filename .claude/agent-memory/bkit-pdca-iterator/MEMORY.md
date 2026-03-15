# 유사호출부호 공유시스템 프로젝트 메모리

## 프로젝트 구조 핵심 정보

- **스택**: Next.js 14 (App Router), TypeScript, Zustand, TanStack Query, PostgreSQL
- **인증**: JWT (accessToken 메모리 저장, refreshToken httpOnly 쿠키)
- **상태 관리**: `src/store/authStore.ts` - Zustand 스토어
- **API 클라이언트**: `src/lib/api/client.ts` - apiFetch (401 인터셉터 내장)

## 핵심 패턴

### API 인터셉터
- `apiFetch()` 함수를 통해 모든 API 호출 → `src/lib/api/client.ts`
- 401 수신 시 `/api/auth/refresh` 자동 호출 후 재시도
- 동시 요청 방지: 싱글 Promise 플래그(`refreshingPromise`) 사용
- 갱신 실패 시 `authStore.logout()` + `window.location.href = '/login'`

### Next.js API Route 패턴
- 인증 필요 라우트: Authorization 헤더에서 Bearer 토큰 추출 후 `verifyToken()`
- 관리자 전용 라우트: `payload.role !== 'admin'` 체크 → 403
- 동적 라우트에는 `export const dynamic = 'force-dynamic'` 필수 (빌드 경고 방지)

### 비밀번호 정책
- `PASSWORD_REGEX`: 8자+대문자+소문자+숫자+특수문자
- 임시 비밀번호 생성: 각 카테고리 최소 2개 + 랜덤 4자 = 12자 셔플
- `is_default_password: true`, `password_change_required: true` DB 플래그 세트

## 구현 완료된 이슈 (2026-02-19)

1. **401 자동 토큰 갱신 인터셉터** - `src/lib/api/client.ts` 신규 생성
2. **POST /api/auth/forgot-password** - `src/app/api/auth/forgot-password/route.ts` 신규
3. **GET /admin 대시보드** - `src/app/admin/page.tsx` 신규
4. **관리자 비밀번호 초기화** - `src/app/admin/password-reset/page.tsx` + `src/app/api/admin/users/[id]/password-reset/route.ts` 신규
5. **관리자 통계 API** - `src/app/api/admin/stats/route.ts` 신규

## ESLint 주의사항

- JSX 내 따옴표: `"` 직접 사용 금지, `&ldquo;` / `&rdquo;` 사용
- React Hook 관련 ESLint 활성화됨
