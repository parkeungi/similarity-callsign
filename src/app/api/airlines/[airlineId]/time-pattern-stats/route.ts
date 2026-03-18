// GET /api/airlines/[airlineId]/time-pattern-stats - 항공사별 시간대별 충돌 패턴 분석
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';
import { classifyPattern, type OccurrenceTime } from '@/lib/time-pattern';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ airlineId: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    const { airlineId } = await params;

    // 항공사 소유권 확인 (관리자는 모든 항공사 접근 가능)
    const tokenAirlineId = payload.airlineId;
    const isAdmin = payload.role === 'admin';
    if (!isAdmin) {
      if (!tokenAirlineId) {
        return NextResponse.json({ error: '토큰에 항공사 정보가 없습니다.' }, { status: 401 });
      }
      if (airlineId !== tokenAirlineId) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
      }
    }

    // 입력값 검증
    const minCountRaw = parseInt(request.nextUrl.searchParams.get('minCount') || '2', 10);
    const minCount = Math.max(1, Math.min(minCountRaw, 100));
    const dateFrom = request.nextUrl.searchParams.get('dateFrom');
    const dateTo = request.nextUrl.searchParams.get('dateTo');
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateFrom && !dateRegex.test(dateFrom)) {
      return NextResponse.json({ error: '날짜 형식이 올바르지 않습니다. (yyyy-MM-dd)' }, { status: 400 });
    }
    if (dateTo && !dateRegex.test(dateTo)) {
      return NextResponse.json({ error: '날짜 형식이 올바르지 않습니다. (yyyy-MM-dd)' }, { status: 400 });
    }

    // 항공사 코드 조회
    const airlineResult = await query(
      'SELECT code FROM airlines WHERE id = $1',
      [airlineId]
    );
    if (airlineResult.rows.length === 0) {
      return NextResponse.json({ error: '항공사를 찾을 수 없습니다.' }, { status: 404 });
    }
    const airlineCode = airlineResult.rows[0].code;

    // 날짜 조건 빌드
    const conditions: string[] = [];
    const queryParams: (string | number)[] = [minCount, airlineCode, airlineCode];
    let paramIdx = 4;

    if (dateFrom) {
      conditions.push(`co.occurred_date >= $${paramIdx}`);
      queryParams.push(dateFrom);
      paramIdx++;
    }
    if (dateTo) {
      conditions.push(`co.occurred_date <= $${paramIdx}`);
      queryParams.push(dateTo);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT
        c.callsign_pair,
        c.my_callsign,
        c.other_callsign,
        c.airline_code,
        c.other_airline_code,
        c.risk_level,
        c.similarity,
        c.sector,
        c.departure_airport1,
        c.arrival_airport1,
        c.departure_airport2,
        c.arrival_airport2,
        COUNT(co.id) as occ_count,
        json_agg(
          json_build_object(
            'date', co.occurred_date,
            'time', to_char(co.occurred_time, 'HH24:MI'),
            'error_type', co.error_type
          ) ORDER BY co.occurred_date, co.occurred_time
        ) as occurrences
      FROM callsigns c
      JOIN callsign_occurrences co ON co.callsign_id = c.id
      WHERE (c.airline_code = $2 OR c.other_airline_code = $3)
      ${whereClause}
      GROUP BY c.id
      HAVING COUNT(co.id) >= $1
      ORDER BY COUNT(co.id) DESC, c.callsign_pair`,
      queryParams
    );

    // 패턴 분류
    interface CallsignRow {
      callsign_pair: string;
      my_callsign: string;
      other_callsign: string;
      airline_code: string;
      other_airline_code: string;
      risk_level: string;
      similarity: string;
      sector: string | null;
      departure_airport1: string | null;
      arrival_airport1: string | null;
      departure_airport2: string | null;
      arrival_airport2: string | null;
      occ_count: string;
      occurrences: OccurrenceTime[];
    }
    const items = result.rows.map((row: CallsignRow) => {
      const occs: OccurrenceTime[] = row.occurrences || [];
      const { pattern_type, primary_hours, time_concentration } = classifyPattern(occs);

      return {
        callsign_pair: row.callsign_pair,
        my_callsign: row.my_callsign,
        other_callsign: row.other_callsign,
        airline_code: row.airline_code,
        other_airline_code: row.other_airline_code,
        risk_level: row.risk_level,
        similarity: row.similarity,
        sector: row.sector || '',
        departure_airport1: row.departure_airport1 || '',
        arrival_airport1: row.arrival_airport1 || '',
        departure_airport2: row.departure_airport2 || '',
        arrival_airport2: row.arrival_airport2 || '',
        occ_count: parseInt(row.occ_count, 10),
        pattern_type,
        primary_hours,
        time_concentration,
        occurrences: occs,
      };
    });

    const fixedCount = items.filter((i) => i.pattern_type === 'fixed').length;
    const roundtripCount = items.filter((i) => i.pattern_type === 'roundtrip').length;

    const hourlyTotal: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourlyTotal[h] = 0;
    items.forEach((item) => {
      item.occurrences.forEach((occ: OccurrenceTime) => {
        if (!occ.time) return;
        const h = parseInt(occ.time.split(':')[0], 10);
        if (!isNaN(h)) hourlyTotal[h]++;
      });
    });

    return NextResponse.json({
      data: items,
      summary: {
        total: items.length,
        fixed: fixedCount,
        roundtrip: roundtripCount,
        scattered: items.length - fixedCount - roundtripCount,
        structuralRate: items.length > 0
          ? Math.round(((fixedCount + roundtripCount) / items.length) * 100)
          : 0,
      },
      hourlyDistribution: Object.entries(hourlyTotal).map(([hour, count]) => ({
        hour: parseInt(hour, 10),
        count,
      })),
    });
  } catch (error) {
    logger.error('항공사 시간대 패턴 분석 오류', error, 'airlines/time-pattern-stats');
    return NextResponse.json({ error: '시간대 패턴 분석 실패' }, { status: 500 });
  }
}
