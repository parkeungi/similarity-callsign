// PATCH /api/admin/file-uploads/[id] - 파일 업로드 상태 업데이트(processing→completed/failed), file_uploads 테이블
/**
 * DELETE /api/admin/file-uploads/[id]
 * 업로드 이력 삭제 (조치가 없을 때만 가능)
 *
 * 삭제 조건:
 * - 해당 file_upload_id로 연결된 callsigns 중 actions가 1개라도 있으면 409 에러
 * - actions가 없으면 callsigns 삭제 (cascade) → file_uploads 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fileUploadId } = await params;

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

    // 1. 해당 file_upload_id로 연결된 callsigns 확인
    const callsignsResult = await query(
      `SELECT id FROM callsigns WHERE file_upload_id = $1`,
      [fileUploadId]
    );

    const callsignIds = callsignsResult.rows.map((row: any) => row.id);

    if (callsignIds.length > 0) {
      // 2. callsign_id가 actions 테이블에 있는지 확인
      const placeholders = callsignIds.map((_: string, i: number) => `$${i + 1}`).join(',');
      const actionsCountResult = await query(
        `SELECT COUNT(*) as count FROM actions WHERE callsign_id IN (${placeholders})`,
        callsignIds
      );

      const actionsCount = parseInt(actionsCountResult.rows[0].count, 10);

      if (actionsCount > 0) {
        // 409 에러: 조치가 있어 삭제할 수 없음
        return NextResponse.json(
          {
            error: '항공사가 작성한 조치가 있어 삭제할 수 없습니다.',
            can_delete: false,
            actions_count: actionsCount,
          },
          { status: 409 }
        );
      }
    }

    // 3. 조치가 없으면 삭제 진행
    // callsigns 삭제 (ON DELETE CASCADE로 callsign_occurrences 자동 삭제)
    await query(`DELETE FROM callsigns WHERE file_upload_id = $1`, [fileUploadId]);

    // file_uploads 삭제
    const deleteResult = await query(
      `DELETE FROM file_uploads WHERE id = $1`,
      [fileUploadId]
    );

    if (deleteResult.changes === 0) {
      return NextResponse.json(
        { error: '업로드 이력을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: '업로드 이력이 삭제되었습니다.',
      id: fileUploadId,
    });
  } catch (error) {
    logger.error('업로드 이력 삭제 오류', error, 'admin/file-uploads');
    return NextResponse.json(
      { error: '업로드 이력 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
