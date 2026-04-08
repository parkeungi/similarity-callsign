import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const DAY_NAMES_KO = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

// 검색 이력 로깅 (fire-and-forget, 검색 응답에 영향 없음)
function logSearch(
  request: NextRequest,
  callsign: string,
  resultCount: number,
  results: Array<{ airlineCode?: string; otherAirlineCode?: string; riskLevel?: string }>
) {
  try {
    const airlines = [...new Set(results.flatMap(r => [r.airlineCode, r.otherAirlineCode]).filter(Boolean))];
    const risks = [...new Set(results.map(r => r.riskLevel).filter(Boolean))];
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || null;
    const ua = (request.headers.get('user-agent') || '').slice(0, 512) || null;

    query(
      `INSERT INTO search_logs (searched_callsign, result_count, matched_airline_codes, matched_risk_levels, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [callsign, resultCount, airlines.join(',') || null, risks.join(',') || null, ip, ua]
    ).catch((err) => {
      console.error('[search_logs] Insert failed:', err);
    });
  } catch (err) {
    console.error('[search_logs] logSearch error:', err);
  }
}

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

    // 외항사 차단: DB airlines 테이블 기준으로 국내항공사 코드인지 확인
    const prefix = callsign.slice(0, 3);
    const domesticResult = await query(
      `SELECT 1 FROM airlines WHERE code = $1 AND code != 'FOREIGN' LIMIT 1`,
      [prefix]
    );
    if (!domesticResult.rows || domesticResult.rows.length === 0) {
      return NextResponse.json(
        { error: '검색 대상이 아닙니다.', success: false },
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
      logSearch(request, callsign, 0, []);
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

    // 2-1. 요일별 발생 횟수 조회 (전체 요일)
    const dayCountResult = await query(
      `SELECT
        co.callsign_id,
        EXTRACT(DOW FROM co.occurred_date)::int as dow,
        COUNT(*)::int as cnt
      FROM callsign_occurrences co
      WHERE co.callsign_id = ANY($1::uuid[])
      GROUP BY co.callsign_id, EXTRACT(DOW FROM co.occurred_date)
      ORDER BY dow`,
      [callsignIds]
    );

    // callsign_id별 요일 카운트 맵: { callsignId: { 0: 1, 2: 3, ... } }
    const dayCountMap = new Map<string, Record<number, number>>();
    for (const row of dayCountResult.rows) {
      const key = row.callsign_id as string;
      if (!dayCountMap.has(key)) dayCountMap.set(key, {});
      dayCountMap.get(key)![row.dow as number] = row.cnt as number;
    }

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
      const dayCounts = dayCountMap.get(c.id) || {};
      // 요일별 발생 횟수: [일, 월, 화, 수, 목, 금, 토]
      const occurrencesByDay = [0, 1, 2, 3, 4, 5, 6].map(d => dayCounts[d] || 0);
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
        occurrencesByDay,
        sameDayOccurrences,
        sameDayCount: sameDayOccurrences.length,
      };
    });

    logSearch(request, callsign, results.length, results);

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
