import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const DAY_NAMES_KO = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

// 한국 시간대 기준 요일 계산 (UTC+9)
function getKoreaDayOfWeek(): number {
  const now = new Date();
  const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return koreaTime.getUTCDay();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const callsign = searchParams.get('callsign')?.trim().toUpperCase();

    if (!callsign || callsign.length < 3 || callsign.length > 10) {
      return NextResponse.json(
        { error: '호출부호는 3~10자로 입력해주세요.', success: false },
        { status: 400 }
      );
    }

    if (!/^[A-Z0-9]+$/.test(callsign)) {
      return NextResponse.json(
        { error: '호출부호는 영문과 숫자만 입력 가능합니다.', success: false },
        { status: 400 }
      );
    }

    // 한국 시간 기준 요일 (DB 쿼리와 일치시킴)
    const dowIndex = getKoreaDayOfWeek();

    // 1. callsigns 테이블에서 매치되는 호출부호 쌍 검색 (prefix match)
    const callsignResult = await query(
      `SELECT
        c.id,
        c.callsign_pair,
        c.my_callsign,
        c.other_callsign,
        c.airline_code,
        c.other_airline_code,
        c.risk_level,
        c.similarity,
        c.sector,
        c.coexistence_minutes,
        c.occurrence_count,
        c.error_type
      FROM callsigns c
      WHERE c.my_callsign ILIKE $1 OR c.other_callsign ILIKE $1
      ORDER BY
        CASE c.risk_level WHEN '매우높음' THEN 1 WHEN '높음' THEN 2 ELSE 3 END,
        c.occurrence_count DESC
      LIMIT 30`,
      [`${callsign}%`]
    );

    if (callsignResult.rows.length === 0) {
      return NextResponse.json({
        data: {
          searchedCallsign: callsign,
          dayOfWeek: DAY_NAMES_KO[dowIndex],
          dayOfWeekIndex: dowIndex,
          totalMatches: 0,
          results: [],
        },
        success: true,
      });
    }

    // 2. 매치된 callsign_id들에 대해 같은 요일 발생 이력 조회
    //    DB 시간대도 Asia/Seoul로 맞춰서 요일 비교
    const callsignIds = callsignResult.rows.map((r: { id: string }) => r.id);

    const occurrenceResult = await query(
      `SELECT
        co.callsign_id,
        to_char(co.occurred_date, 'YYYY-MM-DD') as occurred_date,
        to_char(co.occurred_time, 'HH24:MI') as occurred_time,
        co.error_type,
        co.sub_error
      FROM callsign_occurrences co
      WHERE co.callsign_id = ANY($1::uuid[])
        AND EXTRACT(DOW FROM co.occurred_date) = $2
      ORDER BY co.occurred_time ASC NULLS LAST`,
      [callsignIds, dowIndex]
    );

    // 3. 발생 이력을 callsign_id별로 그룹핑
    const occurrenceMap = new Map<string, Array<{
      occurredDate: string;
      occurredTime: string;
      errorType: string;
      subError: string;
    }>>();

    for (const occ of occurrenceResult.rows) {
      const key = occ.callsign_id;
      if (!occurrenceMap.has(key)) {
        occurrenceMap.set(key, []);
      }
      occurrenceMap.get(key)!.push({
        occurredDate: occ.occurred_date || '',
        occurredTime: occ.occurred_time || '',
        errorType: occ.error_type || '',
        subError: occ.sub_error || '',
      });
    }

    const results = callsignResult.rows.map((c: {
      id: string;
      callsign_pair: string;
      my_callsign: string;
      other_callsign: string;
      airline_code: string;
      other_airline_code: string;
      risk_level: string;
      similarity: string;
      sector: string;
      coexistence_minutes: number;
      occurrence_count: number;
    }) => {
      const sameDayOccurrences = occurrenceMap.get(c.id) || [];
      return {
        callsignPair: c.callsign_pair,
        myCallsign: c.my_callsign,
        otherCallsign: c.other_callsign,
        airlineCode: c.airline_code,
        otherAirlineCode: c.other_airline_code || '',
        riskLevel: c.risk_level || '',
        similarity: c.similarity || '',
        sector: c.sector || '',
        coexistenceMinutes: c.coexistence_minutes || 0,
        occurrenceCount: c.occurrence_count || 0,
        sameDayOccurrences,
        sameDayCount: sameDayOccurrences.length,
      };
    });

    return NextResponse.json({
      data: {
        searchedCallsign: callsign,
        dayOfWeek: DAY_NAMES_KO[dowIndex],
        dayOfWeekIndex: dowIndex,
        totalMatches: results.length,
        results,
      },
      success: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: '검색 중 오류가 발생했습니다.', success: false },
      { status: 500 }
    );
  }
}
