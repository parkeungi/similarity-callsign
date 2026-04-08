// GET /api/actions - 전체 조치 목록(관리자용), actions JOIN callsigns·airlines·users, 상태·항공사·날짜 필터, 페이지네이션
/**
 * GET /api/actions
 * 전체 조치 목록 조회 (관리자 대시보드용)
 *
 * 쿼리 파라미터:
 *   - airlineId: 항공사별 필터 (선택사항)
 *   - status: pending|in_progress|completed
 *   - search: 검색어 (유사호출부호, 조치유형, 담당자)
 *   - fileUploadId: 업로드 배치 ID (UUID) - 해당 배치 callsign의 조치만 조회
 *   - dateFrom: 시작 날짜 (YYYY-MM-DD, fileUploadId 없을 때만 적용)
 *   - dateTo: 종료 날짜 (YYYY-MM-DD, fileUploadId 없을 때만 적용)
 *   - page: 페이지 번호 (기본값: 1)
 *   - limit: 페이지 크기 (기본값: 20, 최대: 100)
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

    if (!payload || payload.role !== 'admin') {
      return NextResponse.json(
        { error: '관리자만 접근 가능합니다.' },
        { status: 403 }
      );
    }

    // 필터 파라미터
    const airlineId = request.nextUrl.searchParams.get('airlineId');
    const status = request.nextUrl.searchParams.get('status');
    const search = request.nextUrl.searchParams.get('search');
    const fileUploadId = request.nextUrl.searchParams.get('fileUploadId');
    const dateFrom = request.nextUrl.searchParams.get('dateFrom');
    const dateTo = request.nextUrl.searchParams.get('dateTo');

    // fileUploadId UUID 형식 검증
    const hexRegex = /^[0-9a-f]{32}$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validFileUploadId = fileUploadId && hexRegex.test(fileUploadId) ? fileUploadId : null;
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    // 기본 쿼리
    let paramIndex = 1;
    let sql = `
      SELECT
        a.id, a.airline_id, a.callsign_id, a.action_type, a.description,
        a.manager_name, a.manager_email, a.planned_due_date,
        a.status, a.result_detail, a.completed_at,
        a.registered_by, a.registered_at, a.updated_at,
        a.reviewed_by, a.reviewed_at, a.review_comment,
        al.code as airline_code, al.name_ko as airline_name_ko,
        cs.callsign_pair, cs.my_callsign, cs.other_callsign, cs.risk_level,
        cs.other_airline_code, cs.similarity, cs.occurrence_count, cs.last_occurred_at,
        COALESCE(ru.email, '삭제된 사용자') as registered_by_email
      FROM actions a
      LEFT JOIN airlines al ON a.airline_id = al.id
      LEFT JOIN callsigns cs ON a.callsign_id = cs.id
      LEFT JOIN users ru ON a.registered_by = ru.id
      WHERE COALESCE(a.is_cancelled, false) = false
    `;
    const queryParams: any[] = [];

    // 필터 조건
    if (airlineId) {
      sql += ` AND a.airline_id = $${paramIndex++}`;
      queryParams.push(airlineId);
    }

    if (status && ['pending', 'in_progress', 'completed'].includes(status)) {
      if (status === 'in_progress') {
        // 조치필요 = pending + in_progress 모두 포함
        sql += ` AND a.status IN ('pending', 'in_progress')`;
      } else {
        sql += ` AND a.status = $${paramIndex++}`;
        queryParams.push(status);
      }
    }

    // 검색 조건 (유사호출부호, 조치유형, 담당자)
    if (search && search.trim()) {
      const searchValue = `%${search}%`;
      sql += ` AND (
        cs.callsign_pair ILIKE $${paramIndex++}
        OR a.action_type ILIKE $${paramIndex++}
        OR a.manager_name ILIKE $${paramIndex++}
      )`;
      queryParams.push(searchValue, searchValue, searchValue);
    }

    // 업로드 배치 필터: 해당 배치에 포함된 callsign의 조치만 조회
    // fileUploadId 있을 때는 dateFrom/dateTo 무시
    if (validFileUploadId) {
      sql += ` AND (
        EXISTS (SELECT 1 FROM callsign_uploads cu WHERE cu.callsign_id = a.callsign_id AND cu.file_upload_id = $${paramIndex++})
        OR (cs.file_upload_id = $${paramIndex++} AND NOT EXISTS (SELECT 1 FROM callsign_uploads cu2 WHERE cu2.callsign_id = a.callsign_id))
      )`;
      queryParams.push(validFileUploadId, validFileUploadId);
    } else {
      // 날짜 필터 (fileUploadId 없을 때만)
      if (dateFrom) {
        sql += ` AND DATE(a.registered_at) >= DATE($${paramIndex++})`;
        queryParams.push(dateFrom);
      }
      if (dateTo) {
        sql += ` AND DATE(a.registered_at) <= DATE($${paramIndex++})`;
        queryParams.push(dateTo);
      }
    }

    // 페이지네이션
    sql += ` ORDER BY a.registered_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(limit);
    queryParams.push(offset);

    // 데이터 조회
    const result = await query(sql, queryParams);

    // 전체 개수 조회
    let countParamIndex = 1;
    let countSql = `SELECT COUNT(*) as total FROM actions a LEFT JOIN callsigns cs ON a.callsign_id = cs.id WHERE COALESCE(a.is_cancelled, false) = false`;
    const countParams: any[] = [];

    if (airlineId) {
      countSql += ` AND a.airline_id = $${countParamIndex++}`;
      countParams.push(airlineId);
    }

    if (status && ['pending', 'in_progress', 'completed'].includes(status)) {
      if (status === 'in_progress') {
        countSql += ` AND a.status IN ('pending', 'in_progress')`;
      } else {
        countSql += ` AND a.status = $${countParamIndex++}`;
        countParams.push(status);
      }
    }

    if (search && search.trim()) {
      const searchValue = `%${search}%`;
      countSql += ` AND (
        cs.callsign_pair ILIKE $${countParamIndex++}
        OR a.action_type ILIKE $${countParamIndex++}
        OR a.manager_name ILIKE $${countParamIndex++}
      )`;
      countParams.push(searchValue, searchValue, searchValue);
    }

    if (validFileUploadId) {
      countSql += ` AND (
        EXISTS (SELECT 1 FROM callsign_uploads cu WHERE cu.callsign_id = a.callsign_id AND cu.file_upload_id = $${countParamIndex++})
        OR (cs.file_upload_id = $${countParamIndex++} AND NOT EXISTS (SELECT 1 FROM callsign_uploads cu2 WHERE cu2.callsign_id = a.callsign_id))
      )`;
      countParams.push(validFileUploadId, validFileUploadId);
    } else {
      if (dateFrom) {
        countSql += ` AND DATE(a.registered_at) >= DATE($${countParamIndex++})`;
        countParams.push(dateFrom);
      }
      if (dateTo) {
        countSql += ` AND DATE(a.registered_at) <= DATE($${countParamIndex++})`;
        countParams.push(dateTo);
      }
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].total, 10);

    // 상태별 통계 조회 (전체 데이터 기준)
    let summaryParamIndex = 1;
    let summaryCountParams: any[] = [];
    let summarySql = `SELECT a.status, COUNT(*) as count FROM actions a LEFT JOIN callsigns cs ON a.callsign_id = cs.id WHERE COALESCE(a.is_cancelled, false) = false`;

    if (airlineId) {
      summarySql += ` AND a.airline_id = $${summaryParamIndex++}`;
      summaryCountParams.push(airlineId);
    }

    if (status && ['pending', 'in_progress', 'completed'].includes(status)) {
      if (status === 'in_progress') {
        summarySql += ` AND a.status IN ('pending', 'in_progress')`;
      } else {
        summarySql += ` AND a.status = $${summaryParamIndex++}`;
        summaryCountParams.push(status);
      }
    }

    if (search && search.trim()) {
      const searchValue = `%${search}%`;
      summarySql += ` AND (
        cs.callsign_pair ILIKE $${summaryParamIndex++}
        OR a.action_type ILIKE $${summaryParamIndex++}
        OR a.manager_name ILIKE $${summaryParamIndex++}
      )`;
      summaryCountParams.push(searchValue, searchValue, searchValue);
    }

    if (dateFrom) {
      summarySql += ` AND DATE(a.registered_at) >= DATE($${summaryParamIndex++})`;
      summaryCountParams.push(dateFrom);
    }

    if (dateTo) {
      summarySql += ` AND DATE(a.registered_at) <= DATE($${summaryParamIndex++})`;
      summaryCountParams.push(dateTo);
    }

    summarySql += ` GROUP BY a.status`;
    const summaryResult = await query(summarySql, summaryCountParams);

    const summary = {
      pending: 0,
      in_progress: 0,
      completed: 0,
    };

    summaryResult.rows.forEach((row: any) => {
      const statusKey = row.status === 'in_progress' ? 'in_progress' : row.status;
      summary[statusKey as keyof typeof summary] = parseInt(row.count, 10);
    });

    return NextResponse.json({
      data: result.rows.map((action: any) => ({
        id: action.id,
        airline_id: action.airline_id,
        airline: action.airline_code ? {
          id: action.airline_id,
          code: action.airline_code,
          name_ko: action.airline_name_ko,
        } : null,
        callsign_id: action.callsign_id,
        callsign: action.callsign_pair ? {
          callsign_pair: action.callsign_pair,
          my_callsign: action.my_callsign,
          other_callsign: action.other_callsign,
          risk_level: action.risk_level,
          other_airline_code: action.other_airline_code,
          similarity: action.similarity,
          occurrence_count: action.occurrence_count,
          last_occurred_at: action.last_occurred_at,
        } : null,
        action_type: action.action_type,
        description: action.description,
        manager_name: action.manager_name,
        manager_email: action.manager_email,
        planned_due_date: action.planned_due_date,
        status: action.status,
        result_detail: action.result_detail,
        completed_at: action.completed_at,
        registered_by: action.registered_by,
        registered_by_email: action.registered_by_email,
        registered_at: action.registered_at,
        updated_at: action.updated_at,
        reviewed_by: action.reviewed_by,
        reviewed_at: action.reviewed_at,
        review_comment: action.review_comment,
        // camelCase 별칭
        airlineId: action.airline_id,
        callsignId: action.callsign_id,
        actionType: action.action_type,
        managerName: action.manager_name,
        managerEmail: action.manager_email,
        plannedDueDate: action.planned_due_date,
        resultDetail: action.result_detail,
        completedAt: action.completed_at,
        registeredBy: action.registered_by,
        registeredByEmail: action.registered_by_email,
        registeredAt: action.registered_at,
        updatedAt: action.updated_at,
        reviewedBy: action.reviewed_by,
        reviewedAt: action.reviewed_at,
        reviewComment: action.review_comment,
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
    logger.error('조치 목록 조회 오류', error, 'api/actions');
    return NextResponse.json(
      { error: '조치 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
