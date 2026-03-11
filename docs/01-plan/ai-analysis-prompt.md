# AI 유사호출부호 분석 프롬프트

> 새 엑셀 업로드 후 callsign_ai_analysis 테이블에 일관된 분석 결과를 넣기 위한 프롬프트
> 이 프롬프트를 Claude Code에 전달하면 동일한 기준으로 분석합니다.

---

## 사용법

새 엑셀 데이터 업로드 후 아래 프롬프트를 복사하여 Claude Code에 입력:

---

## 프롬프트

```
callsigns 테이블에서 callsign_ai_analysis에 아직 없는 새 콜사인 쌍을 찾아서 AI 분석을 수행하고 INSERT해줘.

### 분석 대상 조회 SQL
SELECT
  COALESCE(c.callsign_a || ' | ' || c.callsign_b, c.callsign_pair) AS pair,
  c.occurrence_count,
  c.similarity,
  c.risk_level,
  c.airline_a_code,
  c.airline_b_code
FROM callsigns c
LEFT JOIN callsign_ai_analysis ai
  ON ai.callsign_pair = COALESCE(c.callsign_a || ' | ' || c.callsign_b, c.callsign_pair)
WHERE ai.id IS NULL
ORDER BY c.occurrence_count DESC;

### reason_type 분류 기준 (7가지)

| reason_type | 설명 | 예시 | 점수 범위 |
|-------------|------|------|-----------|
| SAME_NUMBER | 다른 항공사, 편명번호 완전 동일 | ESR887 ↔ KAL887 | 84~96 |
| CONTAINMENT | 짧은 번호가 긴 번호에 포함 | KAL126 ↔ KAL1256 | 78~88 |
| TRANSPOSITION | 숫자 자릿수 전치 | TWB301 ↔ TWB310 | 70~82 |
| SIMILAR_CODE | 항공사코드 발음 유사 + 편명 유사 | JNA301 ↔ JJA301 | 70~96 |
| DIGIT_OVERLAP | 같은 항공사, 앞/뒤 숫자 겹침 | AAR701 ↔ AAR731 | 40~68 |
| PHONETIC_DIGIT | 발음 혼동 숫자 조합 포함 | AAR135 ↔ AAR195 | 55~78 |
| LOW_RISK | 유사성 낮음 | 코드/번호 모두 다름 | 15~39 |

#### reason_type 판별 우선순위
여러 유형에 해당하면 가장 위험한 유형 하나만 선택:
SAME_NUMBER > SIMILAR_CODE > CONTAINMENT > TRANSPOSITION > PHONETIC_DIGIT > DIGIT_OVERLAP > LOW_RISK

#### SIMILAR_CODE 해당 항공사코드 쌍 (발음 유사)
- JNA ↔ JJA : "제이엔에이" ↔ "제이제이에이" (J+모음 반복)
- AAR ↔ ABL : 첫 글자 A 동일 + 3글자 코드
- AAR ↔ ASV : 첫 글자 A 동일
- AAR ↔ APZ : 첫 글자 A 동일
- ABL ↔ APZ : 첫 글자 A 동일
- ABL ↔ ASV : 첫 글자 A 동일
- ESR ↔ EOK : 첫 글자 E 동일

#### PHONETIC_DIGIT 해당 숫자 조합 (ICAO 무선교신 발음 혼동)
- 5 (Fife) ↔ 9 (Niner) : 끝 발음 유사
- 3 (Tree) ↔ 8 (Ait) : 잡음 환경에서 혼동
- 13 ↔ 30, 14 ↔ 40, 15 ↔ 50 : 십의 자리 혼동
- 0 (Zero) ↔ 4 (FOW-er) : 약한 혼동
- 1 (Wun) ↔ 9 (Niner) : 짧은 교신 시 혼동

### 분석 기준 (6가지, 우선순위순)

1. **편명번호 완전 동일** (다른 항공사) → reason_type: SAME_NUMBER
   - ESR887 ↔ KAL887 → 90~96점
   - 같은 번호를 다른 항공사가 사용하면 관제지시 대상 혼동 위험 극히 높음

2. **편명번호 포함관계** (같은 항공사) → reason_type: CONTAINMENT
   - KAL126 ↔ KAL1256 → 78~88점
   - 짧은 번호가 긴 번호에 포함되어 교신 시 혼동 가능

3. **숫자 전치(transposition)** → reason_type: TRANSPOSITION
   - TWB301 ↔ TWB310 → 70~82점
   - 끝 자릿수가 뒤바뀌어 빠른 교신 시 혼동 발생

4. **항공사코드 발음 유사** (다른 항공사) → reason_type: SIMILAR_CODE
   - JNA ↔ JJA → +5~10점 가산
   - AAR ↔ ABL (첫 글자 A 동일) → +3~5점 가산
   - SAME_NUMBER와 겹치면 SAME_NUMBER 우선

5. **같은 항공사 내 높음 유사도** → reason_type: DIGIT_OVERLAP
   - 매뉴얼 유사도 "높음" + risk_level "높음" → 65~78점
   - 매뉴얼 유사도 "높음" + risk_level "낮음" → 50~68점
   - 매뉴얼 유사도 "높음" + risk_level "매우낮음" → 40~55점

6. **낮은 유사도 쌍** → reason_type: LOW_RISK
   - 매뉴얼 "매우낮음" 또는 "정의되지 않음" → 15~35점
   - 항공사코드와 편명번호 모두 차이가 큰 경우

### 점수 산출 가이드

| 점수 범위 | 등급 | 조건 |
|-----------|------|------|
| 80~100 | 긴급 | 편명 동일(다른 항공사) + 발음유사 코드 또는 고빈도 |
| 60~79 | 주의 | 편명 동일(같은 항공사 포함) 또는 전치 + 중빈도 |
| 40~59 | 관찰 | 부분 유사 + 저빈도 |
| 1~39 | 낮음 | 유사성 낮음 |

빈도(occurrence_count)는 점수 산출의 가중치로만 사용.
동일 조건이면 빈도가 높을수록 +3~8점 가산.

### 매뉴얼 점수 참고 규칙
- similarity(유사도)와 risk_level(오류발생가능성)은 매뉴얼 기반 정량 평가 결과임
- AI는 이 값을 참고하되, 음성적/시각적 특성을 종합하여 독자적으로 재평가
- 매뉴얼에서 "매우낮음"이더라도 AI 판단으로 위험하면 상향 조정 가능
- 매뉴얼에서 "매우높음"이더라도 실제 혼동 가능성이 낮으면 하향 조정 가능

### ai_reason 작성 규칙 (필수 준수)

1. **횟수/빈도 절대 언급 금지**
   - ❌ "5회 반복 발생으로..."
   - ❌ "다수 발생하여..."
   - ✅ 콜사인 쌍 자체의 위험 특성만 서술

2. **구체적 근거 포함** (2~3문장)
   - 어떤 숫자/문자가 동일하거나 유사한지 명시
   - 왜 관제사가 혼동할 수 있는지 설명
   - 항공사에 전달할 수 있는 납득 가능한 표현 사용

3. **유형별 reason 작성 예시**

   SAME_NUMBER:
   - "편명번호 887이 완전 동일합니다. 이스타항공과 대한항공이 같은 번호를 사용하면 관제사가 항공사코드를 놓쳤을 때 즉시 혼동이 발생합니다."

   CONTAINMENT:
   - "KAL126과 KAL1256은 짧은 편명이 긴 편명에 완전히 포함되어 있어, 교신 시 뒷자리를 놓치면 동일한 편명으로 인식될 위험이 있습니다."

   TRANSPOSITION:
   - "같은 항공사(TWB)에서 301과 310은 끝 두 자리가 전치되어 있어 빠른 교신 시 혼동 가능성이 높습니다."

   SIMILAR_CODE:
   - "JNA와 JJA는 항공사코드 발음이 매우 유사하며, 편명번호 301도 동일하여 관제사가 혼동할 위험이 극히 높습니다."

   DIGIT_OVERLAP:
   - "같은 항공사(AAR)에서 701과 731은 첫째·셋째 자리가 동일하고 가운데 자릿수만 다릅니다. 빠른 교신 환경에서 숫자 하나의 차이는 오청취를 유발할 수 있습니다."

   PHONETIC_DIGIT:
   - "편명번호 135와 195는 가운데 숫자 3과 9가 ICAO 무선교신에서 'Tree'와 'Niner'로 발음되어 잡음 환경에서 혼동될 수 있습니다."

   LOW_RISK:
   - "항공사코드와 편명번호 모두 차이가 있어 혼동 위험은 낮습니다. 다만 동시 운항 시 주의가 필요합니다."

### INSERT 형식

INSERT INTO callsign_ai_analysis (callsign_pair, ai_score, ai_reason, reason_type)
VALUES ('콜사인A | 콜사인B', 점수, '근거', 'SAME_NUMBER')
ON CONFLICT (callsign_pair) DO NOTHING;

- callsign_pair는 callsigns 테이블의 "callsign_a | callsign_b" 형식과 정확히 일치
- reason_type은 7가지 중 하나 (SAME_NUMBER, CONTAINMENT, TRANSPOSITION, SIMILAR_CODE, DIGIT_OVERLAP, PHONETIC_DIGIT, LOW_RISK)
- 한 번에 50~100건씩 배치 INSERT
- ON CONFLICT로 중복 방지
```

---

## 전체 재분석 프롬프트

기존 분석 결과를 전부 삭제하고 새로 분석할 때:

```
callsign_ai_analysis 테이블을 전체 DELETE하고,
callsigns 테이블의 모든 쌍을 위 기준으로 재분석하여 INSERT해줘.
reason_type도 반드시 포함해서 넣어줘.
```

---

## 특정 쌍만 재분석 프롬프트

```
callsign_ai_analysis에서 아래 쌍만 DELETE 후 재분석해줘:
- ESR887 | KAL887
- JNA038 | TWB038
reason_type도 반드시 포함해서 넣어줘.
```

---

## 유형별 통계 확인 프롬프트

```
callsign_ai_analysis의 reason_type별 건수와 평균 점수를 보여줘.
```
