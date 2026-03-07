/**
 * GET /api/actions/[id]
 * 조치 상세 조회
 *
 * PATCH /api/actions/[id]
 * 조치 상태 업데이트 (인증된 사용자)
 *
 * DELETE /api/actions/[id]
 * 조치 삭제 (관리자만)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query, transaction } from '@/lib/db';
import { syncCallsignStatus } from '@/lib/db/sync-callsign-status';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;

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

    // 조치 조회
    const result = await query(
      `SELECT
        a.id, a.airline_id, a.callsign_id, a.action_type, a.description,
        a.manager_name, a.planned_due_date,
        a.status, a.result_detail, a.completed_at,
        a.registered_by, a.registered_at, a.updated_at,
        a.reviewed_by, a.reviewed_at, a.review_comment,
        al.code as airline_code, al.name_ko as airline_name_ko, al.name_en as airline_name_en,
        cs.callsign_pair, cs.my_callsign, cs.other_callsign, cs.risk_level, cs.similarity,
        cs.error_type, cs.sub_error, cs.occurrence_count
      FROM actions a
      LEFT JOIN airlines al ON a.airline_id = al.id
      LEFT JOIN callsigns cs ON a.callsign_id = cs.id
      WHERE a.id = ?`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: '조치를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const action = result.rows[0];

    return NextResponse.json({
      id: action.id,
      airline_id: action.airline_id,
      airline: action.airline_code ? {
        id: action.airline_id,
        code: action.airline_code,
        name_ko: action.airline_name_ko,
        name_en: action.airline_name_en,
      } : null,
      callsign_id: action.callsign_id,
      callsign: action.callsign_pair ? {
        callsign_pair: action.callsign_pair,
        my_callsign: action.my_callsign,
        other_callsign: action.other_callsign,
        risk_level: action.risk_level,
        similarity: action.similarity,
        error_type: action.error_type,
        sub_error: action.sub_error,
        occurrence_count: action.occurrence_count,
      } : null,
      action_type: action.action_type,
      description: action.description,
      manager_name: action.manager_name,
      planned_due_date: action.planned_due_date,
      status: action.status,
      result_detail: action.result_detail,
      completed_at: action.completed_at,
      registered_by: action.registered_by,
      registered_at: action.registered_at,
      updated_at: action.updated_at,
      reviewed_by: action.reviewed_by,
      reviewed_at: action.reviewed_at,
      review_comment: action.review_comment,
    });
  } catch (error) {
    console.error('조치 상세 조회 오류:', error);
    return NextResponse.json(
      { error: '조치 상세 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;

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

    // 요청 본문
    const {
      status,
      action_type,
      description,
      manager_name,
      planned_due_date,
      result_detail,
      completed_at,
      review_comment,
    } = await request.json();

    // 상태 검증
    if (status && !['pending', 'in_progress', 'completed'].includes(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태입니다.' },
        { status: 400 }
      );
    }

    // 기존 조치 확인
    const existingAction = await query(
      `SELECT a.id, a.status, a.callsign_id, a.airline_id, a.action_type, a.description,
        a.manager_name, a.planned_due_date, a.completed_at,
        a.registered_by, a.registered_at,
        c.airline_code, c.other_airline_code
       FROM actions a LEFT JOIN callsigns c ON a.callsign_id = c.id WHERE a.id = ?`,
      [id]
    );

    if (existingAction.rows.length === 0) {
      return NextResponse.json(
        { error: '조치를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 권한 확인: 해당 조치를 수정할 권한이 있는지 확인
    const actionAirlineId = existingAction.rows[0].airline_id;
    if (payload.role !== 'admin' && payload.airlineId !== actionAirlineId) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 상태 로직: in_progress = 조치 취소 (같은 row UPDATE)
    if (status === 'in_progress') {
      // in_progress = 조치 취소 (같은 row를 UPDATE, is_cancelled 플래그 추가)
      const existingData = existingAction.rows[0];
      const callsignId = existingData.callsign_id;
      const airlineId = existingData.airline_id;
      const airlineCode = existingData.airline_code;

      // 자사/타사 판단 (현재 항공사 코드와 비교)
      const airlineCheck = await query('SELECT code FROM airlines WHERE id = ?', [airlineId]);
      const isMy = airlineCheck.rows[0]?.code === airlineCode;

      // 트랜잭션: action UPDATE + callsigns 상태 동기화
      const result = await transaction(async (trx) => {
        // 1. 조치 취소: status를 in_progress로 변경, is_cancelled 플래그 추가
        const nowIso = new Date().toISOString();
        trx(
          `UPDATE actions SET
            status = ?,
            is_cancelled = 1,
            reviewed_by = ?,
            reviewed_at = ?,
            updated_at = ?
           WHERE id = ?`,
          ['in_progress', payload.userId, nowIso, nowIso, id]
        );

        // 2. callsigns 동기화 (중앙화된 함수 사용)
        // Phase 1: syncCallsignStatus 함수로 my_action_status, other_action_status, status 자동 계산
        syncCallsignStatus(trx, {
          callsignId,
          actingAirlineCode: airlineCode,
          newActionStatus: 'in_progress'  // 취소 = in_progress
        });

        // 3. 업데이트된 조치 조회
        const updatedAction = await trx('SELECT * FROM actions WHERE id = ?', [id]);
        return updatedAction;
      });

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: '조치 취소에 실패했습니다.' },
          { status: 500 }
        );
      }

      // 취소된 조치 데이터 반환
      return NextResponse.json(result.rows[0], { status: 200 });
    }

    // 업데이트 필드 구성 (completed 또는 다른 상태 업데이트)
    let sql = 'UPDATE actions SET ';
    const fields: string[] = [];
    const values: any[] = [];

    // status 필드 업데이트 (필수)
    if (status !== undefined) {
      fields.push(`status = ?`);
      values.push(status);
    }

    if (action_type !== undefined) {
      fields.push(`action_type = ?`);
      values.push(action_type);
    }
    if (description !== undefined) {
      fields.push(`description = ?`);
      values.push(description);
    }
    if (manager_name !== undefined) {
      fields.push(`manager_name = ?`);
      values.push(manager_name);
    }
    if (planned_due_date !== undefined) {
      fields.push(`planned_due_date = ?`);
      values.push(planned_due_date);
    }
    if (result_detail !== undefined) {
      fields.push(`result_detail = ?`);
      values.push(result_detail);
    }
    if (completed_at !== undefined) {
      fields.push(`completed_at = ?`);
      values.push(completed_at);
    }
    if (review_comment !== undefined) {
      fields.push(`review_comment = ?`);
      values.push(review_comment);
    }

    // 검토 정보 추가
    fields.push(`reviewed_by = ?`);
    values.push(payload.userId); // 현재 관리자 ID

    fields.push(`reviewed_at = ?`);
    values.push(new Date().toISOString());

    fields.push(`updated_at = ?`);
    values.push(new Date().toISOString());

    sql += fields.join(', ') + ` WHERE id = ?`;
    values.push(id);

    // 트랜잭션: action 업데이트 + callsigns 상태 동기화
    const callsignId = existingAction.rows[0].callsign_id;
    const airlineId = existingAction.rows[0].airline_id;
    const airlineCode = existingAction.rows[0].airline_code;

    // 자사/타사 판단
    const airlineCheck = await query('SELECT code FROM airlines WHERE id = ?', [airlineId]);
    const isMy = airlineCheck.rows[0]?.code === airlineCode;

    // 국내 항공사 목록 조회 (국내/외항사 판별용)
    const domesticAirlinesResult = await query('SELECT code FROM airlines');
    const domesticAirlines = new Set(
      (domesticAirlinesResult.rows || []).map((a: any) => a.code)
    );

    const result = await transaction(async (trx) => {
      // 1. action 업데이트
      const actionResult = await trx(sql, values);

      if (actionResult.changes > 0) {
        // 2. 업데이트된 action 조회 (응답용)
        const updated = await trx('SELECT * FROM actions WHERE id = ?', [id]);
        if (updated.rows.length > 0) {
          const newStatus = updated.rows[0].status;

          // 3. callsigns 동기화 (중앙화된 함수 사용)
          // Phase 1: syncCallsignStatus 함수로 my_action_status, other_action_status, status 자동 계산
          syncCallsignStatus(trx, {
            callsignId,
            actingAirlineCode: airlineCode,
            newActionStatus: newStatus
          });
        }
        return updated;
      }

      return { rows: [], changes: 0 };
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: '조치 업데이트에 실패했습니다.' },
        { status: 500 }
      );
    }

    const updatedAction = result.rows[0];

    return NextResponse.json({
      id: updatedAction.id,
      airline_id: updatedAction.airline_id,
      callsign_id: updatedAction.callsign_id,
      action_type: updatedAction.action_type,
      description: updatedAction.description,
      manager_name: updatedAction.manager_name,
      planned_due_date: updatedAction.planned_due_date,
      status: updatedAction.status,
      result_detail: updatedAction.result_detail,
      completed_at: updatedAction.completed_at,
      registered_by: updatedAction.registered_by,
      registered_at: updatedAction.registered_at,
      updated_at: updatedAction.updated_at,
      reviewed_by: updatedAction.reviewed_by,
      reviewed_at: updatedAction.reviewed_at,
      review_comment: updatedAction.review_comment,
      callsignId: updatedAction.callsign_id,
      actionType: updatedAction.action_type,
      managerName: updatedAction.manager_name,
      plannedDueDate: updatedAction.planned_due_date,
      resultDetail: updatedAction.result_detail,
      completedAt: updatedAction.completed_at,
      registeredBy: updatedAction.registered_by,
      registeredAt: updatedAction.registered_at,
      updatedAt: updatedAction.updated_at,
      reviewedBy: updatedAction.reviewed_by,
      reviewedAt: updatedAction.reviewed_at,
      reviewComment: updatedAction.review_comment,
    });
  } catch (error) {
    console.error('조치 업데이트 오류:', error);
    return NextResponse.json(
      { error: '조치 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;

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

    if (!payload || payload.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자만 접근 가능합니다.' },
        { status: 403 }
      );
    }

    // 조치 존재 확인 및 callsign 정보 조회
    const existingAction = await query(
      'SELECT a.id, a.callsign_id, a.airline_id, c.airline_code, c.other_airline_code FROM actions a LEFT JOIN callsigns c ON a.callsign_id = c.id WHERE a.id = ?',
      [id]
    );

    if (existingAction.rows.length === 0) {
      return NextResponse.json(
        { error: '조치를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const actionData = existingAction.rows[0];
    const airlineId = actionData.airline_id;
    const airlineCode = actionData.airline_code;
    const callsignId = actionData.callsign_id;

    // 자사/타사 판단
    const airlineCheck = await query('SELECT code FROM airlines WHERE id = ?', [airlineId]);
    const isMy = airlineCheck.rows[0]?.code === airlineCode;

    // 삭제 (on_delete cascade는 자동으로 action_history도 삭제)
    // 동시에 callsigns 상태 업데이트
    await transaction(async (trx) => {
      // 1. action 삭제
      trx('DELETE FROM actions WHERE id = ?', [id]);

      // 2. callsigns 동기화 (중앙화된 함수 사용)
      // Phase 1: syncCallsignStatus 함수로 my_action_status, other_action_status, status 자동 계산
      syncCallsignStatus(trx, {
        callsignId,
        actingAirlineCode: airlineCode,
        newActionStatus: 'no_action'  // 삭제 = no_action
      });
    });

    return NextResponse.json(
      { message: '조치가 삭제되었습니다.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('조치 삭제 오류:', error);
    return NextResponse.json(
      { error: '조치 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
