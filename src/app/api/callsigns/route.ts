// GET /api/callsigns - 유사호출부호 목록 조회, callsigns 테이블, riskLevel·status 필터, 페이지네이션(page/limit), 위험도순 정렬
/**
 * GET /api/callsigns
 * 유사호출부호 목록 조회
 *
 * 쿼리 파라미터:
 *   - airlineId: 항공사 ID (필터)
 *   - riskLevel: 위험도 필터 (매우높음|높음|낮음)
 *   - page: 페이지 번호 (기본값: 1)
 *   - limit: 페이지 크기 (기본값: 20, 최대: 100)
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
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    // 동적 where 절 구성
    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (airlineId) {
      whereClause += ` AND airline_id = $${paramIndex++}`;
      params.push(airlineId);
    }

    if (riskLevel && ['매우높음', '높음'].includes(riskLevel)) {
      whereClause += ` AND risk_level = $${paramIndex++}`;
      params.push(riskLevel);
    }

    // 쿼리 구성
    const sql = `
      SELECT
        c.id, c.airline_id, c.airline_code, c.callsign_pair, c.my_callsign, c.other_callsign,
        c.other_airline_code, c.error_type, c.sub_error, c.risk_level, c.similarity,
        c.sector, c.atc_recommendation,
        c.occurrence_count, c.last_occurred_at, c.file_upload_id, c.uploaded_at,
        c.created_at, c.updated_at,
        latest_action.id AS latest_action_id,
        latest_action.status AS latest_action_status,
        latest_action.manager_name AS latest_action_manager_name,
        latest_action.updated_at AS latest_action_updated_at
      FROM callsigns c
      LEFT JOIN (
        SELECT
          a.id,
          a.callsign_id,
          a.status,
          a.manager_name,
          a.updated_at,
          ROW_NUMBER() OVER (PARTITION BY a.callsign_id ORDER BY a.updated_at DESC, a.registered_at DESC) as rn
        FROM actions a
      ) latest_action ON c.id = latest_action.callsign_id AND latest_action.rn = 1
      WHERE 1=1 ${whereClause}
      ORDER BY
        CASE
          WHEN c.risk_level = '매우높음' THEN 2
          WHEN c.risk_level = '높음' THEN 1
          ELSE 0
        END DESC,
        c.occurrence_count DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const result = await query(sql, params);

    // 전체 개수 조회
    const countSql = `SELECT COUNT(*) as total FROM callsigns c WHERE 1=1 ${whereClause}`;
    const countParams: any[] = [...params.slice(0, params.length - 2)];  // limit, offset 제외

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].total, 10);

    return NextResponse.json({
      data: result.rows.map((callsign: any) => ({
        id: callsign.id,
        airline_id: callsign.airline_id,
        airline_code: callsign.airline_code,
        callsign_pair: callsign.callsign_pair,
        my_callsign: callsign.my_callsign,
        other_callsign: callsign.other_callsign,
        other_airline_code: callsign.other_airline_code,
        error_type: callsign.error_type,
        sub_error: callsign.sub_error,
        risk_level: callsign.risk_level,
        similarity: callsign.similarity,
        occurrence_count: callsign.occurrence_count,
        last_occurred_at: callsign.last_occurred_at,
        file_upload_id: callsign.file_upload_id,
        uploaded_at: callsign.uploaded_at,
        created_at: callsign.created_at,
        updated_at: callsign.updated_at,
        latest_action_id: callsign.latest_action_id,
        latest_action_status: callsign.latest_action_status,
        latest_action_manager_name: callsign.latest_action_manager_name,
        latest_action_updated_at: callsign.latest_action_updated_at,
        // camelCase 별칭
        airlineId: callsign.airline_id,
        airlineCode: callsign.airline_code,
        callsignPair: callsign.callsign_pair,
        myCallsign: callsign.my_callsign,
        otherCallsign: callsign.other_callsign,
        otherAirlineCode: callsign.other_airline_code,
        errorType: callsign.error_type,
        subError: callsign.sub_error,
        riskLevel: callsign.risk_level,
        occurrenceCount: callsign.occurrence_count,
        lastOccurredAt: callsign.last_occurred_at,
        fileUploadId: callsign.file_upload_id,
        uploadedAt: callsign.uploaded_at,
        createdAt: callsign.created_at,
        updatedAt: callsign.updated_at,
        latestActionId: callsign.latest_action_id,
        latestActionStatus: callsign.latest_action_status,
        latestActionManager: callsign.latest_action_manager_name,
        latestActionUpdatedAt: callsign.latest_action_updated_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('유사호출부호 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '유사호출부호 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
