/**
 * GET /api/admin/occurrences
 * 전체 항공사 발생현황 통합 조회 (관리자 전용)
 *
 * 기존: 11개 항공사 × 5개 DB쿼리 = 55번 쿼리
 * 개선: 4번 쿼리로 전체 데이터 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';

function normalizeOccurrenceTime(value: any): string {
  if (!value) return '00:00';
  const str = String(value).trim();
  const parsed = new Date(str.replace('T', ' '));
  if (!Number.isNaN(parsed.getTime())) {
    return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
  }
  const match = str.match(/(\d{1,2}):(\d{2})/);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  return '00:00';
}

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const payload = verifyToken(authHeader.substring(7));
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    // 1. 전체 콜사인 + 항공사 정보 + AI 분석 데이터 한 번에 조회
    const callsignsResult = await query(
      `SELECT
         c.id, c.airline_id, c.airline_code, c.callsign_pair, c.my_callsign, c.other_callsign,
         c.other_airline_code, c.error_type, c.sub_error, c.risk_level, c.similarity,
         c.status, c.occurrence_count, c.first_occurred_at, c.last_occurred_at,
         c.departure_airport1, c.arrival_airport1,
         a.name_ko as airline_name_ko, a.name_en as airline_name_en,
         ai.ai_score,
         ai.ai_reason,
         ai.reason_type
       FROM callsigns c
       JOIN airlines a ON c.airline_id = a.id
       LEFT JOIN callsign_ai_analysis ai
         ON ai.callsign_pair = c.callsign_a || ' | ' || c.callsign_b
         OR ai.callsign_pair = c.callsign_b || ' | ' || c.callsign_a
       ORDER BY
         CASE WHEN c.risk_level = '매우높음' THEN 4
              WHEN c.risk_level = '높음' THEN 3
              WHEN c.risk_level = '낮음' THEN 1
              ELSE 0 END DESC,
         COALESCE(c.occurrence_count, 0) DESC`,
      []
    );

    if (callsignsResult.rows.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const callsignIds = callsignsResult.rows.map((cs: any) => cs.id);
    const inPlaceholders = callsignIds.map((_: any, i: number) => `$${i + 1}`).join(',');

    // 2. 전체 콜사인 액션 상태 한 번에 조회
    const actionsResult = await query(
      `SELECT DISTINCT ON (callsign_id) id, callsign_id, airline_id, status, action_type, completed_at
       FROM actions
       WHERE callsign_id IN (${inPlaceholders})
         AND COALESCE(is_cancelled, false) = false
       ORDER BY callsign_id, registered_at DESC`,
      callsignIds
    );

    // 3. 전체 발생 이력 한 번에 조회 (날짜별 중복 제거)
    const occurrencesResult = await query(
      `SELECT DISTINCT ON (callsign_id, occurred_date) callsign_id, occurred_date, occurred_time, error_type, sub_error
       FROM callsign_occurrences
       WHERE callsign_id IN (${inPlaceholders})
       ORDER BY callsign_id, occurred_date DESC, occurred_time DESC NULLS LAST`,
      callsignIds
    );

    // 맵 구성
    const actionStatusMap: Record<string, any> = {};
    for (const action of actionsResult.rows) {
      if (!actionStatusMap[action.callsign_id]) {
        actionStatusMap[action.callsign_id] = action;
      }
    }

    const occurrencesMap: Record<string, any[]> = {};
    for (const occ of occurrencesResult.rows) {
      if (!occurrencesMap[occ.callsign_id]) occurrencesMap[occ.callsign_id] = [];
      occurrencesMap[occ.callsign_id].push({
        occurredDate: occ.occurred_date,
        occurredTime: normalizeOccurrenceTime(occ.occurred_time),
        errorType: occ.error_type,
        subError: occ.sub_error,
      });
    }

    const errorTypeSummaryMap: Record<string, any[]> = {};
    for (const id of callsignIds) {
      const occs = occurrencesMap[id] || [];
      const summary: Record<string, number> = {};
      for (const occ of occs) {
        const t = occ.errorType?.replace(/\s+/g, '') || '미분류';
        summary[t] = (summary[t] || 0) + 1;
      }
      errorTypeSummaryMap[id] = Object.entries(summary).map(([errorType, count]) => ({ errorType, count }));
    }

    const data = callsignsResult.rows.map((cs: any) => {
      const latestAction = actionStatusMap[cs.id];
      return {
        id: cs.id,
        airline_id: cs.airline_id,
        airline_code: cs.airline_code,
        airline_name_ko: cs.airline_name_ko,
        callsign_pair: cs.callsign_pair,
        my_callsign: cs.my_callsign,
        other_callsign: cs.other_callsign,
        other_airline_code: cs.other_airline_code,
        error_type: cs.error_type,
        sub_error: cs.sub_error,
        risk_level: cs.risk_level,
        similarity: cs.similarity,
        status: cs.status,
        occurrence_count: cs.occurrence_count || 0,
        first_occurred_at: cs.first_occurred_at,
        last_occurred_at: cs.last_occurred_at,
        departure_airport1: cs.departure_airport1,
        arrival_airport1: cs.arrival_airport1,
        occurrences: occurrencesMap[cs.id] || [],
        errorTypeSummary: errorTypeSummaryMap[cs.id] || [],
        action_id: latestAction?.id || null,
        action_status: latestAction?.status || 'no_action',
        action_type: latestAction?.action_type || null,
        action_completed_at: latestAction?.completed_at || null,
        // AI 분석 데이터
        ai_score: cs.ai_score ?? null,
        ai_reason: cs.ai_reason ?? null,
        reason_type: cs.reason_type ?? null,
        aiScore: cs.ai_score ?? null,
        aiReason: cs.ai_reason ?? null,
        reasonType: cs.reason_type ?? null,
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[admin/occurrences] 오류:', error);
    return NextResponse.json({ error: '발생현황 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
