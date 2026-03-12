/**
 * GET /api/callsigns-with-actions
 * 관리자용: 호출부호와 양쪽 항공사의 조치 상태를 함께 조회
 *
 * 쿼리 파라미터:
 *   - riskLevel: 위험도 필터 (매우높음|높음|낮음)
 *   - airlineId: 항공사 ID 필터 (UUID)
 *   - myActionStatus: 최종 조치 상태 필터 (complete|partial|in_progress)
 *   - actionType: 조치 유형 필터
 *   - dateFrom: 등록일자 시작 (YYYY-MM-DD, uploaded_at 기준)
 *   - dateTo: 등록일자 종료 (YYYY-MM-DD, uploaded_at 기준)
 *   - page: 페이지 번호 (기본값: 1)
 *   - limit: 페이지 크기 (기본값: 20, 최대: 100)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * 최종 조치 상태 계산 (3가지로 구분)
 * - 'complete': 조치 완료
 *   ├─ 같은 항공사(KAL-KAL): 한쪽만 완료해도 완료
 *   ├─ 국내↔외항사: 자사만 완료해도 완료
 *   └─ 국내↔국내: 양쪽 모두 완료해야 완료
 * - 'partial': 국내↔국내에서 한쪽만 완료 (다른 항공사 중 둘 다 국내인 경우에만)
 * - 'in_progress': 아직 조치 없음
 */
function calculateFinalStatus(
  myActionStatus: string,
  otherActionStatus: string,
  myAirlineCode: string,
  otherAirlineCode: string | null,
  domesticAirlines: Set<string>
): 'complete' | 'partial' | 'in_progress' {
  const myCompleted = myActionStatus === 'completed';
  const otherCompleted = otherActionStatus === 'completed';
  const sameAirline = myAirlineCode === otherAirlineCode;
  const otherIsForeignAirline = otherAirlineCode && !domesticAirlines.has(otherAirlineCode);

  // 같은 항공사인 경우: 한쪽만 완료해도 완료
  if (sameAirline) {
    return myCompleted || otherCompleted ? 'complete' : 'in_progress';
  }

  // 다른 항공사인 경우
  if (otherIsForeignAirline) {
    // 상대가 외항사: 자사만 완료하면 완료
    return myCompleted ? 'complete' : 'in_progress';
  } else {
    // 상대가 국내항공사: 양쪽 모두 완료해야 완료
    if (myCompleted && otherCompleted) {
      return 'complete'; // 양쪽 모두 완료
    } else if (myCompleted || otherCompleted) {
      return 'partial'; // 한쪽만 완료
    } else {
      return 'in_progress'; // 아직 조치 없음
    }
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

    // 관리자 권한 확인
    if (payload.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자만 접근할 수 있습니다.' },
        { status: 403 }
      );
    }

    // 쿼리 파라미터
    const riskLevel = request.nextUrl.searchParams.get('riskLevel');
    const airlineId = request.nextUrl.searchParams.get('airlineId');
    const myActionStatus = request.nextUrl.searchParams.get('myActionStatus');
    const actionType = request.nextUrl.searchParams.get('actionType');
    const dateFrom = request.nextUrl.searchParams.get('dateFrom');
    const dateTo = request.nextUrl.searchParams.get('dateTo');
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)));

    // 입력값 검증
    const validRiskLevels = ['매우높음', '높음', '낮음'];
    const filteredRiskLevel = riskLevel && validRiskLevels.includes(riskLevel) ? riskLevel : null;

    // airlineId 형식 검증 (16진수 문자열, 하이픈 있거나 없음)
    const hexRegex = /^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (airlineId && !hexRegex.test(airlineId)) {
      return NextResponse.json(
        { error: '유효하지 않은 항공사 ID입니다.' },
        { status: 400 }
      );
    }

    // myActionStatus 화이트리스트 검증 (최종 상태: complete/partial/in_progress)
    const validActionStatuses = ['complete', 'partial', 'in_progress'];
    if (myActionStatus && !validActionStatuses.includes(myActionStatus)) {
      return NextResponse.json(
        { error: '유효하지 않은 조치 상태입니다.' },
        { status: 400 }
      );
    }

    // SQL 쿼리 파라미터 구성 (페이지네이션은 필터 후 Node.js에서 처리)
    const sqlParams: (string | number)[] = [];
    const whereClauses: string[] = [];

    if (filteredRiskLevel) {
      sqlParams.push(filteredRiskLevel);
      whereClauses.push(`c.risk_level = $${sqlParams.length}`);
    }

    if (airlineId) {
      sqlParams.push(airlineId);
      whereClauses.push(`c.airline_id = $${sqlParams.length}`);
    }

    if (dateFrom) {
      sqlParams.push(dateFrom);
      whereClauses.push(`c.uploaded_at >= $${sqlParams.length}`);
    }

    if (dateTo) {
      const exclusiveDateTo = getExclusiveDateTo(dateTo);
      sqlParams.push(exclusiveDateTo);
      whereClauses.push(`c.uploaded_at < $${sqlParams.length}`);
    }

    const conditions = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // 호출부호 목록 조회 (callsigns + actions 조인으로 조치유형과 처리일자 포함)
    // 자사/타사 조치 상세정보를 airline_code 기준으로 각각 조회
    const callsignsResult = await query(
      `SELECT c.id, c.airline_id, c.airline_code, c.callsign_pair, c.my_callsign, c.other_callsign,
              c.other_airline_code, c.error_type, c.sub_error, c.risk_level, c.similarity,
              c.occurrence_count, c.first_occurred_at, c.last_occurred_at,
              c.file_upload_id, c.uploaded_at, c.status, c.created_at, c.updated_at,
              c.my_action_status, c.other_action_status,
              -- 자사 조치 상세 (airline_code 기준)
              (SELECT a.action_type FROM actions a
               JOIN airlines al ON a.airline_id = al.id
               WHERE a.callsign_id = c.id AND al.code = c.airline_code
               AND COALESCE(a.is_cancelled, false) = false
               ORDER BY a.registered_at DESC LIMIT 1) as action_type,
              (SELECT a.completed_at FROM actions a
               JOIN airlines al ON a.airline_id = al.id
               WHERE a.callsign_id = c.id AND al.code = c.airline_code
               AND COALESCE(a.is_cancelled, false) = false
               ORDER BY a.registered_at DESC LIMIT 1) as action_completed_at,
              (SELECT a.description FROM actions a
               JOIN airlines al ON a.airline_id = al.id
               WHERE a.callsign_id = c.id AND al.code = c.airline_code
               AND COALESCE(a.is_cancelled, false) = false
               ORDER BY a.registered_at DESC LIMIT 1) as my_action_description,
              (SELECT a.manager_name FROM actions a
               JOIN airlines al ON a.airline_id = al.id
               WHERE a.callsign_id = c.id AND al.code = c.airline_code
               AND COALESCE(a.is_cancelled, false) = false
               ORDER BY a.registered_at DESC LIMIT 1) as my_manager_name,
              -- 타사 조치 상세 (other_airline_code 기준)
              (SELECT a.action_type FROM actions a
               JOIN airlines al ON a.airline_id = al.id
               WHERE a.callsign_id = c.id AND al.code = c.other_airline_code
               AND COALESCE(a.is_cancelled, false) = false
               ORDER BY a.registered_at DESC LIMIT 1) as other_action_type_detail,
              (SELECT a.description FROM actions a
               JOIN airlines al ON a.airline_id = al.id
               WHERE a.callsign_id = c.id AND al.code = c.other_airline_code
               AND COALESCE(a.is_cancelled, false) = false
               ORDER BY a.registered_at DESC LIMIT 1) as other_action_description,
              (SELECT a.manager_name FROM actions a
               JOIN airlines al ON a.airline_id = al.id
               WHERE a.callsign_id = c.id AND al.code = c.other_airline_code
               AND COALESCE(a.is_cancelled, false) = false
               ORDER BY a.registered_at DESC LIMIT 1) as other_manager_name,
              (SELECT a.completed_at FROM actions a
               JOIN airlines al ON a.airline_id = al.id
               WHERE a.callsign_id = c.id AND al.code = c.other_airline_code
               AND COALESCE(a.is_cancelled, false) = false
               ORDER BY a.registered_at DESC LIMIT 1) as other_completed_at,
              -- 오류유형별 발생건수 (동적)
              (SELECT json_object_agg(COALESCE(error_type, '미분류'), cnt) FROM (
                SELECT error_type, COUNT(*) as cnt FROM callsign_occurrences WHERE callsign_id = c.id GROUP BY error_type
              ) t) as error_type_counts,
              -- 발생이력 날짜+시간 목록 (날짜별 중복 제거, MM-DD HH:MM 포맷)
              (SELECT STRING_AGG(
                TO_CHAR(occurred_date, 'MM-DD') || ' ' || COALESCE(TO_CHAR(occurred_time, 'HH24:MI'), ''),
                ',' ORDER BY occurred_date DESC
              ) FROM (
                SELECT DISTINCT ON (occurred_date) occurred_date, occurred_time
                FROM callsign_occurrences WHERE callsign_id = c.id
                ORDER BY occurred_date DESC, occurred_time DESC NULLS LAST
                LIMIT 15
              ) _occ) as occurrence_dates
       FROM callsigns c
       ${conditions}
       ORDER BY
         CASE
           WHEN c.risk_level = '매우높음' THEN 3
           WHEN c.risk_level = '높음' THEN 2
           WHEN c.risk_level = '낮음' THEN 1
           ELSE 0
         END DESC,
         c.occurrence_count DESC,
         c.last_occurred_at DESC`,
      sqlParams
    );

    // 국내 항공사 목록 조회 (최종 상태 계산용)
    const airlinesResult = await query('SELECT code FROM airlines');
    const domesticAirlines = new Set(
      (airlinesResult.rows || []).map((a: any) => a.code)
    );

    // 🎯 summary 계산 (필터링 전 - 전체 데이터 기반)
    // 카드의 숫자는 항상 전체 데이터를 기반으로 표시해야 함
    const summary = {
      total: callsignsResult.rows.length,
      completed: callsignsResult.rows.filter((r: any) => {
        const myCompleted = r.my_action_status === 'completed';
        const otherCompleted = r.other_action_status === 'completed';
        const sameAirline = r.airline_code === r.other_airline_code;
        const otherIsForeignAirline = r.other_airline_code && !domesticAirlines.has(r.other_airline_code);

        // 같은 항공사: 한쪽만 완료해도 완료
        if (sameAirline) return myCompleted || otherCompleted;
        // 국내↔외항사: 자사만 완료해도 완료
        if (otherIsForeignAirline) return myCompleted;
        // 국내↔국내: 양쪽 모두 완료해야 완료
        return myCompleted && otherCompleted;
      }).length,
      partial: callsignsResult.rows.filter((r: any) => {
        const myCompleted = r.my_action_status === 'completed';
        const otherCompleted = r.other_action_status === 'completed';
        const sameAirline = r.airline_code === r.other_airline_code;
        const otherIsForeignAirline = r.other_airline_code && !domesticAirlines.has(r.other_airline_code);

        // 같은 항공사: 부분완료 없음
        if (sameAirline) return false;
        // 외항사: 부분완료 없음
        if (otherIsForeignAirline) return false;
        // 국내↔국내: 한쪽만 완료면 부분완료
        return (myCompleted && !otherCompleted) || (!myCompleted && otherCompleted);
      }).length,
      in_progress: callsignsResult.rows.filter((r: any) => {
        const myCompleted = r.my_action_status === 'completed';
        const otherCompleted = r.other_action_status === 'completed';
        const sameAirline = r.airline_code === r.other_airline_code;
        const otherIsForeignAirline = r.other_airline_code && !domesticAirlines.has(r.other_airline_code);

        // 같은 항공사: 둘 다 미완료면 진행중
        if (sameAirline) return !myCompleted && !otherCompleted;
        // 국내↔외항사: 자사가 미완료면 진행중
        if (otherIsForeignAirline) return !myCompleted;
        // 국내↔국내: 둘 다 미완료인 경우만 진행중
        return !myCompleted && !otherCompleted;
      }).length,
    };

    // myActionStatus 필터 적용 (final_status 기반: complete/partial/in_progress)
    let filteredRows = callsignsResult.rows;

    if (myActionStatus) {
      filteredRows = filteredRows.filter((row: any) => {
        const myCompleted = row.my_action_status === 'completed';
        const otherCompleted = row.other_action_status === 'completed';
        const sameAirline = row.airline_code === row.other_airline_code;
        const otherIsForeignAirline = row.other_airline_code && !domesticAirlines.has(row.other_airline_code);

        if (myActionStatus === 'complete') {
          // 완전 완료
          // - 같은 항공사: 한쪽만 완료해도 완료
          // - 국내↔외항사: 자사만 완료해도 완료
          // - 국내↔국내: 양쪽 모두 완료해야 완료
          if (sameAirline) {
            return myCompleted || otherCompleted;
          } else if (otherIsForeignAirline) {
            return myCompleted; // 자사만 완료하면 완료
          } else {
            return myCompleted && otherCompleted; // 국내항공사: 양쪽 모두 완료
          }
        } else if (myActionStatus === 'partial') {
          // 부분 완료: 국내↔국내에서 한쪽만 완료
          if (sameAirline) return false; // 같은 항공사는 부분완료 없음
          if (otherIsForeignAirline) return false; // 외항사는 부분완료 없음
          // 둘 다 국내항공사: 한쪽만 완료
          return (myCompleted && !otherCompleted) || (!myCompleted && otherCompleted);
        } else if (myActionStatus === 'in_progress') {
          // 진행중: 아직 조치가 없거나 국내↔국내에서 미완료
          if (sameAirline) {
            return !myCompleted && !otherCompleted;
          } else if (otherIsForeignAirline) {
            return !myCompleted; // 자사가 미조치
          } else {
            // 국내↔국내: 둘 다 미조치인 경우만
            return !myCompleted && !otherCompleted;
          }
        }
        return true;
      });
    }

    // actionType 필터 적용
    if (actionType) {
      filteredRows = filteredRows.filter((row: any) => row.action_type === actionType);
    }

    // 페이지네이션 처리
    const total = filteredRows.length;
    const offset = (page - 1) * limit;
    const paginatedRows = filteredRows.slice(offset, offset + limit);

    // 전체 개수는 필터링 후 계산 (아래에서 처리)

    return NextResponse.json({
      data: paginatedRows.map((callsign: any) => ({
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
        first_occurred_at: callsign.first_occurred_at,
        last_occurred_at: callsign.last_occurred_at,
        file_upload_id: callsign.file_upload_id,
        uploaded_at: callsign.uploaded_at,
        status: callsign.status,
        created_at: callsign.created_at,
        updated_at: callsign.updated_at,
        // 양쪽 항공사 조치 상태
        my_airline_id: callsign.airline_id,
        my_airline_code: callsign.airline_code,
        my_action_status: callsign.my_action_status || 'no_action',
        other_action_status: callsign.other_action_status || 'no_action',
        // 자사 조치 상세 (actions 테이블)
        action_type: callsign.action_type || null,
        action_completed_at: callsign.action_completed_at || null,
        my_action_description: callsign.my_action_description || null,
        my_manager_name: callsign.my_manager_name || null,
        // 타사 조치 상세
        other_action_type_detail: callsign.other_action_type_detail || null,
        other_action_description: callsign.other_action_description || null,
        other_manager_name: callsign.other_manager_name || null,
        other_completed_at: callsign.other_completed_at || null,
        // 최종 조치 상태 (3가지)
        // - complete: 조치 완료
        //   ├─ 같은 항공사(KAL-KAL): 한쪽만 완료해도 완료
        //   └─ 다른 항공사(KAL-HVN): 양쪽 모두 완료해야 완료
        // - partial: 한쪽만 완료 (다른 항공사인 경우)
        // - in_progress: 아직 조치 없음
        final_status: calculateFinalStatus(
          callsign.my_action_status || 'no_action',
          callsign.other_action_status || 'no_action',
          callsign.airline_code,
          callsign.other_airline_code,
          domesticAirlines
        ),
        // 오류유형별 발생건수 (동적)
        error_type_counts: callsign.error_type_counts || {},
        occurrence_dates: callsign.occurrence_dates || null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary,
    });
  } catch (error) {
    console.error('호출부호 조치 상태 조회 오류:', error);
    return NextResponse.json(
      { error: '호출부호 조치 상태 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
