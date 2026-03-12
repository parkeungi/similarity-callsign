// GET /api/admin/ai-analysis/export - AI 분석 결과 CSV/JSON 내보내기, callsign_ai_analysis 테이블 전체 덤프
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

/**
 * GET /api/admin/ai-analysis/export
 * 미분석 콜사인 쌍 + AI 프롬프트를 포함한 JSON 파일 다운로드
 */
export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.substring(7);
  const payload = verifyToken(token || '');
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    // 미분석 pair 조회
    const result = await query(`
      SELECT
        c.callsign_pair AS pair,
        COUNT(*) AS count
      FROM callsigns c
      LEFT JOIN callsign_ai_analysis ai
        ON ai.callsign_pair = c.callsign_pair
      WHERE ai.id IS NULL
      GROUP BY c.callsign_pair
      ORDER BY COUNT(*) DESC, c.callsign_pair
    `);

    const pairs = result.rows.map((row: { pair: string; count: string }) => ({
      pair: row.pair,
      count: parseInt(row.count, 10),
    }));

    // 분석요청 JSON 생성
    const exportData = {
      meta: {
        exportedAt: new Date().toISOString(),
        system: '유사호출부호 공유시스템',
        version: '1.0',
      },
      prompt: {
        instruction: '아래 콜사인 쌍(pairs)을 분석하여 JSON 형식으로 결과를 출력하세요.',
        analysisRules: [
          '1. ai_score (1~100): 관제 혼동 위험도 점수',
          '   - 80~100: 긴급 (편명 동일 + 발음유사 코드)',
          '   - 60~79: 주의 (편명 동일 또는 전치/포함)',
          '   - 40~59: 관찰 (부분 유사)',
          '   - 1~39: 낮음 (유사성 낮음)',
          '',
          '2. reason_type (7종 중 택1):',
          '   - SAME_NUMBER: 다른 항공사, 편명번호 완전 동일 (예: ESR887 ↔ KAL887)',
          '   - CONTAINMENT: 짧은 번호가 긴 번호에 포함 (예: KAL126 ↔ KAL1256)',
          '   - TRANSPOSITION: 숫자 자릿수 전치 (예: TWB301 ↔ TWB310)',
          '   - SIMILAR_CODE: 항공사코드 발음 유사 + 편명 유사 (예: JNA301 ↔ JJA301)',
          '   - DIGIT_OVERLAP: 같은 항공사, 앞/뒤 숫자 겹침 (예: AAR701 ↔ AAR731)',
          '   - PHONETIC_DIGIT: 발음 혼동 숫자 조합 포함 (예: 5↔9, 3↔8, 13↔30)',
          '   - LOW_RISK: 유사성 낮음',
          '',
          '3. ai_reason: 항공사에 전달할 2~3문장의 조치 근거',
          '   - 왜 이 쌍이 위험한지 구체적으로 설명',
          '   - 발생횟수(count)는 언급하지 않음 (별도 관리)',
        ],
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
                callsign_pair: 'ESR887 | KAL887',
                ai_score: 88,
                reason_type: 'SAME_NUMBER',
                ai_reason:
                  '편명번호 887이 완전 동일합니다. 항공사코드는 다르나 같은 번호 사용 시 관제지시 대상이 뒤바뀔 수 있으며, 빠른 교신 환경에서 혼동 위험이 높습니다.',
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

    // 파일명 생성
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `ai_analysis_request_${dateStr}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('[AI Analysis Export] Error:', error);
    return NextResponse.json({ error: '분석요청 파일 생성 실패' }, { status: 500 });
  }
}
