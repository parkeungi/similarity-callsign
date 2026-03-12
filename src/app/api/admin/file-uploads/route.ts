// GET/POST /api/admin/file-uploads - 파일 업로드 이력 조회(GET)/생성(POST), file_uploads 테이블, 관리자 전용
/**
 * GET /api/admin/file-uploads
 * 파일 업로드 이력 조회
 *
 * 쿼리 파라미터:
 *   - status: pending|processing|completed|failed
 *   - page: 페이지 번호 (기본값: 1)
 *   - limit: 페이지 크기 (기본값: 20)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 인증 확인 (관리자만)
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
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    // 필터 파라미터
    const status = request.nextUrl.searchParams.get('status');
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    // 기본 쿼리 (사용자 이메일 정보 JOIN)
    let sql = `
      SELECT
        fu.id, fu.file_name, fu.file_size, fu.uploaded_by, fu.uploaded_at,
        fu.total_rows, fu.success_count, fu.failed_count, fu.error_message, fu.status, fu.processed_at,
        u.email as uploader_email
      FROM file_uploads fu
      LEFT JOIN users u ON fu.uploaded_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // 상태 필터
    if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
      sql += ` AND fu.status = $${paramIndex++}`;
      params.push(status);
    }

    // 정렬 및 페이지네이션 (최신 순)
    sql += ` ORDER BY fu.uploaded_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    // 전체 개수 조회
    let countSql = `SELECT COUNT(*) as total FROM file_uploads fu WHERE 1=1`;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
      countSql += ` AND fu.status = $${countParamIndex++}`;
      countParams.push(status);
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].total, 10);

    return NextResponse.json({
      data: result.rows.map((file: any) => ({
        id: file.id,
        file_name: file.file_name,
        file_size: file.file_size,
        uploaded_by: file.uploaded_by,
        uploaded_at: file.uploaded_at,
        uploader_email: file.uploader_email,
        total_rows: file.total_rows,
        success_count: file.success_count,
        failed_count: file.failed_count,
        error_message: file.error_message,
        status: file.status,
        processed_at: file.processed_at,
        // camelCase 별칭
        fileName: file.file_name,
        fileSize: file.file_size,
        uploadedBy: file.uploaded_by,
        uploadedAt: file.uploaded_at,
        uploaderEmail: file.uploader_email,
        totalRows: file.total_rows,
        successCount: file.success_count,
        failedCount: file.failed_count,
        errorMessage: file.error_message,
        processedAt: file.processed_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('파일 업로드 이력 조회 오류:', error);
    return NextResponse.json(
      { error: '파일 업로드 이력 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
