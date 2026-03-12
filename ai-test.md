# 개발요구서: 유사호출부호 AI 분석 기능 (수동 워크플로우)

**문서번호**: KATC1-AI-001
**작성일**: 2026-03-12
**시스템**: KATC1 유사호출부호 경고시스템
**분류**: 신규 기능 개발

---

## 1. 개요

### 1.1 목적
관리자가 매달 엑셀 파일을 업로드할 때 동일한 콜사인 쌍이 반복 등장하더라도 누적 데이터를 유지하고, 데이터 변경 시 AI 재분석이 필요한 쌍을 자동으로 식별하여 수동 AI 분석 워크플로우의 정확도를 높인다.

### 1.2 배경
- 매달 엑셀 업로드 시 동일 콜사인 쌍의 공존시간, 출도착 방향이 달라질 수 있음
- 현재 구조는 재업로드 시 모든 데이터를 덮어써 검출건수 누적이 불가함
- AI 분석 결과가 최초 분석 시점 데이터에 고정되어 갱신되지 않음
- 어떤 쌍을 다시 분석해야 하는지 파악할 수 없음

### 1.3 범위
수동 워크플로우 유지 (JSON 다운로드 → AI 도구에 붙여넣기 → 결과 임포트)를 기준으로 설계하며, 자동 API 연동은 이 요구서의 범위에 포함하지 않는다.

---

## 2. 현재 시스템 문제점

| 번호 | 문제 | 영향 |
|------|------|------|
| P-01 | 재업로드 시 `occurrence_count` 덮어쓰기 | 누적 검출건수 소실 |
| P-02 | AI 분석이 최초 1회만 실행 | 데이터 변경 반영 불가 |
| P-03 | 미분석 목록이 신규만 표시 | 재분석 필요 쌍 식별 불가 |
| P-04 | 내보내기 JSON에 공존시간·방향 미포함 | AI 채점 정확도 저하 |
| P-05 | AI 분석 결과문에 구체적 노선 하드코딩 | 노선 변경 시 결과문 오류 |

---

## 3. 기능 요구사항

### 3.1 검출건수 누적 관리 (FR-01)

**요구사항**
재업로드 시 `callsigns` 테이블의 `occurrence_count` 필드를 기존 값에 누적하여 증가시킨다.

**현재 동작**
동일 `(airline_code, callsign_pair)` 재업로드 시 → 기존 값을 새 엑셀 값으로 덮어씀

**요구 동작**
동일 `(airline_code, callsign_pair)` 재업로드 시 → 기존 값에 새 엑셀 값을 합산하여 저장

**예시**
```
1월 업로드: AAR105|TWB105, occurrence_count = 3  → DB: 3
2월 업로드: AAR105|TWB105, occurrence_count = 2  → DB: 5 (누적)
3월 업로드: AAR105|TWB105, occurrence_count = 4  → DB: 9 (누적)
```

---

### 3.2 AI 분석 데이터 스냅샷 저장 (FR-02)

**요구사항**
AI 분석 결과 임포트 시, 분석에 사용된 데이터의 핵심 값을 `callsign_ai_analysis` 테이블에 함께 저장한다.

**저장 항목**

| 필드명 | 내용 |
|--------|------|
| `coexistence_snapshot` | 분석 당시 공존시간(분) |
| `occurrence_snapshot` | 분석 당시 누적 검출건수 |
| `atc_snapshot` | 분석 당시 관제사 권고사항 |

**목적**
향후 재업로드 시 현재 데이터와 스냅샷을 비교하여 재분석 필요 여부를 자동 판단하는 데 활용

---

### 3.3 재분석 필요 자동 감지 (FR-03)

**요구사항**
엑셀 재업로드 시, 이미 AI 분석이 완료된 콜사인 쌍에 대해 데이터 변경 여부를 자동으로 감지하고 재분석 필요 여부를 표시한다.

**감지 조건** (하나 이상 해당 시 재분석 필요 표시)
- 공존시간(`coexistence_minutes`)이 스냅샷 값과 다른 경우
- 관제사 권고사항(`atc_recommendation`)이 스냅샷 값과 다른 경우

**표시 방법**
`callsign_ai_analysis` 테이블의 `needs_reanalysis` 플래그를 `TRUE`로 자동 변경

**초기화**
AI 분석 결과를 임포트하면 해당 쌍의 `needs_reanalysis` 플래그를 `FALSE`로 초기화

---

### 3.4 미분석 목록 2카테고리 분리 (FR-04)

**요구사항**
관리자 AI 분석 탭의 미분석 목록을 아래 두 가지 카테고리로 분리하여 표시한다.

| 카테고리 | 조건 | UI 표시 |
|----------|------|---------|
| 신규 | AI 분석 기록 없음 | 파란색 배지 "신규" |
| 데이터변경 | AI 분석 있으나 `needs_reanalysis = TRUE` | 주황색 배지 "데이터변경" + 이전 점수 표시 |

**헤더 카운트 표시 예시**
```
신규 3건  |  데이터변경 5건
```

**목록 표시 항목** (각 쌍별)
- 카테고리 배지
- 콜사인 쌍
- 입항/출항 방향 (편명별)
- 공존시간 구분 (짧음/길어)
- 누적 검출건수
- 이전 AI 점수 (데이터변경 카테고리만)

---

### 3.5 내보내기 JSON 데이터 강화 (FR-05)

**요구사항**
분석요청 JSON 내보내기 시 각 콜사인 쌍에 아래 필드를 포함한다.

**pairs 배열 각 항목 필드**

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `pair` | string | 콜사인 쌍 (예: "AAR105 \| TWB105") |
| `category` | "new" \| "stale" | 신규 또는 재분석 |
| `previous_score` | number \| null | 이전 AI 점수 (신규는 null) |
| `direction_a` | "입항" \| "출항" | 첫 번째 편명 방향 |
| `direction_b` | "입항" \| "출항" | 두 번째 편명 방향 |
| `coexistence_level` | "short" \| "long" | 짧음(5분 미만) / 길어(5분 이상) |
| `total_occurrences` | number | 누적 검출건수 |
| `traffic_level` | "혼잡" \| "보통" \| "여유" | 발생 당시 섹터 동시관제량 구분 |
| `atc_recommendation` | string \| null | 관제사 권고사항 |

**방향 판별 기준**
도착 공항 ICAO 코드가 `RK`로 시작하면 입항, 출발 공항이 `RK`로 시작하면 출항

**공존시간 구분 기준**
- 5분 미만: `"short"`
- 5분 이상: `"long"`

**동시관제량 구분 기준** (출처: 엑셀 `max_concurrent_traffic` 컬럼 — 발생 당시 섹터 내 항공기 수 기록값)
- 15대 이상: `"혼잡"`
- 10~14대: `"보통"`
- 9대 이하: `"여유"`

---

### 3.6 AI 프롬프트 규칙 업데이트 (FR-06)

**요구사항**
내보내기 JSON의 AI 채점 규칙에 신규 필드 활용 지침을 추가한다.

**추가 규칙 내용**

```
- direction_a / direction_b: 각 편명의 입항/출항 방향
  동일 방향(둘 다 입항 또는 둘 다 출항)이면 동시 관제 교신 가능성이 높아 위험도 가산

- coexistence_level "long" (5분 이상): 위험 노출 빈도 높음, 위험도 가산
  coexistence_level "short" (5분 미만): 출발·도착 집중 구간에 한정된 위험

- total_occurrences: 누적 검출건수. 10건 이상이면 반복적 위험으로 위험도 가산

- traffic_level: 발생 당시 섹터 동시관제량 구분 (엑셀 기록값 기준)
  "혼잡" (15대 이상): 관제사 업무 부하가 높은 상황에서 발생 → 위험도 대폭 가산
  "보통" (10~14대): 일반적 관제 환경
  "여유" (9대 이하): 관제 여유 있음, 위험도 일부 감산 가능

- category "stale": 이전 분석 후 데이터 변경됨.
  previous_score를 참고하되 현재 데이터 기준으로 재채점

- atc_recommendation "즉시조치": 이미 관제 위험으로 공식 인정된 쌍. 점수 하한 70점

- ai_reason 작성 원칙:
  · 구체적 공항명·노선명 기재 금지 (출도착은 "입항"/"출항"으로만 표현)
  · 공존시간 수치 기재 금지 ("짧은 공존 구간" / "긴 시간 공존"으로 표현)
  · 문장 수: 3문장 이내
```

---

## 4. 비기능 요구사항

| 번호 | 항목 | 내용 |
|------|------|------|
| NFR-01 | 하위 호환성 | 기존 임포트된 AI 분석 데이터 유지, 스냅샷 컬럼은 NULL 허용 |
| NFR-02 | 성능 | 업로드 처리 시간에 needs_reanalysis 감지 추가로 인한 지연 1초 이내 |
| NFR-03 | 데이터 무결성 | occurrence_count 누적 시 음수 불가 조건 유지 |
| NFR-04 | UI 일관성 | 기존 AI 분석 탭 레이아웃 유지, 카테고리 배지만 추가 |

---

## 5. 데이터베이스 변경 사항

### 5.1 신규 마이그레이션 파일
`scripts/migrations/007_ai_reanalysis.sql`

### 5.2 변경 대상 테이블

**`callsign_ai_analysis` 테이블 — 컬럼 추가**

| 컬럼명 | 타입 | 기본값 | 설명 |
|--------|------|--------|------|
| `coexistence_snapshot` | INT | NULL | 분석 당시 공존시간 |
| `occurrence_snapshot` | INT | NULL | 분석 당시 누적 검출건수 |
| `atc_snapshot` | VARCHAR(50) | NULL | 분석 당시 관제 권고 |
| `needs_reanalysis` | BOOLEAN | FALSE | 재분석 필요 여부 |

**`callsigns` 테이블 — 구조 변경 없음**
`occurrence_count` 누적은 UPSERT 쿼리 로직 변경으로 처리

---

## 6. 영향받는 파일

| 파일 경로 | 변경 내용 |
|-----------|---------|
| `scripts/migrations/007_ai_reanalysis.sql` | 신규 생성 |
| `src/app/api/admin/upload-callsigns/route.ts` | occurrence_count 누적 + needs_reanalysis 감지 |
| `src/app/api/admin/ai-analysis/pending/route.ts` | 2카테고리 쿼리 + 방향·공존시간 필드 |
| `src/app/api/admin/ai-analysis/export/route.ts` | pairs 구조 변경 + 프롬프트 규칙 추가 |
| `src/app/api/admin/database/import` (route.ts) | 임포트 시 스냅샷 저장 + needs_reanalysis 리셋 |
| `src/components/callsign-management/uploads/AiAnalysisTab.tsx` | 카테고리 배지 UI + 카운트 분리 |

---

## 7. 수동 AI 분석 워크플로우 (개선 후)

```
[1단계] 엑셀 업로드
  └─ occurrence_count 누적 저장
  └─ 기존 AI 분석 쌍은 데이터 변경 여부 자동 감지

[2단계] AI 분석 탭 확인
  └─ 신규 N건 | 데이터변경 M건 표시
  └─ 각 쌍의 방향, 공존시간 구분, 이전 점수 확인

[3단계] JSON 다운로드
  └─ direction_a/b, coexistence_level, category 포함된 JSON

[4단계] AI 도구에 붙여넣기 (Claude, GPT, Gemini 등)
  └─ 개선된 프롬프트 규칙으로 일관된 결과 생성
  └─ 방향·공존시간 기반 위험도 반영된 결과문 출력

[5단계] 결과 임포트
  └─ AI 점수·결과문 DB 저장
  └─ 스냅샷 갱신 + needs_reanalysis = FALSE 초기화
```

---

## 8. 검증 시나리오

| 번호 | 시나리오 | 기대 결과 |
|------|---------|---------|
| V-01 | 동일 엑셀 2회 업로드 | occurrence_count가 2배로 누적됨 |
| V-02 | 업로드 후 pending 목록 조회 | "신규"/"데이터변경" 카테고리 분리 표시 |
| V-03 | 내보내기 JSON 확인 | direction_a/b, coexistence_level, category 필드 존재 |
| V-04 | AI 결과 임포트 | needs_reanalysis = FALSE, 스냅샷 저장 확인 |
| V-05 | 임포트 후 pending 목록 | 임포트한 쌍이 목록에서 사라짐 |
| V-06 | 재업로드(데이터 변경) 후 | 해당 쌍이 "데이터변경" 카테고리로 재등장 |

---

*문서 끝*
