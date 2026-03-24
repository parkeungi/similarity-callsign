// GET /api/admin/search-stats - 사전조회 검색 이력 통계 (일별추이·Top호출부호·항공사분포·시간대분포)
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: '관리자만 접근할 수 있습니다.' }, { status: 403 });
    }

    const dateFrom = request.nextUrl.searchParams.get('dateFrom');
    const dateTo = request.nextUrl.searchParams.get('dateTo');

    // 날짜 형식 검증
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (dateFrom && !datePattern.test(dateFrom)) {
      return NextResponse.json({ error: '유효하지 않은 날짜 형식입니다 (YYYY-MM-DD).' }, { status: 400 });
    }
    if (dateTo && !datePattern.test(dateTo)) {
      return NextResponse.json({ error: '유효하지 않은 날짜 형식입니다 (YYYY-MM-DD).' }, { status: 400 });
    }

    let conditions = '';
    const params: string[] = [];
    let paramIndex = 1;
    if (dateFrom) {
      conditions += ` AND sl.searched_at >= $${paramIndex++}::date`;
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions += ` AND sl.searched_at < ($${paramIndex++}::date + INTERVAL '1 day')`;
      params.push(dateTo);
    }

    // 5개 쿼리 병렬 실행
    const [summaryResult, dailyResult, topCallsignsResult, airlineResult, hourlyResult] = await Promise.all([
      // 1. 요약 KPI
      query(
        `SELECT
          COUNT(*)::int as total_searches,
          COUNT(DISTINCT sl.searched_callsign)::int as unique_callsigns,
          COUNT(*) FILTER (WHERE sl.result_count = 0)::int as zero_result_searches,
          ROUND(AVG(sl.result_count), 1) as avg_result_count
        FROM search_logs sl
        WHERE 1=1 ${conditions}`,
        params
      ),
      // 2. 일별 검색 추이
      query(
        `SELECT TO_CHAR(sl.searched_at, 'MM-DD') as day, COUNT(*)::int as count
        FROM search_logs sl
        WHERE 1=1 ${conditions}
        GROUP BY DATE(sl.searched_at), TO_CHAR(sl.searched_at, 'MM-DD')
        ORDER BY DATE(sl.searched_at) ASC`,
        params
      ),
      // 3. Top 10 검색 호출부호
      query(
        `SELECT sl.searched_callsign as callsign, COUNT(*)::int as count
        FROM search_logs sl
        WHERE 1=1 ${conditions}
        GROUP BY sl.searched_callsign
        ORDER BY count DESC
        LIMIT 10`,
        params
      ),
      // 4. 항공사 분포 (매칭 결과에서 추출)
      query(
        `SELECT TRIM(code) as airline_code, COUNT(*)::int as count
        FROM search_logs sl, UNNEST(STRING_TO_ARRAY(sl.matched_airline_codes, ',')) AS code
        WHERE sl.matched_airline_codes IS NOT NULL ${conditions}
        GROUP BY TRIM(code)
        ORDER BY count DESC
        LIMIT 10`,
        params
      ),
      // 5. 시간대별 분포 (한국 시간 기준)
      query(
        `SELECT TO_CHAR(sl.searched_at AT TIME ZONE 'Asia/Seoul', 'HH24') as hour, COUNT(*)::int as count
        FROM search_logs sl
        WHERE 1=1 ${conditions}
        GROUP BY 1
        ORDER BY hour ASC`,
        params
      ),
    ]);

    const summaryRow = summaryResult.rows[0] || {};

    // 24시간 전체 채우기
    const hourlyDistribution = Array.from({ length: 24 }).map((_, i) => {
      const hStr = i.toString().padStart(2, '0');
      const found = hourlyResult.rows.find((r: { hour: string }) => r.hour === hStr);
      return { hour: hStr + '시', count: found ? found.count : 0 };
    });

    return NextResponse.json({
      data: {
        summary: {
          totalSearches: summaryRow.total_searches || 0,
          uniqueCallsigns: summaryRow.unique_callsigns || 0,
          zeroResultSearches: summaryRow.zero_result_searches || 0,
          avgResultCount: summaryRow.avg_result_count != null ? parseFloat(summaryRow.avg_result_count) : 0,
        },
        dailyTrend: dailyResult.rows,
        topCallsigns: topCallsignsResult.rows,
        airlineDistribution: airlineResult.rows,
        hourlyDistribution,
      },
    });
  } catch (error) {
    logger.error('검색 통계 조회 오류', error, 'admin/search-stats');
    return NextResponse.json({ error: '검색 통계 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
