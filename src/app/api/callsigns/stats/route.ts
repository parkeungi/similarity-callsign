// GET /api/callsigns/stats - 유사호출부호 통계(전체·위험도별·항공사별 건수), callsigns 테이블 GROUP BY 집계
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
import { logger } from '@/lib/logger';

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
    const fileUploadId = request.nextUrl.searchParams.get('fileUploadId');

    // fileUploadId UUID 형식 검증
    const hexRegex = /^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validFileUploadId = fileUploadId && hexRegex.test(fileUploadId) ? fileUploadId : null;

    // 기본 쿼리
    let sql = `SELECT c.risk_level, COUNT(*) as count FROM callsigns c`;
    const params: any[] = [];
    let paramIndex = 1;

    // 업로드 배치 필터: fileUploadId 있으면 callsign_uploads JOIN
    if (validFileUploadId) {
      params.push(validFileUploadId);
      sql += ` LEFT JOIN callsign_uploads cu_batch ON cu_batch.callsign_id = c.id AND cu_batch.file_upload_id = $${paramIndex++}`;
    }

    sql += ` WHERE 1=1`;

    // 필터 조건
    if (airlineId) {
      sql += ` AND c.airline_id = $${paramIndex++}`;
      params.push(airlineId);
    }

    if (riskLevel && ['매우높음', '높음'].includes(riskLevel)) {
      sql += ` AND c.risk_level = $${paramIndex++}`;
      params.push(riskLevel);
    }

    if (validFileUploadId) {
      // 업로드 배치 기준: 해당 배치에 포함된 callsign만
      sql += ` AND (cu_batch.callsign_id IS NOT NULL OR (c.file_upload_id = $1 AND NOT EXISTS (SELECT 1 FROM callsign_uploads cu_chk WHERE cu_chk.callsign_id = c.id)))`;
    } else {
      if (dateFrom) {
        sql += ` AND c.uploaded_at >= $${paramIndex++}`;
        params.push(dateFrom);
      }
      if (dateTo) {
        const exclusiveDateTo = getExclusiveDateTo(dateTo);
        sql += ` AND c.uploaded_at < $${paramIndex++}`;
        params.push(exclusiveDateTo);
      }
    }

    sql += ` GROUP BY c.risk_level`;

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
    logger.error('유사호출부호 통계 조회 오류', error, 'api/callsigns/stats');
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
