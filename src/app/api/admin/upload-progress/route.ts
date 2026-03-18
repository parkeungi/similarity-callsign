// GET /api/admin/upload-progress?id=xxx - 업로드 진행 상황 폴링
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }
  const payload = verifyToken(authHeader.substring(7));
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  // id 파라미터 없으면 최신 processing 건 조회
  const id = request.nextUrl.searchParams.get('id');

  let result;
  if (id) {
    result = await query(
      `SELECT id, status, total_rows, success_count, failed_count, file_name, processed_at FROM file_uploads WHERE id = $1`,
      [id]
    );
  } else {
    result = await query(
      `SELECT id, status, total_rows, success_count, failed_count, file_name, processed_at FROM file_uploads WHERE status = 'processing' ORDER BY uploaded_at DESC LIMIT 1`
    );
  }

  if (result.rows.length === 0) {
    return NextResponse.json({ status: 'not_found' });
  }

  const row = result.rows[0];
  return NextResponse.json({
    id: row.id,
    status: row.status,
    totalRows: row.total_rows || 0,
    successCount: row.success_count || 0,
    failedCount: row.failed_count || 0,
    fileName: row.file_name,
    processedAt: row.processed_at,
  });
}
