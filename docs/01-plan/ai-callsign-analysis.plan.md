# 기능 설계서: AI 유사호출부호 우선순위 분석

> 작성일: 2026-03-11
> 상태: 설계 완료 / 구현 대기

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
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_by TEXT DEFAULT 'claude'
);

CREATE INDEX idx_ai_analysis_pair ON callsign_ai_analysis(callsign_pair);
CREATE INDEX idx_ai_analysis_score ON callsign_ai_analysis(ai_score DESC);
```

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | SERIAL PK | 자동 증가 ID |
| `callsign_pair` | TEXT UNIQUE | 호출부호 쌍 ("ESR887 \| KAL887") |
| `ai_score` | INT (1~100) | AI 우선순위 점수 |
| `ai_reason` | TEXT | 항공사 설득용 조치 근거 (2~3문장) |
| `analyzed_at` | TIMESTAMPTZ | 분석 일시 |
| `analyzed_by` | TEXT | 분석 주체 (기본값: 'claude') |

### 2.2 기존 테이블 변경: 없음
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

## 5. 프론트엔드 변경

### 5.1 API 변경 (`GET /api/admin/occurrences`)
- 기존 callsigns 쿼리에 `callsign_ai_analysis` LEFT JOIN 추가
- 응답에 `ai_score`, `ai_reason` 필드 추가

### 5.2 UI 변경 (`AdminOccurrenceTab.tsx`)

#### 정렬 옵션 추가
```
기존: 우선순위 | 위험도 | 발생건수 | 최근발생
추가: AI 우선순위  ← ai_score 내림차순
```

#### 카드 내 AI 뱃지 표시
```
┌──────────────────────────────────────┐
│ ESR887  ↔  KAL887       ✓ 조치완료  │
│ 이스타항공 (ESR)                      │
│                                      │
│ 발생일수  최근발생  유사성  오류가능성 │
│ 3일      03.07.   매우높음  매우높음  │
│                                      │
│ 🤖 AI 긴급 (88점)                    │  ← 새로 추가
│ 편명번호 887이 완전 동일합니다...     │  ← reason 표시
└──────────────────────────────────────┘
```

#### 뱃지 색상 기준
| 점수 | 색상 | 라벨 |
|------|------|------|
| 80~100 | 빨강 (`bg-rose-100`) | AI 긴급 (92점) |
| 60~79 | 주황 (`bg-orange-100`) | AI 주의 (67점) |
| 40~59 | 노랑 (`bg-amber-100`) | AI 관찰 (48점) |
| 1~39 | 회색 (`bg-gray-100`) | AI 낮음 (23점) |
| 미분석 | 표시 없음 | - |

---

## 6. 파일 변경 목록

| 파일 | 작업 | 설명 |
|------|------|------|
| `scripts/migrations/006_ai_analysis.sql` | CREATE | 테이블 생성 SQL |
| `src/app/api/admin/occurrences/route.ts` | MODIFY | LEFT JOIN 추가 |
| `src/components/admin/callsign-management/AdminOccurrenceTab.tsx` | MODIFY | 정렬/뱃지 UI |

---

## 7. 검증 체크리스트

- [ ] Supabase에 `callsign_ai_analysis` 테이블 생성 확인
- [ ] Claude가 분석 데이터 INSERT 성공 확인
- [ ] 발생현황 API 응답에 `ai_score`/`ai_reason` 포함 확인
- [ ] "AI 우선순위" 정렬 동작 확인
- [ ] AI 뱃지 + reason 표시 확인
- [ ] 미분석 건은 뱃지 미표시 확인
- [ ] `npm run build` 성공
