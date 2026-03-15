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
          '1. SAME_NUMBER — 편명번호 완전 동일이면 무조건 선택',
          '2. PHONETIC_DIGIT — phoneticConfusion 테이블의 발음혼동 숫자쌍이 편명에 포함되면 선택 (SAME_NUMBER보다 후순위)',
          '3. CONTAINMENT — 짧은 번호가 긴 번호에 완전 포함',
          '4. TRANSPOSITION — 숫자 2자리 이상 전치',
          '5. SIMILAR_CODE — 항공사코드 발음 유사 (다른 항공사 간)',
          '6. DIGIT_OVERLAP — 같은 항공사, 부분 숫자 겹침',
          '7. OTHER — 위 어느 것에도 해당하지 않을 때만 (기존 검출 시스템이 유사하다고 판단한 쌍이므로 50점 이상 필수)',
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
          '3문장 이내로 작성',
          '구체적 공항명·노선명 기재 금지 (출도착은 "입항"/"출항"으로만 표현)',
          '공존시간 수치 기재 금지 ("짧은 공존 구간" / "긴 시간 공존"으로 표현)',
          '관제 항공기 대수, 검출 건수, 점수 등 구체적 숫자 일체 기재 금지',
          '"관제가 많은 상황" / "관제 부하가 높은 환경" 등 정성적 표현만 사용',
        ],
        antiTemplate: [
          '모든 쌍의 ai_reason은 서로 다르게 작성해야 합니다.',
          '동일 문장 패턴을 3회 이상 반복 사용하지 마세요.',
          '각 쌍에 고유한 데이터 특성(reason_type, error 이력, 관제환경, 공존상황)을 조합하여 차별화된 문장을 작성하세요.',
        ],
        mustReflect: [
          '해당 쌍의 reason_type이 무엇인지 ai_reason 첫 문장에서 자연스럽게 드러나야 합니다.',
          'error_type/sub_error가 존재하면 오류 이력을 반드시 언급해야 합니다.',
          'traffic_level="혼잡"이면 관제 부하 상황을 반드시 언급해야 합니다.',
          'atc_recommendation이 존재하면 관제사 권고 사실을 반드시 언급해야 합니다.',
        ],
        examples: [
          '"동일 편명번호를 사용하며 관제 부하가 높은 환경에서 긴 시간 공존합니다. 실제 동시응답 오류가 보고된 이력이 있어 즉각적인 편명 변경 검토가 필요합니다."',
          '"편명 숫자의 발음이 무선교신에서 혼동되기 쉬운 조합으로, 반복적으로 검출되고 있습니다. 관제사가 즉시조치를 권고한 쌍입니다."',
          '"짧은 편명이 긴 편명에 완전히 포함되어 빠른 교신 환경에서 구별이 어렵습니다. 동일 방향 운항으로 동시 교신 가능성이 존재합니다."',
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
