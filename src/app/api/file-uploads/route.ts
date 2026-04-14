// GET /api/file-uploads - 업로드 이력 조회 (인증된 모든 사용자), 읽기 전용
/**
 * GET /api/file-uploads
 * 파일 업로드 이력 조회 (읽기 전용 - 항공사 사용자 포함 인증된 모든 사용자 접근 가능)
 *
 * 쿼리 파라미터:
 *   - status: pending|processing|completed|failed
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
    // 인증 확인 (관리자 + 항공사 사용자 모두 허용)
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

    // 필터 파라미터
    const status = request.nextUrl.searchParams.get('status');
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    let sql = `
      SELECT
        fu.id, fu.file_name, fu.uploaded_at,
        fu.total_rows, fu.success_count, fu.status
      FROM file_uploads fu
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
      sql += ` AND fu.status = $${paramIndex++}`;
      params.push(status);
    }

    sql += ` ORDER BY fu.uploaded_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await query(sql, params);

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
        uploaded_at: file.uploaded_at,
        total_rows: file.total_rows,
        success_count: file.success_count,
        status: file.status,
        // camelCase 별칭
        fileName: file.file_name,
        uploadedAt: file.uploaded_at,
        totalRows: file.total_rows,
        successCount: file.success_count,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('업로드 이력 조회 오류', error, 'api/file-uploads');
    return NextResponse.json(
      { error: '업로드 이력 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
