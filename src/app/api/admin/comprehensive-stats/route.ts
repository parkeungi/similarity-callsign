// GET /api/admin/comprehensive-stats - 종합 통계(위험도분포·조치진행률·항공사별현황·월별추세), callsigns·actions 다중 집계
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { dayBucket, hourBucket, monthBucket, fullTime } from '@/lib/db/sql-helpers';
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

        let conditions = '';
        const params: string[] = [];
        let paramIndex = 1;
        if (dateFrom) {
            conditions += ` AND DATE(c.uploaded_at) >= DATE($${paramIndex++})`;
            params.push(dateFrom);
        }
        if (dateTo) {
            conditions += ` AND DATE(c.uploaded_at) <= DATE($${paramIndex++})`;
            params.push(dateTo);
        }

        // 1. 월별 트렌드
        const monthlySql = `
      SELECT ${monthBucket('c.uploaded_at')} as month, COUNT(*) as count 
      FROM callsigns c 
      WHERE 1=1 ${conditions} 
      GROUP BY 1 
      ORDER BY month ASC
    `;
        const monthlyTrend = (await query(monthlySql, params)).rows;

        // 2. 일별 트렌드 (최근 30일 등 짧은 기간일 때 주로 사용)
        const dailySql = `
      SELECT ${dayBucket('c.uploaded_at')} as day, COUNT(*) as count 
      FROM callsigns c 
      WHERE 1=1 ${conditions} 
      GROUP BY 1 
      ORDER BY day ASC
    `;
        const dailyTrend = (await query(dailySql, params)).rows;

        // 3. 주요 항공사 Top 5 (빈도순)
        const topAirlinesSql = `
      SELECT c.airline_code as name, COUNT(*) as count 
      FROM callsigns c 
      WHERE 1=1 ${conditions} AND c.airline_code IS NOT NULL
      GROUP BY c.airline_code 
      ORDER BY count DESC 
      LIMIT 5
    `;
        const topAirlines = (await query(topAirlinesSql, params)).rows;

        // 4. 오류 요인 비율
        const errorTypeSql = `
      SELECT c.error_type as name, COUNT(*) as value 
      FROM callsigns c 
      WHERE 1=1 ${conditions} AND c.error_type IS NOT NULL
      GROUP BY c.error_type 
      ORDER BY value DESC
    `;
        const errorDistribution = (await query(errorTypeSql, params)).rows;

        // 5. 노선별 추이 Top 5
        // coalesce를 사용하여 null 처리
        const routeSql = `
      SELECT COALESCE(c.departure_airport1, '미상') || '-' || COALESCE(c.arrival_airport1, '미상') as name, COUNT(*) as count
      FROM callsigns c
      WHERE 1=1 ${conditions}
      GROUP BY c.departure_airport1, c.arrival_airport1
      ORDER BY count DESC
      LIMIT 6
    `;
        // 미상-미상이 1위일 수 있으므로 6개를 뽑아 미상-미상을 제외하거나 필터링
        let routeDistribution = (await query(routeSql, params)).rows
            .filter((r: any) => r.name !== '미상-미상')
            .slice(0, 5);

        // 6. 시간대별 추이
        // occurrences 테이블과 조인하여 occurred_time 추출 (시간대 00, 01, ...)
        const timeSql = `
      SELECT ${hourBucket('o.occurred_time')} as hour, COUNT(*) as count
      FROM callsign_occurrences o
      JOIN callsigns c ON c.id = o.callsign_id
      WHERE o.occurred_time IS NOT NULL
        AND ${fullTime('o.occurred_time')} != '00:00:00'
        ${conditions.replace(/c\./g, 'c.')}
      GROUP BY 1
      ORDER BY hour ASC
    `;
        const timeRows = (await query(timeSql, params)).rows;
        const timeDistribution = Array.from({ length: 24 }).map((_, i) => {
            const hStr = i.toString().padStart(2, '0');
            const found = timeRows.find((r: any) => r.hour === hStr);
            return {
                name: hStr + '시',
                count: found ? parseInt(found.count, 10) : 0
            };
        });

        return NextResponse.json({
            data: {
                monthlyTrend,
                dailyTrend,
                topAirlines,
                errorDistribution,
                routeDistribution,
                timeDistribution
            }
        });

    } catch (error) {
        logger.error('종합 통계 조회 오류', error, 'admin/comprehensive-stats');
        return NextResponse.json({ error: '조회 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
