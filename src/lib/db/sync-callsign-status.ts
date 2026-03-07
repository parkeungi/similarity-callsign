/**
 * callsigns 테이블 상태 동기화 함수 (중앙화)
 *
 * 목적: 조치 상태 변경 시 callsigns 테이블의 다음 3개 컬럼을 원자적으로 업데이트
 * - my_action_status: 자사 항공사의 조치 상태
 * - other_action_status: 상대 항공사의 조치 상태
 * - status: 최종 처리 상태 (in_progress | completed)
 *
 * 사용처:
 * 1. POST /api/airlines/{airlineId]/actions (조치 등록/재조치)
 * 2. PATCH /api/actions/{id] (조치 취소/상태 변경)
 * 3. DELETE /api/actions/{id] (조치 삭제)
 * 4. POST /api/admin/upload-callsigns (초기 데이터 업로드)
 *
 * 반드시 트랜잭션 내에서 호출해야 함:
 * transaction((trx) => {
 *   syncCallsignStatus(trx, { callsignId, actingAirlineCode, newActionStatus });
 * });
 */

export interface SyncCallsignStatusParams {
  callsignId: string;
  actingAirlineCode: string;  // 조치를 수행한(또는 수행 중인) 항공사 코드
  newActionStatus: 'no_action' | 'in_progress' | 'completed';
  // 선택사항: callsign 정보를 미리 전달하면 재조회 불필요
  callsignData?: {
    airline_code: string;
    other_airline_code: string | null;
    my_action_status: string | null;
    other_action_status: string | null;
  };
}

/**
 * 완료 조건 매트릭스
 * callsigns.status를 계산하는 로직
 */
function calculateFinalStatus(
  myActionStatus: string,
  otherActionStatus: string,
  myAirlineCode: string,
  otherAirlineCode: string | null,
  domesticAirlines: Set<string>
): 'in_progress' | 'completed' {
  const myCompleted = myActionStatus === 'completed';
  const otherCompleted = otherActionStatus === 'completed';
  const sameAirline = myAirlineCode === otherAirlineCode;
  const otherIsForeignAirline = otherAirlineCode && !domesticAirlines.has(otherAirlineCode);

  // 같은 항공사: 한쪽만 완료해도 완료
  if (sameAirline) {
    return (myCompleted || otherCompleted) ? 'completed' : 'in_progress';
  }

  // 다른 항공사
  if (otherIsForeignAirline) {
    // 상대가 외항사: 자사만 완료하면 완료
    return myCompleted ? 'completed' : 'in_progress';
  } else {
    // 상대가 국내항공사: 양쪽 모두 완료해야 완료
    return (myCompleted && otherCompleted) ? 'completed' : 'in_progress';
  }
}

/**
 * callsigns 테이블 상태 동기화 (중앙집중식)
 *
 * @param trx - 트랜잭션 함수 (db의 transaction 내에서만 사용 가능)
 * @param params - 동기화 파라미터
 *
 * @throws Error - callsign 찾지 못했거나 동기화 실패
 */
export function syncCallsignStatus(
  trx: (sql: string, params?: any[]) => any,
  params: SyncCallsignStatusParams
): void {
  const { callsignId, actingAirlineCode, newActionStatus, callsignData: providedCallsignData } = params;

  // 1. callsign 정보 조회 (또는 미리 제공된 데이터 사용)
  let callsign;

  if (providedCallsignData) {
    // 미리 조회된 데이터 사용 (트랜잭션 외부에서 조회됨)
    callsign = providedCallsignData;
    console.log('[syncCallsignStatus] Using provided callsign data:', {
      callsignId,
      providedData: callsign,
    });
  } else {
    // 트랜잭션 내에서 조회 (기존 로직)
    const callsignResult = trx(
      `SELECT id, airline_code, other_airline_code, my_action_status, other_action_status
       FROM callsigns WHERE id = ?`,
      [callsignId]
    );

    callsign = callsignResult.rows?.[0];
    if (!callsign) {
      console.error('[syncCallsignStatus] ERROR: callsign not found', {
        callsignId,
        queryResult: callsignResult,
      });
      throw new Error(`callsign not found: ${callsignId}`);
    }
  }

  // 2. 국내항공사 목록 조회
  const airlinesResult = trx('SELECT code FROM airlines');
  const domesticAirlines = new Set(
    (airlinesResult.rows || []).map((a: any) => a.code)
  );

  // 3. isMy 판단: 조치를 수행한 항공사가 자사(airline_code) 측인가?
  const isMy = callsign.airline_code === actingAirlineCode;

  // 4. 양쪽 상태 결정
  let myStatus: string;
  let otherStatus: string;

  if (isMy) {
    myStatus = newActionStatus;
    otherStatus = callsign.other_action_status || 'no_action';
  } else {
    myStatus = callsign.my_action_status || 'no_action';
    otherStatus = newActionStatus;
  }

  // 5. 완료 조건 매트릭스 적용 -> callsigns.status 계산
  const finalStatus = calculateFinalStatus(
    myStatus,
    otherStatus,
    callsign.airline_code,
    callsign.other_airline_code,
    domesticAirlines
  );

  // 6. 단일 UPDATE (원자적 업데이트)
  const updateResult = trx(
    `UPDATE callsigns
     SET my_action_status = ?, other_action_status = ?, status = ?
     WHERE id = ?`,
    [myStatus, otherStatus, finalStatus, callsignId]
  );

  // 일부 SQLite 드라이버는 변경 사항이 없으면 0을 반환하므로 단순 경고만 출력
  if (!updateResult.changes) {
    console.warn('[syncCallsignStatus] No row updated (values already in sync)', { callsignId });
  }

  // 로깅 (개발/디버깅 용도)
  console.log('[syncCallsignStatus] Updated:', {
    callsignId,
    callsignPair: `${callsign.airline_code}|${callsign.other_airline_code}`,
    actingAirline: actingAirlineCode,
    isMy,
    myStatus,
    otherStatus,
    finalStatus,
  });
}
