# AI API 자동 분석 통합 계획

## Context
현재 AI 분석 워크플로우는 완전 수동입니다:
1. 관리자가 JSON 다운로드 → 외부 AI(Claude/ChatGPT) 웹에 붙여넣기 → 결과 JSON 복사 → 시스템에 임포트
2. 이 과정이 번거롭고 시간이 걸림 (159쌍 기준 5~10분 수작업)

**목표**: API 키가 설정되어 있으면 버튼 한 번으로 자동 분석, 없으면 기존 수동 방식 유지. 두 가지 모두 사용 가능.

---

## Architecture

```
[관리자]
  ├─ API 키 있음 → [자동 분석 버튼] → POST /api/admin/ai-analysis/auto
  │                                      ├─ fetchPendingPairs() (공유)
  │                                      ├─ buildAnalysisPrompt() (공유)
  │                                      ├─ AI API 호출 (Anthropic/OpenAI)
  │                                      ├─ parseAiResponse() (JSON 파싱)
  │                                      └─ importAiResults() (공유) → DB 저장
  │
  └─ API 키 없음 → [기존 수동 워크플로우]
                     ├─ JSON 다운로드 (export/route.ts)
                     ├─ 외부 AI에서 분석
                     └─ 결과 임포트 (database/import/route.ts)
```

---

## 구현 체크리스트

### Phase 1: 인프라 준비
- [x] 1-1. 패키지 설치 (`npm install @anthropic-ai/sdk openai`)
- [x] 1-2. 환경변수 추가 (`.env.example`에 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`)
- [x] 1-3. DB 마이그레이션 (`scripts/migrations/008_ai_analysis_jobs.sql`)
- [x] 1-4. `scripts/init.sql`에 테이블 추가

### Phase 2: 공유 로직 추출 (리팩터링)
- [x] 2-1. `src/lib/ai/fetch-pending-pairs.ts` — 미분석 쌍 조회 함수 추출
- [x] 2-2. `src/lib/ai/prompt-builder.ts` — 프롬프트 생성 함수 추출
- [x] 2-3. `src/lib/ai/import-results.ts` — 분석결과 DB 저장 함수 추출
- [x] 2-4. `export/route.ts` 리팩터링 (공유 함수 호출)
- [x] 2-5. `database/import/route.ts` 리팩터링 (공유 함수 호출)

### Phase 3: AI Provider 구현
- [x] 3-1. `src/lib/ai/providers/anthropic.ts` — Anthropic SDK 래퍼
- [x] 3-2. `src/lib/ai/providers/openai.ts` — OpenAI SDK 래퍼
- [x] 3-3. `src/lib/ai/parse-response.ts` — AI 응답 JSON 파싱
- [x] 3-4. `src/lib/ai/index.ts` — Provider 선택 + 메인 진입점

### Phase 4: API 라우트
- [x] 4-1. `GET /api/admin/ai-analysis/config` — Provider 설정 확인
- [x] 4-2. `POST /api/admin/ai-analysis/auto` — 자동 분석 실행
- [x] 4-3. init.sql에 ai_analysis_jobs 테이블 스키마 추가

### Phase 5: UI 변경
- [x] 5-1. `AiAnalysisTab.tsx` — 자동 분석 섹션 추가
- [x] 5-2. Provider 선택 드롭다운 + 상태 표시
- [x] 5-3. 분석 진행/완료 UI

### Phase 6: 검증
- [x] 6-1. `npm run build` 성공 확인
- [ ] 6-2. 자동 분석 모드 동작 확인 (API 키 설정 후 테스트 필요)
- [ ] 6-3. 수동 분석 모드 기존 동작 유지 확인

---

## 세부 설계

### Phase 1 세부

#### 1-2. 환경변수 (.env.example)
```
# AI API Keys (선택사항 - 자동 분석용)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

#### 1-3. DB 마이그레이션 — `scripts/migrations/008_ai_analysis_jobs.sql`
```sql
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
  created_by UUID REFERENCES users(id)
);
```

---

### Phase 2 세부

#### 2-1. fetch-pending-pairs.ts
`export/route.ts`에서 추출할 내용:
- 신규 미분석 pair 쿼리 (LEFT JOIN callsign_ai_analysis WHERE ai.id IS NULL)
- 재분석 필요 pair 쿼리 (INNER JOIN WHERE needs_reanalysis = TRUE)
- error count 집계 쿼리 (callsign_occurrences JOIN)
- deriveDirection(), deriveTrafficLevel() 헬퍼 함수

#### 2-2. prompt-builder.ts
`export/route.ts`에서 추출할 내용:
- prompt 객체 전체 (instruction, operationalContext, scoringMethod, reasonTypePriority, scoreDistribution, subErrorScoring, errorRateCalculation, analysisRules, aiReasonRules, phoneticConfusion, outputFormat)
- meta 객체 생성

#### 2-3. import-results.ts
`database/import/route.ts`에서 추출할 내용:
- 결과 검증 로직 (ai_score 범위, reason_type 유효성, ai_reason 길이)
- DB INSERT/UPDATE 로직 (UPSERT with overwrite)
- snapshot 저장 로직

---

### Phase 3 세부

#### 3-1. anthropic.ts
```typescript
// @anthropic-ai/sdk 사용
// model 기본값: claude-sonnet-4-20250514
// max_tokens: 8192
// system prompt (분석 지침) + user message (데이터) 방식
```

#### 3-2. openai.ts
```typescript
// openai SDK 사용
// model 기본값: gpt-4o
// response_format: { type: 'json_object' }
// max_tokens: 8192
```

#### 3-3. parse-response.ts
AI 응답에서 JSON 추출 (견고한 파싱):
- 순수 JSON → 직접 파싱
- ```json ... ``` 마크다운 래핑 → 추출 후 파싱
- 앞뒤 텍스트 포함 → `{ "results":` 패턴 찾기

#### 3-4. index.ts
- `getAvailableProviders()` — 환경변수 확인하여 사용 가능한 provider 목록 반환
- `callAiAnalysis(provider, model, promptData)` — provider별 분기 호출

---

### Phase 4 세부

#### 4-1. GET /api/admin/ai-analysis/config
응답:
```json
{
  "providers": {
    "anthropic": { "configured": true, "defaultModel": "claude-sonnet-4-20250514" },
    "openai": { "configured": false }
  }
}
```
- API 키 자체는 절대 노출하지 않음 (boolean만)

#### 4-2. POST /api/admin/ai-analysis/auto
요청: `{ provider, model?, overwrite? }`
동기 방식 (export const maxDuration = 300)
흐름:
1. Auth 확인 (admin only)
2. 중복 실행 체크 (running job 있으면 거부)
3. fetchPendingPairs() → 미분석 쌍 조회
4. buildAnalysisPrompt(pairs) → 프롬프트 생성
5. AI API 호출 (callAiAnalysis)
6. parseAiResponse() → JSON 파싱
7. importAiResults() → DB 저장
8. ai_analysis_jobs에 이력 기록
9. 결과 반환

---

### Phase 5 세부 (UI)

```
┌───────────────────────────────────────────┐
│ AI 분석                                    │
│ 미분석 콜사인 쌍: 159건                     │
│                                            │
│ ── 자동 분석 ──────────────────────────     │
│ Provider: [Anthropic ▾]  (키 설정됨)       │
│ [자동 분석 시작]                            │
│ (분석 중... 30~120초 소요)                  │
│ 결과: 155건 저장, 4건 오류                  │
│                                            │
│ ── 또는 수동 분석 ────────────────────      │
│ [JSON 다운로드]  (기존 기능)                │
│                                            │
│ ── AI 분석 결과 임포트 ──────────────       │
│ (기존 파일 업로드/붙여넣기 UI 유지)         │
└───────────────────────────────────────────┘
```

- API 키 미설정 시: "API 키가 설정되지 않았습니다" 안내
- API 키 설정 시: provider 선택 + 자동 분석 버튼 활성화
- 분석 중: 로딩 스피너 + 진행 메시지 (30~120초)
- 완료 후: 삽입/업데이트/오류 건수 + pendingCount 갱신

---

## 파일 요약

### 신규 생성 (9개)
| 파일 | 용도 |
|------|------|
| `src/lib/ai/index.ts` | Provider 선택, 메인 진입점 |
| `src/lib/ai/providers/anthropic.ts` | Anthropic SDK 래퍼 |
| `src/lib/ai/providers/openai.ts` | OpenAI SDK 래퍼 |
| `src/lib/ai/parse-response.ts` | AI 응답 JSON 파싱 |
| `src/lib/ai/prompt-builder.ts` | 프롬프트 생성 (export에서 추출) |
| `src/lib/ai/fetch-pending-pairs.ts` | 미분석 쌍 조회 (export에서 추출) |
| `src/lib/ai/import-results.ts` | 분석결과 DB 저장 (import에서 추출) |
| `src/app/api/admin/ai-analysis/config/route.ts` | Provider 설정 확인 API |
| `src/app/api/admin/ai-analysis/auto/route.ts` | 자동 분석 실행 API |
| `scripts/migrations/008_ai_analysis_jobs.sql` | 분석 작업 이력 테이블 |

### 수정 (4개)
| 파일 | 변경 내용 |
|------|----------|
| `src/app/api/admin/ai-analysis/export/route.ts` | 공유 함수 호출로 리팩터링 |
| `src/app/api/admin/database/import/route.ts` | 공유 함수 호출로 리팩터링 |
| `src/components/callsign-management/uploads/AiAnalysisTab.tsx` | 자동 분석 UI 추가 |
| `package.json` | @anthropic-ai/sdk, openai 추가 |

---

## 보안
- API 키는 서버사이드 환경변수만 사용 (NEXT_PUBLIC_ 절대 불가)
- config 엔드포인트는 `configured: true/false`만 반환, 키 값 노출 안 함
- 모든 신규 API는 admin JWT 인증 필수
- 중복 실행 방지: 이미 running 상태 job이 있으면 새 요청 거부
