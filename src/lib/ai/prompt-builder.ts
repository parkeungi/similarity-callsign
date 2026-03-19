// AI 분석 프롬프트 JSON 생성 (export, auto 라우트 공유)
import { ProcessedPair } from './fetch-pending-pairs';

export interface AnalysisPromptData {
  meta: { exportedAt: string; system: string; version: string };
  prompt: Record<string, unknown>;
  data: { totalCount: number; pairs: ProcessedPair[] };
}

/**
 * 미분석 쌍 데이터로부터 AI 분석요청 프롬프트 JSON을 생성
 */
export function buildAnalysisPrompt(pairs: ProcessedPair[]): AnalysisPromptData {
  return {
    meta: {
      exportedAt: new Date().toISOString(),
      system: '유사호출부호 공유시스템',
      version: '4.0',
    },
    prompt: {
      instruction: [
        '아래 콜사인 쌍(pairs)의 관제 혼동 위험도를 분석하여 JSON 형식으로 결과를 출력하세요.',
        '',
        '이 데이터는 항공관제 현장에서 수집된 실제 유사호출부호 검출 기록입니다.',
        '모든 쌍은 이미 유사도 검출 시스템에서 "높음" 또는 "매우높음" 위험도로 분류된 고위험 쌍입니다.',
        '따라서 ai_score는 반드시 50점 이상이어야 합니다. 50점 미만의 점수는 절대 부여하지 마세요.',
        '당신의 역할은 같은 위험등급 내에서 어떤 쌍이 더 우선 조치가 필요한지',
        '50~100점 범위로 세분화하여 우선순위를 매기는 것입니다.',
      ].join('\n'),

      operationalContext: {
        description: '관제 현장 맥락 (채점 시 반드시 참고)',
        details: [
          'traffic_level이 "혼잡"인 상황은 관제사의 업무 부하가 극도로 높은 상태로,',
          '유사호출부호를 인지하고 구별할 여유가 부족합니다.',
          'traffic_level이 "보통"인 상황에서도 유사호출부호 혼동은 발생할 수 있습니다.',
          '',
          'error_type이 NULL인 것은 "안전했다"는 뜻이 아닙니다.',
          '관제가 많은 상황에서는 보고서를 작성할 물리적 시간이 없어,',
          '오류가 발생했더라도 기록되지 않았을 가능성이 높습니다.',
          '따라서 error_type=NULL + traffic_level="혼잡" 조합은',
          '"미보고 위험"으로 간주하여 위험도를 가산해야 합니다.',
          '',
          '이 맥락을 ai_reason에도 반영하여,',
          '항공사 담당자가 관제 현장의 어려움을 이해할 수 있도록 작성하세요.',
          '',
          '⚠️ 중요: ai_reason에 구체적 관제 항공기 대수를 언급하지 마세요.',
          '"관제가 많은 상황" / "관제 부하가 높은 환경" 등 정성적 표현만 사용하세요.',
        ],
      },

      scoringMethod: {
        description: '기본점수 + 가감점 방식 (Base Score + Adjustment)',
        importantNote: '⚠️ 이 데이터의 모든 콜사인 쌍은 유사도 검출 시스템에서 이미 "높음" 이상으로 분류된 고위험 쌍입니다. 따라서 최종 점수는 반드시 50점 이상이어야 합니다. 50점 미만의 점수는 절대 부여하지 마세요.',
        baseScoreByReasonType: {
          SAME_NUMBER: { base: 85, range: '85~100', description: '다른 항공사, 편명번호 완전 동일 (예: ESR887 ↔ KAL887)' },
          PHONETIC_DIGIT: { base: 75, range: '75~95', description: '발음 혼동 숫자 조합 포함 (예: 5↔9, 3↔8, 13↔30). phoneticConfusion 테이블과 대조하여 해당 쌍이 존재하면 반드시 선택' },
          CONTAINMENT: { base: 70, range: '70~92', description: '짧은 번호가 긴 번호에 포함 (예: KAL126 ↔ KAL1256)' },
          TRANSPOSITION: { base: 65, range: '65~88', description: '숫자 자릿수 전치 (예: TWB301 ↔ TWB310)' },
          SIMILAR_CODE: { base: 65, range: '65~88', description: '항공사코드 발음 유사 + 편명 유사 (예: JNA301 ↔ JJA301)' },
          DIGIT_OVERLAP: { base: 60, range: '60~85', description: '같은 항공사, 앞/뒤 숫자 겹침 (예: AAR701 ↔ AAR731)' },
          OTHER: { base: 55, range: '50~70', description: '위 유형에 정확히 해당하지 않으나, 검출 시스템이 유사하다고 판단한 쌍. 이미 고위험 분류이므로 50점 미만 금지' },
        },
        adjustments: [
          { factor: 'error_type 존재 (실제 오류 이력)', points: '+10~20' },
          { factor: 'sub_error 심각도 (subErrorScoring 참조)', points: '+5~15 (중첩 가산)' },
          { factor: 'error_rate 높음 (errorRateCalculation 참조)', points: '+5~10' },
          { factor: 'traffic_level="혼잡"', points: '+3~7' },
          { factor: 'error_type=NULL + traffic_level="혼잡" (미보고 위험)', points: '+3~7' },
          { factor: 'coexistence_level="long"', points: '+2~5' },
          { factor: 'total_occurrences ≥ 10 (반복 검출)', points: '+2~5' },
          { factor: 'direction 동일 (동시 교신 가능)', points: '+2~4' },
          { factor: 'atc_recommendation="즉시조치"', points: '하한 80점 보장' },
          { factor: 'same_airline_code="일치"', points: '+2~5 (관제 지시 뒤바뀜 위험)' },
          { factor: 'same_number_ratio ≥ 0.5', points: '+2~4' },
          { factor: 'traffic_level="여유"', points: '-2~4 (단, 50점 미만으로 내려가지 않음)' },
          { factor: 'total_occurrences ≤ 3 (산발적)', points: '-1~3 (단, 50점 미만으로 내려가지 않음)' },
          { factor: 'coexistence_level="short"', points: '-1~3 (단, 50점 미만으로 내려가지 않음)' },
        ],
        process: '① reason_type 결정 → ② base score 확인 → ③ adjustments 합산 → ④ 최소 50점 하한 클램핑 → ⑤ 분포 제약 확인',
      },

      reasonTypePriority: {
        description: 'reason_type 선택 우선순위 (복수 해당 시 상위 우선)',
        priority: [
          '1. SAME_NUMBER — 서로 다른 항공사 간 편명번호(숫자부분)가 완전 동일 (예: ESR887 ↔ KAL887)',
          '2. PHONETIC_DIGIT — phoneticConfusion 테이블의 발음혼동 숫자쌍이 편명에 포함 (SAME_NUMBER보다 후순위)',
          '3. CONTAINMENT — 짧은 편명번호가 긴 편명번호에 완전 포함 (예: KAL126 ↔ KAL1256, 126이 1256에 포함)',
          '4. TRANSPOSITION — 숫자 자릿수의 순서가 뒤바뀐 관계 (예: 89↔98, 12↔21). ⚠️ 단순히 마지막 숫자 1개가 다른 연속번호(1548↔1549)는 TRANSPOSITION이 아니라 DIGIT_OVERLAP',
          '5. SIMILAR_CODE — 서로 다른 항공사 간 항공사코드 발음이 유사하면서 편명도 유사 (예: JNA↔JJA). ⚠️ 같은 항공사 내 편명 비교는 SIMILAR_CODE가 아니라 DIGIT_OVERLAP',
          '6. DIGIT_OVERLAP — 같은 항공사 내에서 편명 숫자 일부가 겹침 (예: AAR701↔AAR731). 연속번호, 숫자 1개 차이 등 포함',
          '7. OTHER — 위 어느 것에도 해당하지 않을 때만 (50점 이상 필수)',
        ],
        phoneticDigitDetection: [
          'pair에서 두 편명의 숫자부분을 추출하여 phoneticConfusion.pairs와 대조합니다.',
          '예: AAR059 ↔ AAR095 → 숫자 059 vs 095 → 5↔9 포함 → PHONETIC_DIGIT',
          '예: KAL130 ↔ KAL300 → 숫자 130 vs 300 → 13↔30 포함 → PHONETIC_DIGIT',
          '단, SAME_NUMBER 조건이 먼저 충족되면 SAME_NUMBER를 선택합니다.',
        ],
      },

      scoreDistribution: {
        description: '점수 분포 제약 (변별력 확보 목적)',
        constraints: [
          '⚠️ 최소 점수: 50점 (모든 쌍은 이미 고위험 분류이므로 50점 미만 절대 금지)',
          '100점: 전체 쌍의 최대 3건까지만 허용',
          '동일 점수: 최대 3건까지만 허용 (4건 이상 동점 금지)',
          '점수 간격: 인접 순위 간 최소 1점 이상 차이 권장',
          '분포 목표: 전체 쌍이 50~100점 범위에 고르게 분산되도록 채점',
        ],
        guidance: '같은 reason_type이라도 adjustments 요소의 조합이 다르면 반드시 다른 점수를 부여하세요.',
      },

      subErrorScoring: {
        description: 'sub_error 유형별 가산점 (error_type 존재 시 중첩 적용)',
        tiers: [
          { sub_error: '동시응답', points: '+15', severity: '최고 — 두 조종사가 동시에 응답하여 관제 지시 혼선' },
          { sub_error: '오인응답감시실패', points: '+12', severity: '높음 — 다른 항공기 호출에 잘못 응답 + 관제사 미감지' },
          { sub_error: '호출부호발신오류', points: '+10', severity: '중간 — 조종사가 자신의 호출부호를 잘못 발신' },
          { sub_error: '무응답', points: '+7', severity: '주의 — 호출에 응답하지 않음 (혼동으로 자기 호출 미인지)' },
          { sub_error: '기타', points: '+5', severity: '기본 — 기타 오류 유형' },
        ],
      },

      errorRateCalculation: {
        description: '오류 발생 비율 해석 기준',
        formula: 'error_rate = error_occurrences / total_occurrences',
        interpretation: [
          'error_rate ≥ 0.3 (30% 이상): 매우 높음 → +10점',
          'error_rate ≥ 0.15 (15% 이상): 높음 → +7점',
          'error_rate ≥ 0.05 (5% 이상): 보통 → +3점',
          'error_rate < 0.05 또는 error_occurrences=0: 가산 없음',
        ],
      },

      analysisRules: [
        '=== 참고 규칙 (위 구조화된 섹션 보완) ===',
        '',
        '1. error_probability (엑셀 기반 오류발생가능성 점수, 0~100):',
        '   - 이 점수는 참고용이며 ai_score와 동일하지 않음',
        '   - 70 이상이면 위험도 가산, 50 미만이면 감산 가능',
        '',
        '2. direction_a / direction_b (입항/출항/국내선):',
        '   - 동일 방향(둘 다 입항 또는 둘 다 출항)이면 동시 관제 교신 가능성이 높아 위험도 가산',
        '   - 국내선끼리도 동시 교신 가능성 있음',
        '',
        '3. similarity / same_airline_code / same_number_ratio (편명 유사도):',
        '   - similarity "매우높음": 기본 위험도 높게 시작',
        '   - same_airline_code "일치": 같은 항공사 내 혼동 → 관제 지시가 완전히 뒤바뀔 수 있어 더 위험',
        '   - same_number_ratio 50% 이상: 숫자 구성이 절반 이상 동일, 빠른 교신에서 구별 어려움',
        '',
        '4. category (분석 카테고리):',
        '   - "stale": 이전 분석 후 데이터 변경됨. previous_score를 참고하되 현재 데이터 기준으로 재채점',
      ],

      aiReasonRules: {
        description: 'ai_reason 작성 원칙 (필수 준수)',
        constraints: [
          '정확히 3문장으로 작성 (2문장 이하 금지)',
          '구체적 공항명·노선명 기재 금지 (출도착은 "입항"/"출항"으로만 표현)',
          '공존시간 수치 기재 금지 ("짧은 공존 구간" / "긴 시간 공존"으로 표현)',
          '관제 항공기 대수, 검출 건수, 점수 등 구체적 숫자 일체 기재 금지',
          '"관제가 많은 상황" / "관제 부하가 높은 환경" 등 정성적 표현만 사용',
          '⛔ 시스템 내부 변수명(error_probability, total_occurrences, same_number_ratio 등) 절대 노출 금지',
          '⛔ "산발적 검출" 같은 시스템 용어 금지 → "검출 빈도가 낮아" 등 자연어로 표현',
          '⛔ 다른 쌍과의 비교 표현 금지 (예: "다른 쌍들보다 우선순위가 낮습니다")',
        ],
        scoreToneAlignment: {
          description: '⚠️ ai_score와 ai_reason의 위험도 톤이 반드시 일치해야 합니다',
          rules: [
            '90~100점: "즉각적인 편명 변경/조정이 시급합니다" 수준의 강한 표현 필수',
            '80~89점: "즉각적인 관제 조치/주의가 필요합니다" 수준의 표현',
            '70~79점: "지속적인 감시와 관제 주의가 요구됩니다" 수준의 표현',
            '60~69점: "관제 교신 시 주의가 필요합니다" 수준의 표현',
            '50~59점: "기본적인 주의 감시가 권고됩니다" 수준의 표현',
            '⛔ 절대 금지: 80점 이상인데 "위험도는 낮습니다", "감시가 필요합니다" 같은 약한 표현 사용',
            '⛔ 절대 금지: 60점대인데 "즉각적인 편명 조정이 시급합니다" 같은 과도한 표현 사용',
          ],
        },
        reasonTypeFirstSentence: {
          description: '⚠️ ai_reason 첫 문장에서 reason_type의 핵심 특성이 반드시 드러나야 합니다',
          required: {
            SAME_NUMBER: '첫 문장에 "동일한 편명번호" 또는 "같은 편명 숫자"가 반드시 포함',
            PHONETIC_DIGIT: '첫 문장에 혼동되는 구체적 발음 쌍(예: "Fife와 Niner", "5와 9")이 반드시 포함',
            CONTAINMENT: '첫 문장에 "포함" 또는 "내포"라는 단어와 함께 어떤 편명이 어디에 포함되는지 구조 설명 필수',
            TRANSPOSITION: '첫 문장에 "자리가 뒤바뀐" 또는 "전치"라는 표현과 구체적 숫자 위치 설명 필수 (예: "89와 98로 자릿수가 뒤바뀐 구조")',
            SIMILAR_CODE: '첫 문장에 구체적으로 어떤 부분이 유사한지 설명 필수 (예: "앞 세 자리가 동일하고 중간 숫자만 다른 구조")',
            DIGIT_OVERLAP: '첫 문장에 어떤 숫자가 겹치고 어떤 숫자가 다른지 구체적 위치 설명 필수',
            OTHER: '첫 문장에 해당 쌍의 혼동 유발 특성을 구체적으로 설명',
          },
        },
        antiTemplate: [
          '⚠️ 모든 쌍의 ai_reason은 반드시 서로 다르게 작성해야 합니다.',
          '동일하거나 유사한 문장 패턴을 2회 이상 반복 사용하지 마세요.',
          '각 쌍의 고유한 특성(편명 숫자 구조, 항공사 관계, error 이력 유무, 관제환경, 공존상황, 방향)을 조합하여 차별화된 문장을 작성하세요.',
          '"예방적 감시가 권고됩니다"를 종결 표현으로 3회 이상 사용 금지 — 다양한 마무리 표현을 사용하세요.',
        ],
        mustReflect: [
          '해당 쌍의 reason_type이 무엇인지 ai_reason 첫 문장에서 자연스럽게 드러나야 합니다 (reasonTypeFirstSentence 참조).',
          'error_type/sub_error가 존재하면 오류 이력과 오류 유형을 반드시 언급해야 합니다.',
          'traffic_level="혼잡"이면 관제 부하 상황을 반드시 언급해야 합니다.',
          'atc_recommendation="즉시조치"이면 "관제사가 즉시조치를 권고한 쌍"임을 반드시 명시해야 합니다.',
          'same_airline_code="일치"이면 "동일 항공사 내" 혼동임을 언급하고, "관제 지시가 뒤바뀔 위험"을 설명해야 합니다.',
          'same_airline_code="불일치"이면 "서로 다른 항공사 간" 혼동임을 명시해야 합니다.',
        ],
        examples: [
          '"서로 다른 항공사가 동일한 편명번호 038을 사용하여 교신 시 혼동 위험이 매우 높습니다. 실제 동시응답 오류가 발생한 이력이 있으며 관제사가 즉시조치를 권고한 쌍입니다. 동일 방향 입항으로 긴 시간 공존하여 즉각적인 편명 변경 검토가 필요합니다."',
          '"편명 숫자 중 5(Fife)와 9(Niner)가 무선교신에서 혼동되기 쉬운 발음 쌍을 포함합니다. 혼잡한 관제 환경에서 반복적으로 검출되고 있어 지속적인 감시가 요구됩니다. 동일 항공사 국내선으로 관제 지시가 뒤바뀔 위험이 있습니다."',
          '"KAL126이 KAL1256에 완전히 포함되는 구조로, 빠른 교신에서 축약 발음 시 구별이 어렵습니다. 동일 항공사 운항편으로 관제 지시 혼선 시 안전 위험이 매우 높습니다. 반복적으로 검출되어 편명 구조 조정이 필요합니다."',
        ],
      },

      phoneticConfusion: {
        description: 'ICAO 무선교신 발음 혼동 숫자 쌍 (참고용)',
        pairs: [
          { digits: '5 ↔ 9', pronunciation: 'Fife ↔ Niner', reason: '끝 발음 유사' },
          { digits: '3 ↔ 8', pronunciation: 'Tree ↔ Ait', reason: '잡음 환경 혼동' },
          { digits: '0 ↔ 4', pronunciation: 'Zero ↔ FOW-er', reason: '약한 혼동' },
          { digits: '1 ↔ 9', pronunciation: 'Wun ↔ Niner', reason: '짧은 교신 시' },
          { digits: '13 ↔ 30', pronunciation: '서틴 ↔ 서티', reason: '한국어 혼동' },
          { digits: '14 ↔ 40', pronunciation: '포틴 ↔ 포티', reason: '한국어 혼동' },
          { digits: '15 ↔ 50', pronunciation: '피프틴 ↔ 피프티', reason: '한국어 혼동' },
        ],
      },

      outputFormat: {
        description: '아래 형식으로 정확히 출력하세요. JSON만 출력하고 다른 텍스트는 포함하지 마세요.',
        responseMethod: {
          instruction: [
            '⚠️ 최우선 규칙: 분석 결과를 채팅창에서 바로 다운로드할 수 있는 JSON 파일 1개로 제공하세요.',
            '',
            '=== 반드시 지켜야 할 것 ===',
            '1. 모든 쌍의 결과를 하나의 JSON 파일에 담아 제공하세요.',
            '2. 파일명: ai_analysis_result_YYYYMMDD.json',
            '3. JSON 파일만 제공하고, 요약·설명·코드블록은 불필요합니다.',
            '',
            '=== 절대 하지 말 것 ===',
            '❌ 아티팩트(Artifact)로 만들지 마세요 - 반드시 채팅 응답에 직접 파일 첨부',
            '❌ 배치로 나눠서 처리하지 마세요 - 한 번에 전부 처리',
            '❌ "나머지는 다음에" 같은 분할 응답 금지',
            '❌ 코드 블록(```json)으로 출력 금지 - 다운로드 가능한 파일로만 제공',
            '',
            '=== JSON 크기 최적화 ===',
            '- ai_reason은 정확히 3문장, 80~150자 이내로 간결하게 작성',
            '- 불필요한 공백·줄바꿈·들여쓰기 최소화',
            '- results 배열 외에 summary, metadata 등 부가 정보 불포함',
          ],
        },
        jsonStructure: {
          description: '출력 JSON은 반드시 이 구조만 사용하세요. 다른 키를 추가하지 마세요.',
          format: '{ "results": [ { "callsign_pair": "...", "ai_score": 숫자, "reason_type": "...", "ai_reason": "..." }, ... ] }',
        },
        example: {
          results: [
            {
              callsign_pair: 'KAL042 | KAL092',
              ai_score: 92,
              reason_type: 'DIGIT_OVERLAP',
              ai_reason:
                '같은 항공사 내에서 편명번호 끝자리만 다른 쌍으로, 관제 부하가 높은 환경에서 긴 시간 공존합니다. 실제 조종사 오류가 보고된 이력이 있어 관제 지시가 뒤바뀔 위험이 매우 높습니다. 즉각적인 편명 조정이 필요합니다.',
            },
          ],
        },
      },
    },
    data: {
      totalCount: pairs.length,
      pairs,
    },
  };
}
