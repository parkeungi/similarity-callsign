// GET /api/admin/time-pattern-stats - 시간대별 충돌 패턴 분석, 날짜 범위 내 4건+ 발생 호출부호 쌍의 시간 집중도 분류
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface OccurrenceTime {
  date: string;
  time: string;
  error_type: string | null;
}

function classifyPattern(occurrences: OccurrenceTime[]): {
  pattern_type: 'fixed' | 'roundtrip' | 'scattered';
  primary_hours: number[];
  time_concentration: number;
} {
  const withTime = occurrences.filter((o) => o.time);
  if (withTime.length === 0) {
    return { pattern_type: 'scattered', primary_hours: [], time_concentration: 0 };
  }

  // 시간대별 발생 횟수 집계
  const hourCounts: Record<number, number> = {};
  withTime.forEach((occ) => {
    const hour = parseInt(occ.time.split(':')[0], 10);
    if (!isNaN(hour)) {
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
  });

  // 인접 시간대 그룹핑 (+-1시간 허용)
  const hours = Object.keys(hourCounts).map(Number).sort((a, b) => a - b);
  const groups: { hours: number[]; count: number }[] = [];

  for (const h of hours) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && (h - lastGroup.hours[lastGroup.hours.length - 1] <= 1)) {
      lastGroup.hours.push(h);
      lastGroup.count += hourCounts[h];
    } else {
      groups.push({ hours: [h], count: hourCounts[h] });
    }
  }

  groups.sort((a, b) => b.count - a.count);

  if (groups.length === 0) {
    return { pattern_type: 'scattered', primary_hours: [], time_concentration: 0 };
  }

  const topGroup = groups[0];
  const topConcentration = topGroup.count / withTime.length;

  if (groups.length >= 2) {
    const secondGroup = groups[1];
    const twoGroupConcentration = (topGroup.count + secondGroup.count) / withTime.length;

    if (topConcentration >= 0.7) {
      return {
        pattern_type: 'fixed',
        primary_hours: topGroup.hours,
        time_concentration: Math.round(topConcentration * 100),
      };
    } else if (twoGroupConcentration >= 0.7) {
      const hourDiff = Math.abs(topGroup.hours[0] - secondGroup.hours[0]);
      if (hourDiff >= 6) {
        return {
          pattern_type: 'roundtrip',
          primary_hours: [...topGroup.hours, ...secondGroup.hours].sort((a, b) => a - b),
          time_concentration: Math.round(twoGroupConcentration * 100),
        };
      }
      return {
        pattern_type: 'fixed',
        primary_hours: [...topGroup.hours, ...secondGroup.hours].sort((a, b) => a - b),
        time_concentration: Math.round(twoGroupConcentration * 100),
      };
    }
  } else if (topConcentration >= 0.7) {
    return {
      pattern_type: 'fixed',
      primary_hours: topGroup.hours,
      time_concentration: Math.round(topConcentration * 100),
    };
  }

  return {
    pattern_type: 'scattered',
    primary_hours: topGroup.hours,
    time_concentration: Math.round(topConcentration * 100),
  };
}

export async function GET(request: NextRequest) {
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

    // 입력값 검증
    const minCountRaw = parseInt(request.nextUrl.searchParams.get('minCount') || '4', 10);
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

    // 날짜 조건 빌드
    const conditions: string[] = [];
    const params: any[] = [minCount];
    let paramIdx = 2;

    if (dateFrom) {
      conditions.push(`co.occurred_date >= $${paramIdx}`);
      params.push(dateFrom);
      paramIdx++;
    }
    if (dateTo) {
      conditions.push(`co.occurred_date <= $${paramIdx}`);
      params.push(dateTo);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

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
      ${whereClause}
      GROUP BY c.id
      HAVING COUNT(co.id) >= $1
      ORDER BY COUNT(co.id) DESC, c.callsign_pair`,
      params
    );

    // 패턴 분류
    const items = result.rows.map((row: any) => {
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

    // 요약 통계
    const fixedCount = items.filter((i: any) => i.pattern_type === 'fixed').length;
    const roundtripCount = items.filter((i: any) => i.pattern_type === 'roundtrip').length;

    // 전체 시간대별 집계 (차트용)
    const hourlyTotal: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourlyTotal[h] = 0;
    items.forEach((item: any) => {
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
    logger.error('시간대 패턴 분석 오류', error, 'admin/time-pattern-stats');
    return NextResponse.json({ error: '시간대 패턴 분석 실패' }, { status: 500 });
  }
}
