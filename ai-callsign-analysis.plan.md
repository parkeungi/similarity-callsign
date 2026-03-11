# 기능 설계서: AI 유사호출부호 우선순위 분석

> 작성일: 2026-03-11
> 최종 수정: 2026-03-12
> 상태: 항공사 페이지 AI 표시 구현 완료 / 나머지 AI 분석 INSERT 진행 중

---

## 1. 개요

### 1.1 목적
발생현황 페이지의 유사호출부호 쌍에 대해 **AI가 음성적/시각적 유사성을 독자적으로 분석**하여 조치 우선순위 점수와 **항공사에 전달할 수 있는 납득 가능한 근거**를 제공한다.

### 1.2 배경
- 기존 유사도/오류발생가능성 점수는 매뉴얼 기반 정량 공식으로 산출됨
- 매뉴얼에 포함되지 않는 **발음 유사성, 숫자 전치, 포함관계** 등 정성적 판단이 필요
- 항공사에 조치를 요청할 때 "왜 이 편명이 위험한지" 구체적 근거가 필요
- 관제사의 조치여부(actionStatus)는 실제로 보장되지 않아 참고 불가

### 1.3 핵심 결정 사항
| 항목 | 결정 |
|------|------|
| AI 분석 주체 | Claude Code (OpenAI API 미사용) |
| 분석 시점 | 사용자 요청 시 Claude가 직접 분석 후 DB INSERT |
| 분석 입력 | 콜사인 쌍(pair) + 발생빈도(count) |
| 결과 저장 | 별도 테이블 (`callsign_ai_analysis`) |
| 토큰 비용 | $0 (외부 API 미호출) |
| 재분석 | 같은 pair는 1회만 분석, 신규 pair만 추가 분석 |

---

## 2. 데이터 설계

### 2.1 신규 테이블: `callsign_ai_analysis`

```sql
CREATE TABLE IF NOT EXISTS callsign_ai_analysis (
  id SERIAL PRIMARY KEY,
  callsign_pair TEXT NOT NULL UNIQUE,
  ai_score INT NOT NULL CHECK (ai_score BETWEEN 1 AND 100),
  ai_reason TEXT NOT NULL,
  reason_type TEXT NOT NULL DEFAULT 'LOW_RISK',
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_by TEXT DEFAULT 'claude'
);

CREATE INDEX idx_ai_analysis_pair ON callsign_ai_analysis(callsign_pair);
CREATE INDEX idx_ai_analysis_score ON callsign_ai_analysis(ai_score DESC);
CREATE INDEX idx_ai_analysis_reason_type ON callsign_ai_analysis(reason_type);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | SERIAL PK | 자동 증가 ID |
| `callsign_pair` | TEXT UNIQUE | 호출부호 쌍 ("ESR887 \| KAL887") |
| `ai_score` | INT (1~100) | AI 우선순위 점수 |
| `ai_reason` | TEXT | 항공사 설득용 조치 근거 (2~3문장, 횟수 미언급) |
| `reason_type` | TEXT | 혼동 유형 분류 (아래 표 참고) |
| `analyzed_at` | TIMESTAMPTZ | 분석 일시 |
| `analyzed_by` | TEXT | 분석 주체 (기본값: 'claude') |

### 2.2 reason_type 유형 분류

| reason_type | 설명 | 예시 | 점수 범위 |
|-------------|------|------|-----------|
| `SAME_NUMBER` | 다른 항공사, 편명번호 완전 동일 | ESR887 ↔ KAL887 | 84~96 |
| `CONTAINMENT` | 짧은 번호가 긴 번호에 포함 | KAL126 ↔ KAL1256 | 78~88 |
| `TRANSPOSITION` | 숫자 자릿수 전치 | TWB301 ↔ TWB310 | 70~82 |
| `SIMILAR_CODE` | 항공사코드 발음 유사 + 편명 유사 | JNA301 ↔ JJA301 | 70~96 |
| `DIGIT_OVERLAP` | 같은 항공사, 앞/뒤 숫자 겹침 | AAR701 ↔ AAR731 | 40~68 |
| `PHONETIC_DIGIT` | 발음 혼동 숫자 조합 포함 | AAR135 ↔ AAR195 | 55~78 |
| `LOW_RISK` | 유사성 낮음 | 코드/번호 모두 다름 | 15~39 |

**활용:**
- 프론트엔드에서 유형별 필터링 가능
- 항공사에 "편명동일 유형 5건, 전치 유형 3건" 식으로 요약 전달 가능
- 같은 유형끼리 묶어서 일괄 조치 요청 가능

### 2.3 ICAO 무선교신 발음 혼동 숫자 쌍

| 숫자 | ICAO 발음 | 혼동 대상 | 이유 |
|------|----------|----------|------|
| 5 (Fife) | 파이프 | 9 (Niner) | 끝 발음 유사 |
| 9 (Niner) | 나이너 | 5 (Fife) | 끝 발음 유사 |
| 3 (Tree) | 트리 | 8 (Ait) | 잡음 환경에서 혼동 |
| 0 (Zero) | 제로 | 4 (FOW-er) | 약한 혼동 |
| 1 (Wun) | 원 | 9 (Niner) | 짧은 교신 시 |
| 13 | 서틴 | 30 (서티) | 한국어에서도 혼동 |
| 14 | 포틴 | 40 (포티) | 한국어에서도 혼동 |
| 15 | 피프틴 | 50 (피프티) | 한국어에서도 혼동 |

### 2.4 기존 테이블 변경: 없음
- `callsigns` 테이블은 수정하지 않음
- `callsign_pair` 문자열로 JOIN하여 연결

---

## 3. AI 분석 기준

### 3.1 분석 입력 데이터
```json
{ "pair": "ESR887 | KAL887", "count": 3 }
```
- 기존 매뉴얼 데이터(similarity, risk_level, actionStatus 등)는 **전송하지 않음**
- AI가 콜사인 쌍 자체의 특성만으로 독자 판단

### 3.2 판단 기준 (6가지)

| # | 기준 | 예시 | 위험도 |
|---|------|------|--------|
| 1 | 편명번호 완전 동일 | ESR**887** ↔ KAL**887** | 매우 높음 |
| 2 | 숫자 전치(transposition) | TWB**301** ↔ TWB**310** | 높음 |
| 3 | 숫자 포함관계 | AAR**214** ↔ AAR**2140** | 높음 |
| 4 | 항공사코드 발음 유사 | **JNA** ↔ **JJA** | 높음 |
| 5 | 같은 항공사 내 혼동 | **KAL**1234 ↔ **KAL**1243 | 중간 |
| 6 | 발생빈도 가중 | count 높을수록 | +점수 |

### 3.3 점수 산출 가이드

| 점수 범위 | 등급 | 조건 |
|-----------|------|------|
| 80~100 | 긴급 | 편명 동일 + 발음유사 코드 또는 고빈도 |
| 60~79 | 주의 | 편명 동일 또는 전치/포함 + 중빈도 |
| 40~59 | 관찰 | 부분 유사 + 저빈도 |
| 1~39 | 낮음 | 유사성 낮음 |

### 3.4 예상 분석 결과 예시

```
┌─────────────────────────┬──────┬─────────────────────────────────────────────┐
│ pair                    │score │ reason                                      │
├─────────────────────────┼──────┼─────────────────────────────────────────────┤
│ JNA301 | JJA301         │  95  │ 편명번호 301이 완전 동일하고, 항공사코드   │
│                         │      │ JNA와 JJA는 무선교신 시 발음이 매우 유사    │
│                         │      │ 하여 관제사가 혼동할 위험이 극히 높습니다.  │
│                         │      │ 5회 반복 발생으로 즉시 편명 변경 권고.      │
├─────────────────────────┼──────┼─────────────────────────────────────────────┤
│ ESR887 | KAL887         │  88  │ 편명번호 887이 완전 동일합니다. 항공사코드  │
│                         │      │ 는 다르나 같은 번호 사용 시 관제지시 대상이 │
│                         │      │ 뒤바뀔 수 있으며, 3회 반복 발생은 상시적    │
│                         │      │ 혼동을 의미합니다.                          │
├─────────────────────────┼──────┼─────────────────────────────────────────────┤
│ TWB301 | TWB310         │  78  │ 같은 항공사(TWB)에서 301과 310은 끝 두 자리│
│                         │      │ 가 전치되어 있어 빠른 교신 시 혼동 가능성이 │
│                         │      │ 높습니다. 4회 발생으로 편명 조정 검토 권고.  │
├─────────────────────────┼──────┼─────────────────────────────────────────────┤
│ ABL101 | ASV101         │  48  │ 편명번호 101이 동일하나, ABL과 ASV는 발음   │
│                         │      │ 차이가 있어 혼동 위험은 중간 수준입니다.    │
└─────────────────────────┴──────┴─────────────────────────────────────────────┘
```

---

## 4. 운영 흐름

### 4.1 최초 분석
```
1. 관리자: "AI 분석해줘"
2. Claude: DB에서 전체 callsign pair + count 조회
3. Claude: 각 pair 분석 → score/reason 생성
4. Claude: callsign_ai_analysis 테이블에 INSERT
5. 완료: 발생현황 페이지에서 AI 점수/근거 표시
```

### 4.2 신규 업로드 후 추가 분석
```
1. 관리자: 새 엑셀 업로드 → 새 callsign pair 등록
2. 관리자: "새 데이터 분석해줘"
3. Claude: callsign_ai_analysis에 없는 pair만 필터
4. Claude: 미분석 건만 분석 후 INSERT
5. 기존 분석 결과는 유지 (재분석 불필요)
```

### 4.3 재분석 (선택)
```
1. 관리자: "전체 재분석해줘"
2. Claude: 기존 데이터 DELETE 후 전체 재분석
3. 또는: 특정 pair만 지정하여 UPDATE
```

---

## 5. 프론트엔드 변경 - 항공사 페이지 (구현 완료)

> 2026-03-12 구현 완료

### 5.1 API 변경 (`GET /api/airlines/[airlineId]/callsigns`)

#### JOIN 방식
```sql
SELECT
  c.*,
  ai.ai_score,
  ai.ai_reason,
  ai.reason_type
FROM callsigns c
LEFT JOIN callsign_ai_analysis ai
  ON ai.callsign_pair = c.callsign_a || ' | ' || c.callsign_b
WHERE (c.airline_a_code = $1 OR c.airline_b_code = $1)
```

- `callsign_ai_analysis.callsign_pair`는 **원본 형식** (`callsign_a | callsign_b`)으로 저장
- 항공사 관점 재구성(`my | other`)이 아닌 **원본 pair로 JOIN**해야 정확히 매칭
- 응답에 `ai_score`, `ai_reason`, `reason_type` 필드 추가 (snake_case + camelCase 양쪽)

#### 응답 필드 추가
```typescript
{
  // ... 기존 필드 ...
  ai_score: number | null,      // AI 우선순위 점수 (1~100)
  ai_reason: string | null,     // 혼동 사유 설명 (2~3문장)
  reason_type: string | null,   // 혼동 유형 (SAME_NUMBER 등 7종)
  // camelCase 별칭
  aiScore: number | null,
  aiReason: string | null,
  reasonType: string | null,
}
```

### 5.2 타입 변경

#### `src/types/action.ts` - Callsign 인터페이스
```typescript
// AI 분석 데이터 (6개 필드 추가)
ai_score?: number | null;
ai_reason?: string | null;
reason_type?: string | null;
aiScore?: number | null;
aiReason?: string | null;
reasonType?: string | null;
```

#### `src/types/airline.ts` - Incident 인터페이스
```typescript
// AI 분석 데이터 (3개 필드 추가)
aiScore?: number | null;
aiReason?: string | null;
reasonType?: string | null;
```

#### `src/types/airline.ts` - 신규 상수/함수
```typescript
// reason_type 한글 라벨 및 색상 매핑
export const REASON_TYPE_CONFIG: Record<string, { label: string; bgColor: string; textColor: string }> = {
  SAME_NUMBER:    { label: '편명번호 동일',   bgColor: 'bg-red-50',    textColor: 'text-red-700' },
  CONTAINMENT:    { label: '편명 포함관계',   bgColor: 'bg-orange-50', textColor: 'text-orange-700' },
  TRANSPOSITION:  { label: '숫자 전치',       bgColor: 'bg-amber-50',  textColor: 'text-amber-700' },
  SIMILAR_CODE:   { label: '항공사코드 유사', bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
  DIGIT_OVERLAP:  { label: '숫자 겹침',       bgColor: 'bg-blue-50',   textColor: 'text-blue-700' },
  PHONETIC_DIGIT: { label: '발음 혼동',       bgColor: 'bg-indigo-50', textColor: 'text-indigo-700' },
  LOW_RISK:       { label: '낮은 위험',       bgColor: 'bg-gray-50',   textColor: 'text-gray-600' },
};

// AI 점수 등급별 색상
export function getAiScoreColor(score: number) {
  if (score >= 80) return { bg: 'bg-red-100',    text: 'text-red-700',    label: '긴급' };
  if (score >= 60) return { bg: 'bg-orange-100', text: 'text-orange-700', label: '주의' };
  if (score >= 40) return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '관찰' };
  return                   { bg: 'bg-green-100',  text: 'text-green-700',  label: '낮음' };
}
```

### 5.3 데이터 매핑 (`src/app/(main)/airline/page.tsx`)

Callsign → Incident 변환 시 AI 필드 매핑:
```typescript
aiScore: cs.ai_score ?? cs.aiScore ?? null,
aiReason: cs.ai_reason ?? cs.aiReason ?? null,
reasonType: cs.reason_type ?? cs.reasonType ?? null,
```

### 5.4 UI 변경 - 발생현황 카드 (`AirlineOccurrenceTab.tsx`)

#### 카드 내 AI 분석 영역
정보 테이블(`발생일수 | 최근발생 | 유사성 | 오류가능성`) 바로 아래, 오류유형 위에 표시.
AI 데이터가 없는 쌍은 영역 자체가 숨겨짐 (`incident.aiScore != null` 조건).

```
┌─ 카드 ─────────────────────────────────┐
│ [KAL887] ↔ [ESR887]     [조치등록]     │
│ 발생일수: 5  최근: 03-08  유사성  위험도│
│                                        │
│ ┌─ AI 분석 ──────────────────────────┐ │
│ │ [AI 92점] [편명번호 동일]          │ │
│ │ "편명번호 887이 완전 동일합니다.   │ │
│ │  이스타항공과 대한항공이 같은 번호를│ │
│ │  사용하면 관제지시 혼동 위험이..."  │ │
│ └────────────────────────────────────┘ │
│                                        │
│ [관제사오류 3건] [조종사오류 2건]       │
│ 03-01 09:30 | 03-03 14:20 | ...        │
└────────────────────────────────────────┘
```

- **점수 배지**: `AI {점수}점` - 등급별 색상 (`getAiScoreColor`)
- **유형 배지**: reason_type 한글 라벨 - 유형별 색상 (`REASON_TYPE_CONFIG`)
- **사유 텍스트**: 기본 2줄 표시 (`line-clamp-2`), 호버 시 전체 펼침

#### 뱃지 색상 기준
| 점수 | 배경색 | 텍스트색 | 라벨 |
|------|--------|----------|------|
| 80~100 | `bg-red-100` | `text-red-700` | 긴급 |
| 60~79 | `bg-orange-100` | `text-orange-700` | 주의 |
| 40~59 | `bg-yellow-100` | `text-yellow-700` | 관찰 |
| 1~39 | `bg-green-100` | `text-green-700` | 낮음 |
| 미분석 | 표시 없음 | - | - |

### 5.5 정렬 옵션 추가

#### 변경된 정렬 드롭다운 (`IncidentFilters.tsx`)
```
우선순위순 | AI분석순 | 최신순 | 발생건수순 | 오류가능성순
           ^^^^^^^^ 신규 추가
```

#### AI 분석순 정렬 로직 (`AirlineOccurrenceTab.tsx`)
```typescript
// ai_score 정렬: 높은 점수 → 낮은 점수, 동점 시 발생건수 내림차순
case 'ai_score':
  scoreA = a.aiScore ?? 0;
  scoreB = b.aiScore ?? 0;
  if (scoreB !== scoreA) return scoreB - scoreA;
  return (b.count || 0) - (a.count || 0);
```

### 5.6 reason_type 필터 버튼

오류유형 통계 바와 필터 바 사이에 위치. AI 데이터가 있는 경우에만 표시.

```
┌─ AI 혼동 유형별 필터 ────────────────────────────────┐
│ [전체 44] [편명번호 동일 12] [항공사코드 유사 8]     │
│ [숫자 전치 5] [발음 혼동 3] [숫자 겹침 10] ...       │
└──────────────────────────────────────────────────────┘
```

- 버튼 클릭 시 해당 유형만 필터링 (토글)
- 각 버튼에 건수 표시
- 활성화 시 해당 유형의 `REASON_TYPE_CONFIG` 색상 적용

---

## 6. 프론트엔드 변경 - 관리자 페이지 (미구현)

### 6.1 API 변경 (`GET /api/admin/occurrences`)
- 기존 callsigns 쿼리에 `callsign_ai_analysis` LEFT JOIN 추가
- 응답에 `ai_score`, `ai_reason`, `reason_type` 필드 추가

### 6.2 UI 변경 (`AdminOccurrenceTab.tsx`)
- 항공사 페이지와 동일한 AI 분석 영역 추가
- AI 정렬 옵션 추가
- reason_type 필터 추가

---

## 7. 파일 변경 목록

### 구현 완료 (2026-03-12)

| 파일 | 작업 | 설명 |
|------|------|------|
| `scripts/migrations/006_ai_analysis.sql` | CREATE | 테이블 생성 DDL + 인덱스 3개 |
| `docs/01-plan/ai-analysis-prompt.md` | CREATE | 재사용 가능한 AI 분석 프롬프트 |
| `src/app/api/airlines/[airlineId]/callsigns/route.ts` | MODIFY | LEFT JOIN 추가, AI 필드 응답 |
| `src/types/action.ts` | MODIFY | Callsign에 AI 필드 6개 추가 |
| `src/types/airline.ts` | MODIFY | Incident에 AI 필드 3개 + REASON_TYPE_CONFIG + getAiScoreColor |
| `src/app/(main)/airline/page.tsx` | MODIFY | AI 필드 매핑 (Callsign → Incident) |
| `src/components/airline/tabs/AirlineOccurrenceTab.tsx` | MODIFY | AI 분석 영역 + 정렬 + 필터 |
| `src/components/airline/tabs/IncidentFilters.tsx` | MODIFY | "AI분석순" 정렬 옵션 추가 |

### 미구현

| 파일 | 작업 | 설명 |
|------|------|------|
| `src/app/api/admin/occurrences/route.ts` | MODIFY | 관리자 API에 LEFT JOIN 추가 |
| `src/components/admin/callsign-management/AdminOccurrenceTab.tsx` | MODIFY | 관리자 페이지 AI 표시 |

---

## 8. 검증 체크리스트

### DB & 데이터
- [x] Supabase에 `callsign_ai_analysis` 테이블 생성 확인
- [x] reason_type 컬럼 추가 확인
- [x] 인덱스 3개 생성 확인 (pair, score, reason_type)
- [x] Claude가 SAME_NUMBER 유형 44건 INSERT 성공 확인
- [ ] 나머지 ~992건 AI 분석 INSERT (CONTAINMENT, TRANSPOSITION 등)

### 항공사 페이지 (구현 완료)
- [x] 항공사 API 응답에 `ai_score`/`ai_reason`/`reason_type` 포함
- [x] 발생현황 카드에 AI 분석 영역 표시
- [x] AI 점수 배지 색상 (긴급/주의/관찰/낮음)
- [x] reason_type 한글 배지 (7종)
- [x] ai_reason 텍스트 (2줄 + 호버 펼침)
- [x] "AI분석순" 정렬 옵션 동작
- [x] reason_type별 필터 버튼 동작
- [x] AI 데이터 없는 쌍은 영역 미표시
- [x] TypeScript 타입 에러 없음 (신규 코드)

### 관리자 페이지 (미구현)
- [ ] 관리자 API에 LEFT JOIN 추가
- [ ] 관리자 발생현황 카드에 AI 표시
- [ ] 관리자 정렬/필터 추가
