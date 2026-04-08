// GET /api/airlines/[airlineId]/callsigns - 항공사별 유사호출부호 조회, callsigns LEFT JOIN callsign_ai_analysis(원본쌍 키), 항공사 관점 my/other 재구성, actions·callsign_occurrences 조인, riskLevel 필터, 위험도·발생횟수순 정렬
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
import { logger } from '@/lib/logger';

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

    // 토큰에서 항공사 ID 확인 (관리자는 항공사 없이도 접근 가능)
    const tokenAirlineId = payload.airlineId;
    const isAdmin = payload.role === 'admin';
    if (!isAdmin && !tokenAirlineId) {
      return NextResponse.json(
        { error: '토큰에 항공사 정보가 없습니다.' },
        { status: 401 }
      );
    }

    // 요청한 항공사 ID가 로그인 사용자의 항공사 ID와 일치하는지 확인 (관리자는 제외)
    if (!isAdmin && requestedAirlineId !== tokenAirlineId) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 필터 파라미터
    const riskLevel = request.nextUrl.searchParams.get('riskLevel');
    const fileUploadId = request.nextUrl.searchParams.get('fileUploadId');
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(1000, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    // fileUploadId UUID 형식 검증
    const hexRegex = /^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validFileUploadId = fileUploadId && hexRegex.test(fileUploadId) ? fileUploadId : null;

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
    let uploadJoinClause = '';
    let uploadWhereClause = '';
    let isRepeatedSelect = 'false AS is_repeated';

    if (filteredRiskLevel) {
      queryParams.push(filteredRiskLevel);
      riskLevelCondition = `AND risk_level = $${queryParams.length}`;
    }

    if (validFileUploadId) {
      queryParams.push(validFileUploadId);
      const uploadParamIdx = queryParams.length;
      uploadJoinClause = `LEFT JOIN callsign_uploads cu_batch ON cu_batch.callsign_id = c.id AND cu_batch.file_upload_id = $${uploadParamIdx}`;
      uploadWhereClause = `AND (cu_batch.callsign_id IS NOT NULL OR (c.file_upload_id = $${uploadParamIdx} AND NOT EXISTS (SELECT 1 FROM callsign_uploads cu_chk WHERE cu_chk.callsign_id = c.id)))`;
      isRepeatedSelect = `EXISTS (SELECT 1 FROM callsign_uploads cu_prev WHERE cu_prev.callsign_id = c.id AND cu_prev.file_upload_id != $${uploadParamIdx}) AS is_repeated`;
    }

    queryParams.push(limit);
    const limitIdx = queryParams.length;
    queryParams.push(offset);
    const offsetIdx = queryParams.length;

    const callsignsResult = await query(
      `SELECT
         c.id, c.airline_id,
         c.my_callsign, c.other_callsign,
         c.airline_code, c.other_airline_code,
         c.my_action_status, c.other_action_status,
         c.callsign_pair,
         c.error_type, c.sub_error, c.risk_level, c.similarity,
         c.departure_airport1, c.arrival_airport1, c.departure_airport2, c.arrival_airport2,
         c.file_upload_id, c.uploaded_at, c.status, c.created_at, c.updated_at,
         COALESCE(c.occurrence_count, 0) AS occurrence_count,
         c.first_occurred_at,
         c.last_occurred_at,
         c.re_detected_acknowledged_at,
         ${isRepeatedSelect},
         -- AI 분석 데이터
         ai.ai_score,
         ai.ai_reason,
         ai.reason_type
       FROM callsigns c
       ${uploadJoinClause}
       LEFT JOIN callsign_ai_analysis ai
         ON ai.callsign_pair = c.callsign_pair
       WHERE (c.airline_code = $1 OR c.other_airline_code = $1)
         ${riskLevelCondition}
         ${uploadWhereClause}
       ORDER BY
         CASE WHEN c.status = 'in_progress' THEN 0 ELSE 1 END,
         CASE
           WHEN c.risk_level = '매우높음' THEN 2
           WHEN c.risk_level = '높음' THEN 1
           ELSE 0
         END DESC,
         COALESCE(c.occurrence_count, 0) DESC,
         c.last_occurred_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      queryParams
    );

    // 국내 항공사 코드 Set (DB 조회, FOREIGN 제외)
    const domesticAirlinesResult = await query("SELECT code FROM airlines WHERE code != 'FOREIGN'");
    const domesticAirlines = new Set<string>(
      (domesticAirlinesResult.rows || []).map((a: any) => a.code as string)
    );

    // 각 호출부호에 대한 조치 상태 조회
    const callsignIds = callsignsResult.rows.map((cs: any) => cs.id);
    // 내 조치와 상대 조치를 분리해서 저장
    const myActionMap: { [key: string]: any } = {};
    const otherActionMap: { [key: string]: any } = {};
    const occurrencesMap: { [key: string]: any[] } = {};
    const errorTypeSummaryMap: { [key: string]: any[] } = {};

    if (callsignIds.length > 0) {
      const inPlaceholders = callsignIds.map((_: any, i: number) => `$${i + 1}`).join(',');

      // 조치 상태 조회 (양쪽 항공사 모두 조회 - 재발생 판단을 위해)
      const actionsResult = await query(
        `SELECT a.id, a.callsign_id, a.airline_id, a.status, a.action_type, a.description, a.manager_name, a.completed_at,
                al.code as action_airline_code
         FROM actions a
         JOIN airlines al ON al.id = a.airline_id
         WHERE a.callsign_id IN (${inPlaceholders})
           AND COALESCE(a.is_cancelled, false) = false
         ORDER BY a.registered_at DESC`,
        [...callsignIds]
      );

      // 각 호출부호별 내 조치 / 상대 조치 분리 저장
      for (const action of actionsResult.rows) {
        const isMyAction = action.airline_id === requestedAirlineId;
        if (isMyAction) {
          if (!myActionMap[action.callsign_id]) {
            myActionMap[action.callsign_id] = action;
          }
        } else {
          if (!otherActionMap[action.callsign_id]) {
            otherActionMap[action.callsign_id] = action;
          }
        }
      }

      // 발생 이력 상세 조회 (callsign_occurrences 테이블) - 전체 발생건수 (섹터별 모든 검출 포함)
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
          const normalizedType = occ.errorType?.replace(/\s+/g, '') || '오류미발생';
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
    let countUploadJoin = '';
    let countUploadWhere = '';

    if (filteredRiskLevel) {
      countParams.push(filteredRiskLevel);
      countRiskCondition = `AND c.risk_level = $${countParams.length}`;
    }

    if (validFileUploadId) {
      countParams.push(validFileUploadId);
      const countUploadIdx = countParams.length;
      countUploadJoin = `LEFT JOIN callsign_uploads cu_batch ON cu_batch.callsign_id = c.id AND cu_batch.file_upload_id = $${countUploadIdx}`;
      countUploadWhere = `AND (cu_batch.callsign_id IS NOT NULL OR (c.file_upload_id = $${countUploadIdx} AND NOT EXISTS (SELECT 1 FROM callsign_uploads cu_chk WHERE cu_chk.callsign_id = c.id)))`;
    }

    const countResult = await query(
      `SELECT COUNT(DISTINCT c.id) as total
       FROM callsigns c
       ${countUploadJoin}
       WHERE (c.airline_code = $1 OR c.other_airline_code = $1)
         ${countRiskCondition}
         ${countUploadWhere}`,
      countParams
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // needSwap 행들의 자사 acknowledged 타임스탬프 조회
    // (other_airline_code로 매칭된 행은 상대 항공사의 acknowledged_at이므로, 자사 행의 값이 필요)
    const myAcknowledgedMap: { [callsignPair: string]: string | null } = {};
    const swapPairs = callsignsResult.rows
      .filter((cs: any) => {
        const myPrefix = (cs.my_callsign || '').replace(/[0-9]/g, '');
        const otherPrefix = (cs.other_callsign || '').replace(/[0-9]/g, '');
        return myPrefix !== airlineCode && otherPrefix === airlineCode;
      })
      .map((cs: any) => cs.callsign_pair);

    if (swapPairs.length > 0) {
      const uniqueSwapPairs = [...new Set(swapPairs)];
      const swapPlaceholders = uniqueSwapPairs.map((_: string, i: number) => `$${i + 2}`).join(',');
      const swapResult = await query(
        `SELECT callsign_pair, re_detected_acknowledged_at FROM callsigns
         WHERE airline_code = $1 AND callsign_pair IN (${swapPlaceholders})`,
        [airlineCode, ...uniqueSwapPairs]
      );
      for (const row of swapResult.rows) {
        myAcknowledgedMap[row.callsign_pair] = row.re_detected_acknowledged_at;
      }
    }

    return NextResponse.json({
      data: callsignsResult.rows.map((callsign: any) => {
        const myAction = myActionMap[callsign.id];
        const otherAction = otherActionMap[callsign.id];
        const occurrences = occurrencesMap[callsign.id] || [];
        const errorTypeSummary = errorTypeSummaryMap[callsign.id] || [];

        // 로그인 항공사 기준으로 my/other 정렬
        // DB에는 쌍 정규화(알파벳순)로 저장되므로, 호출부호 prefix로 로그인 항공사 관점 재정렬
        const myCallsignPrefix = (callsign.my_callsign || '').replace(/[0-9]/g, '');
        const otherCallsignPrefix = (callsign.other_callsign || '').replace(/[0-9]/g, '');
        const needSwap = myCallsignPrefix !== airlineCode && otherCallsignPrefix === airlineCode;
        const myCs = needSwap ? callsign.other_callsign : callsign.my_callsign;
        const otherCs = needSwap ? callsign.my_callsign : callsign.other_callsign;
        const otherCode = needSwap ? myCallsignPrefix : otherCallsignPrefix;
        // 출도착 공항도 callsign 관점에 맞게 스왑
        const myDep = needSwap ? callsign.departure_airport2 : callsign.departure_airport1;
        const myArr = needSwap ? callsign.arrival_airport2 : callsign.arrival_airport1;
        const otherDep = needSwap ? callsign.departure_airport1 : callsign.departure_airport2;
        const otherArr = needSwap ? callsign.arrival_airport1 : callsign.arrival_airport2;

        // 최근 발생 시각 (재발생 판단 + 재검출 확인 여부 모두 사용)
        const lastOccurred = callsign.last_occurred_at ? new Date(callsign.last_occurred_at).getTime() : 0;

        // 재발생 판단 로직 (국내↔국내 vs 외항사 케이스 구분)
        const calculateReDetected = (): boolean => {
          if (lastOccurred === 0) return false;

          const myAirlineIsDomestic = domesticAirlines.has(airlineCode);
          const otherAirlineIsDomestic = domesticAirlines.has(otherCode || '');
          const isDomesticVsDomestic = myAirlineIsDomestic && otherAirlineIsDomestic;

          // 같은 항공사끼리인 경우 (KAL↔KAL)
          const isSameAirline = airlineCode === otherCode;

          if (isSameAirline) {
            // 같은 항공사: 내 조치 완료만으로 판단
            const myCompletedAt = myAction?.completed_at ? new Date(myAction.completed_at).getTime() : 0;
            return myCompletedAt > 0 && lastOccurred > myCompletedAt;
          }

          if (isDomesticVsDomestic) {
            // 국내↔국내: 양쪽 모두 조치 완료되어야 "조치 완료"로 간주
            const myCompleted = myAction?.status === 'completed';
            const otherCompleted = otherAction?.status === 'completed';

            if (!myCompleted || !otherCompleted) {
              // 아직 양쪽 모두 완료되지 않음 → 재발생 아님 (진행 중)
              return false;
            }

            // 양쪽 완료 시점 중 더 늦은 시점 이후에 발생해야 재발생
            const myCompletedAt = myAction?.completed_at ? new Date(myAction.completed_at).getTime() : 0;
            const otherCompletedAt = otherAction?.completed_at ? new Date(otherAction.completed_at).getTime() : 0;
            const lastCompletedAt = Math.max(myCompletedAt, otherCompletedAt);

            return lastCompletedAt > 0 && lastOccurred > lastCompletedAt;
          } else {
            // 국내↔외항사: 국내 항공사 조치 완료만으로 판단
            const myCompletedAt = myAction?.completed_at ? new Date(myAction.completed_at).getTime() : 0;
            return myCompletedAt > 0 && lastOccurred > myCompletedAt;
          }
        };

        const reDetectedValue = calculateReDetected();

        // 재검출 확인 여부: acknowledged_at >= last_occurred_at 이면 확인 완료
        // needSwap인 경우 자사 행의 acknowledged 타임스탬프 사용 (상대 행의 값이 아닌)
        const myAcknowledgedAt = needSwap
          ? (myAcknowledgedMap[callsign.callsign_pair] || null)
          : callsign.re_detected_acknowledged_at;
        const acknowledgedAt = myAcknowledgedAt
          ? new Date(myAcknowledgedAt).getTime()
          : 0;
        const reDetectedAcknowledged = reDetectedValue && acknowledgedAt > 0 && acknowledgedAt >= lastOccurred;

        return {
          id: callsign.id,
          airline_id: callsign.airline_id,
          airline_code: airlineCode,
          callsign_pair: needSwap ? `${myCs} | ${otherCs}` : callsign.callsign_pair,
          my_callsign: myCs,
          other_callsign: otherCs,
          other_airline_code: otherCode,
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
          // 출도착 공항 (로그인 항공사 관점)
          departure_airport1: myDep,
          arrival_airport1: myArr,
          departure_airport2: otherDep,
          arrival_airport2: otherArr,
          // 발생 이력 상세 정보
          occurrences,
          errorTypeSummary,
          // 조치 상태 추가 (내 조치 기준)
          action_id: myAction?.id || null,
          action_status: myAction?.status || 'no_action',
          action_type: myAction?.action_type || null,
          action_description: myAction?.description || null,
          action_completed_at: myAction?.completed_at || null,
          // 상대 항공사 조치 상태 추가 (국내↔국내 재발생 판단용)
          other_action_status: otherAction?.status || 'no_action',
          other_action_type: otherAction?.action_type || null,
          other_action_description: otherAction?.description || null,
          other_manager_name: otherAction?.manager_name || null,
          other_action_completed_at: otherAction?.completed_at || null,
          // camelCase 별칭
          airlineId: callsign.airline_id,
          airlineCode: airlineCode,
          callsignPair: callsign.callsign_pair,
          myCallsign: myCs,
          otherCallsign: otherCs,
          otherAirlineCode: otherCode,
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
          departureAirport: myDep,
          arrivalAirport: myArr,
          actionId: myAction?.id || null,
          actionStatus: myAction?.status || 'no_action',
          actionType: myAction?.action_type || null,
          actionDescription: myAction?.description || null,
          actionCompletedAt: myAction?.completed_at || null,
          otherActionStatus: otherAction?.status || 'no_action',
          otherActionType: otherAction?.action_type || null,
          otherActionDescription: otherAction?.description || null,
          otherManagerName: otherAction?.manager_name || null,
          otherActionCompletedAt: otherAction?.completed_at || null,
          // 재발생 여부
          re_detected: reDetectedValue,
          reDetected: reDetectedValue,
          // 재검출 확인 여부
          re_detected_acknowledged: reDetectedAcknowledged,
          reDetectedAcknowledged: reDetectedAcknowledged,
          // 이전 업로드에도 있던 건 여부 (업로드 배치 필터 시에만 의미 있음)
          is_repeated: callsign.is_repeated ?? false,
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
    logger.error('항공사별 호출부호 조회 오류', error, 'api/airlines/[airlineId]/callsigns');
    return NextResponse.json(
      { error: '항공사별 호출부호 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
