/**
 * GET /api/callsigns/stats
 * 유사호출부호 통계 조회 (전체 기준, 필터 적용)
 *
 * 쿼리 파라미터:
 *   - airlineId: 항공사 ID (필터)
 *   - riskLevel: 위험도 필터 (매우높음|높음)
 *
 * 응답:
 *   - total: 전체 개수
 *   - veryHigh: 매우높음 개수
 *   - high: 높음 개수
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // 필터 파라미터 — 비관리자는 자기 항공사만 조회 가능
    let airlineId = request.nextUrl.searchParams.get('airlineId');
    if (payload.role !== 'admin') {
      airlineId = payload.airlineId ?? null;
    }
    const riskLevel = request.nextUrl.searchParams.get('riskLevel');
    const dateFrom = request.nextUrl.searchParams.get('dateFrom');
    const dateTo = request.nextUrl.searchParams.get('dateTo');

    // 기본 쿼리
    let sql = `SELECT risk_level, COUNT(*) as count FROM callsigns WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    // 필터 조건
    if (airlineId) {
      sql += ` AND airline_id = $${paramIndex++}`;
      params.push(airlineId);
    }

    if (riskLevel && ['매우높음', '높음'].includes(riskLevel)) {
      sql += ` AND risk_level = $${paramIndex++}`;
      params.push(riskLevel);
    }

    if (dateFrom) {
      sql += ` AND uploaded_at >= $${paramIndex++}`;
      params.push(dateFrom);
    }
    if (dateTo) {
      const exclusiveDateTo = getExclusiveDateTo(dateTo);
      sql += ` AND uploaded_at < $${paramIndex++}`;
      params.push(exclusiveDateTo);
    }

    sql += ` GROUP BY risk_level`;

    const result = await query(sql, params);

    // 결과 집계
    const stats = {
      total: 0,
      veryHigh: 0,
      high: 0,
    };

    for (const row of result.rows) {
      const count = parseInt(row.count, 10);
      stats.total += count;

      if (row.risk_level === '매우높음') {
        stats.veryHigh = count;
      } else if (row.risk_level === '높음') {
        stats.high = count;
      }
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('유사호출부호 통계 조회 오류:', error);
    return NextResponse.json(
      { error: '통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

function getExclusiveDateTo(dateStr: string): string {
  let base = new Date(dateStr);
  if (Number.isNaN(base.getTime())) {
    base = new Date(`${dateStr}T00:00:00Z`);
  }
  if (Number.isNaN(base.getTime())) {
    throw new Error('유효하지 않은 dateTo 값입니다.');
  }
  base.setUTCHours(0, 0, 0, 0);
  base.setUTCDate(base.getUTCDate() + 1);
  return base.toISOString();
}
