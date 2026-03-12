/**
 * GET /api/airlines/[airlineId]/callsigns
 * 항공사별 유사호출부호 목록 조회
 *
 * 쿼리 파라미터:
 *   - riskLevel: 위험도 필터 (매우높음|높음|낮음)
 *   - page: 페이지 번호 (기본값: 1)
 *   - limit: 페이지 크기 (기본값: 20, 최대: 100)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';

function normalizeOccurrenceTime(value: any): string {
  if (!value) return '00:00';
  const normalizeDateString = (input: string) => input.replace('T', ' ').trim();

  const parsed = new Date(normalizeDateString(String(value)));
  if (!Number.isNaN(parsed.getTime())) {
    return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
  }

  const str = String(value).trim();
  const match = str.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const hour = match[1].padStart(2, '0');
    const minute = match[2];
    return `${hour}:${minute}`;
  }
  return '00:00';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ airlineId: string }> }
) {
  try {
    const requestedAirlineId = (await params).airlineId;

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

    // 토큰에서 항공사 ID 확인
    const tokenAirlineId = payload.airlineId;
    if (!tokenAirlineId) {
      return NextResponse.json(
        { error: '토큰에 항공사 정보가 없습니다.' },
        { status: 401 }
      );
    }

    // 요청한 항공사 ID가 로그인 사용자의 항공사 ID와 일치하는지 확인 (관리자는 제외)
    const isAdmin = payload.role === 'admin';
    if (!isAdmin && requestedAirlineId !== tokenAirlineId) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 필터 파라미터
    const riskLevel = request.nextUrl.searchParams.get('riskLevel');
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(1000, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    // 항공사 코드 조회
    const airlineCodeResult = await query(
      'SELECT id, code FROM airlines WHERE id = $1',
      [requestedAirlineId]
    );

    if (airlineCodeResult.rows.length === 0) {
      return NextResponse.json(
        { error: '항공사를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const airlineCode = airlineCodeResult.rows[0].code;

    // 유효한 riskLevel 값 검증
    const validRiskLevels = ['매우높음', '높음', '낮음'];
    const filteredRiskLevel = riskLevel && validRiskLevels.includes(riskLevel) ? riskLevel : null;

    // PostgreSQL 파라미터 빌드
    const queryParams: (string | number)[] = [airlineCode];
    let riskLevelCondition = '';

    if (filteredRiskLevel) {
      queryParams.push(filteredRiskLevel);
      riskLevelCondition = `AND risk_level = $${queryParams.length}`;
    }

    queryParams.push(limit);
    const limitIdx = queryParams.length;
    queryParams.push(offset);
    const offsetIdx = queryParams.length;

    const callsignsResult = await query(
      `SELECT
         c.id, c.airline_id,
         c.callsign_a, c.callsign_b, c.airline_a_code, c.airline_b_code,
         -- 하위 호환: 요청 항공사 관점으로 my/other 재구성
         CASE WHEN c.airline_a_code = $1 THEN c.callsign_a ELSE c.callsign_b END AS my_callsign,
         CASE WHEN c.airline_a_code = $1 THEN c.callsign_b ELSE c.callsign_a END AS other_callsign,
         CASE WHEN c.airline_a_code = $1 THEN c.airline_a_code ELSE c.airline_b_code END AS airline_code,
         CASE WHEN c.airline_a_code = $1 THEN c.airline_b_code ELSE c.airline_a_code END AS other_airline_code,
         CASE WHEN c.airline_a_code = $1 THEN c.action_status_a ELSE c.action_status_b END AS my_action_status,
         CASE WHEN c.airline_a_code = $1 THEN c.action_status_b ELSE c.action_status_a END AS other_action_status,
         -- 자신의 편명이 항상 앞에 표시
         CASE WHEN c.airline_a_code = $1
           THEN c.callsign_a || ' | ' || c.callsign_b
           ELSE c.callsign_b || ' | ' || c.callsign_a
         END AS callsign_pair,
         c.error_type, c.sub_error, c.risk_level, c.similarity,
         c.departure_airport1, c.arrival_airport1,
         c.file_upload_id, c.uploaded_at, c.status, c.created_at, c.updated_at,
         COALESCE(c.occurrence_count, 0) AS occurrence_count,
         c.first_occurred_at,
         c.last_occurred_at,
         -- AI 분석 데이터 (양방향 pair 형식으로 JOIN)
         ai.ai_score,
         ai.ai_reason,
         ai.reason_type
       FROM callsigns c
       LEFT JOIN callsign_ai_analysis ai
         ON ai.callsign_pair = c.callsign_a || ' | ' || c.callsign_b
         OR ai.callsign_pair = c.callsign_b || ' | ' || c.callsign_a
       WHERE (c.airline_a_code = $1 OR c.airline_b_code = $1)
         ${riskLevelCondition}
       ORDER BY
         CASE WHEN c.status = 'in_progress' THEN 0 ELSE 1 END,
         CASE
           WHEN c.risk_level = '매우높음' THEN 3
           WHEN c.risk_level = '높음' THEN 2
           WHEN c.risk_level = '낮음' THEN 1
           ELSE 0
         END DESC,
         COALESCE(c.occurrence_count, 0) DESC,
         c.last_occurred_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams
    );

    // 각 호출부호에 대한 조치 상태 조회
    const callsignIds = callsignsResult.rows.map((cs: any) => cs.id);
    const actionStatusMap: { [key: string]: any } = {};
    const occurrencesMap: { [key: string]: any[] } = {};
    const errorTypeSummaryMap: { [key: string]: any[] } = {};

    if (callsignIds.length > 0) {
      const inPlaceholders = callsignIds.map((_: any, i: number) => `$${i + 1}`).join(',');

      // 조치 상태 조회 (취소되지 않은 조치만)
      const actionsResult = await query(
        `SELECT id, callsign_id, status, action_type, description, completed_at
         FROM actions
         WHERE callsign_id IN (${inPlaceholders})
           AND airline_id = $${callsignIds.length + 1}
           AND COALESCE(is_cancelled, false) = false
         ORDER BY registered_at DESC`,
        [...callsignIds, requestedAirlineId]
      );

      // 각 호출부호별 최신 조치 상태 저장 (중복 제거)
      for (const action of actionsResult.rows) {
        if (!actionStatusMap[action.callsign_id]) {
          actionStatusMap[action.callsign_id] = action;
        }
      }

      // 발생 이력 상세 조회 (callsign_occurrences 테이블) - 날짜와 시간 모두 포함
      const occPlaceholders = callsignIds.map((_: any, i: number) => `$${i + 1}`).join(',');
      const occurrencesResult = await query(
        `SELECT callsign_id, occurred_date, occurred_time, error_type, sub_error
         FROM callsign_occurrences
         WHERE callsign_id IN (${occPlaceholders})
         ORDER BY callsign_id, occurred_date DESC, occurred_time DESC NULLS LAST`,
        callsignIds
      );

      // 호출부호별로 발생 이력 그룹화 (날짜+시간 함께 저장)
      for (const occ of occurrencesResult.rows) {
        if (!occurrencesMap[occ.callsign_id]) {
          occurrencesMap[occ.callsign_id] = [];
        }
        occurrencesMap[occ.callsign_id].push({
          occurredDate: occ.occurred_date,
          occurredTime: normalizeOccurrenceTime(occ.occurred_time),
          errorType: occ.error_type,
          subError: occ.sub_error,
        });
      }

      // 오류 유형별 집계 (공백 제거하여 정규화)
      for (const callsignId of callsignIds) {
        const occurrences = occurrencesMap[callsignId] || [];
        const summary: { [key: string]: number } = {};
        for (const occ of occurrences) {
          const normalizedType = occ.errorType?.replace(/\s+/g, '') || '미분류';
          summary[normalizedType] = (summary[normalizedType] || 0) + 1;
        }
        errorTypeSummaryMap[callsignId] = Object.entries(summary).map(([errorType, count]) => ({
          errorType,
          count,
        }));
      }
    }

    // 전체 개수 조회
    const countParams: (string | number)[] = [airlineCode];
    let countRiskCondition = '';
    if (filteredRiskLevel) {
      countParams.push(filteredRiskLevel);
      countRiskCondition = `AND c.risk_level = $${countParams.length}`;
    }

    const countResult = await query(
      `SELECT COUNT(DISTINCT c.id) as total
       FROM callsigns c
       WHERE (c.airline_a_code = $1 OR c.airline_b_code = $1)
         ${countRiskCondition}`,
      countParams
    );
    const total = parseInt(countResult.rows[0].total, 10);

    return NextResponse.json({
      data: callsignsResult.rows.map((callsign: any) => {
        const latestAction = actionStatusMap[callsign.id];
        const occurrences = occurrencesMap[callsign.id] || [];
        const errorTypeSummary = errorTypeSummaryMap[callsign.id] || [];

        return {
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
          status: callsign.status,
          occurrence_count: callsign.occurrence_count,
          first_occurred_at: callsign.first_occurred_at,
          last_occurred_at: callsign.last_occurred_at,
          file_upload_id: callsign.file_upload_id,
          uploaded_at: callsign.uploaded_at,
          created_at: callsign.created_at,
          updated_at: callsign.updated_at,
          // 방공 정보
          departure_airport1: callsign.departure_airport1,
          arrival_airport1: callsign.arrival_airport1,
          // 발생 이력 상세 정보
          occurrences,
          errorTypeSummary,
          // 조치 상태 추가
          action_id: latestAction?.id || null,
          action_status: latestAction?.status || 'no_action',
          action_type: latestAction?.action_type || null,
          action_description: latestAction?.description || null,
          action_completed_at: latestAction?.completed_at || null,
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
          firstOccurredAt: callsign.first_occurred_at,
          fileUploadId: callsign.file_upload_id,
          uploadedAt: callsign.uploaded_at,
          createdAt: callsign.created_at,
          updatedAt: callsign.updated_at,
          departureAirport: callsign.departure_airport1,
          arrivalAirport: callsign.arrival_airport1,
          actionId: latestAction?.id || null,
          actionStatus: latestAction?.status || 'no_action',
          actionType: latestAction?.action_type || null,
          actionDescription: latestAction?.description || null,
          actionCompletedAt: latestAction?.completed_at || null,
          // AI 분석 데이터
          ai_score: callsign.ai_score ?? null,
          ai_reason: callsign.ai_reason ?? null,
          reason_type: callsign.reason_type ?? null,
          aiScore: callsign.ai_score ?? null,
          aiReason: callsign.ai_reason ?? null,
          reasonType: callsign.reason_type ?? null,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('항공사별 호출부호 조회 오류:', error);
    return NextResponse.json(
      { error: '항공사별 호출부호 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
