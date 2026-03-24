// PATCH /api/admin/file-uploads/[id] - 파일 업로드 상태 업데이트(processing→completed/failed), file_uploads 테이블
/**
 * DELETE /api/admin/file-uploads/[id]
 * 업로드 이력 삭제 (조치가 없을 때만 가능)
 *
 * 삭제 로직 (callsign_uploads junction 테이블 기반):
 * - callsign_uploads를 통해 해당 업로드와 연결된 콜사인 조회
 * - 해당 콜사인 중 actions가 있으면 409 에러
 * - callsign_occurrences 삭제 (해당 업로드 것만)
 * - callsign_uploads 링크 삭제
 * - 다른 업로드 링크가 없는 고아 콜사인만 삭제
 * - 생존 콜사인의 file_upload_id를 남은 최신 업로드로 복원
 * - file_uploads 레코드 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query, transaction } from '@/lib/db';
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

    // 1. callsign_uploads junction 테이블에서 해당 업로드와 연결된 콜사인 조회
    //    fallback: junction에 없으면 callsigns.file_upload_id로 조회 (마이그레이션 전 데이터 호환)
    const callsignsResult = await query(
      `SELECT DISTINCT id FROM (
        SELECT cu.callsign_id as id FROM callsign_uploads cu WHERE cu.file_upload_id = $1
        UNION
        SELECT c.id FROM callsigns c WHERE c.file_upload_id = $1
          AND NOT EXISTS (SELECT 1 FROM callsign_uploads cu2 WHERE cu2.callsign_id = c.id)
       ) combined`,
      [fileUploadId]
    );

    const callsignIds = callsignsResult.rows.map((row: any) => row.id);

    if (callsignIds.length > 0) {
      // 2. 고아 콜사인(이 업로드만 연결된 콜사인) 중 actions가 있는지 확인
      //    공유 콜사인은 삭제 대상이 아니므로 actions 체크에서 제외
      const placeholders = callsignIds.map((_: string, i: number) => `$${i + 1}`).join(',');
      const actionsCountResult = await query(
        `SELECT COUNT(*) as count FROM actions
         WHERE callsign_id IN (
           SELECT c.id FROM callsigns c
           WHERE c.id IN (${placeholders})
             AND NOT EXISTS (
               SELECT 1 FROM callsign_uploads cu
               WHERE cu.callsign_id = c.id
                 AND cu.file_upload_id != $${callsignIds.length + 1}
             )
         )`,
        [...callsignIds, fileUploadId]
      );

      const actionsCount = parseInt(actionsCountResult.rows[0].count, 10);

      if (actionsCount > 0) {
        return NextResponse.json(
          {
            error: '삭제 대상 호출부호에 항공사가 작성한 조치가 있어 삭제할 수 없습니다.',
            can_delete: false,
            actions_count: actionsCount,
          },
          { status: 409 }
        );
      }
    }

    // 3. 트랜잭션으로 삭제 진행
    await transaction(async (txQuery) => {
      // 3-1. 해당 업로드의 callsign_occurrences 삭제
      await txQuery(
        `DELETE FROM callsign_occurrences WHERE file_upload_id = $1`,
        [fileUploadId]
      );

      // 3-2. callsign_uploads 링크 삭제
      await txQuery(
        `DELETE FROM callsign_uploads WHERE file_upload_id = $1`,
        [fileUploadId]
      );

      if (callsignIds.length > 0) {
        const placeholders = callsignIds.map((_: string, i: number) => `$${i + 1}`).join(',');

        // 3-3. 고아 콜사인 삭제 (다른 업로드 링크가 없는 것만)
        await txQuery(
          `DELETE FROM callsigns
           WHERE id IN (${placeholders})
             AND NOT EXISTS (
               SELECT 1 FROM callsign_uploads cu WHERE cu.callsign_id = callsigns.id
             )`,
          callsignIds
        );

        // 3-4. 생존 콜사인의 file_upload_id를 남은 최신 업로드로 복원
        await txQuery(
          `UPDATE callsigns c
           SET file_upload_id = (
             SELECT cu.file_upload_id FROM callsign_uploads cu
             WHERE cu.callsign_id = c.id
             ORDER BY cu.created_at DESC LIMIT 1
           ),
           updated_at = CURRENT_TIMESTAMP
           WHERE c.id IN (${placeholders})
             AND EXISTS (SELECT 1 FROM callsign_uploads cu WHERE cu.callsign_id = c.id)`,
          callsignIds
        );

        // 3-5. 생존 콜사인의 occurrence_count 재계산 (0건 포함)
        await txQuery(
          `UPDATE callsigns c SET
            occurrence_count = COALESCE(sub.cnt, 0),
            first_occurred_at = sub.min_date,
            last_occurred_at = sub.max_date
          FROM (
            SELECT cs.id as callsign_id,
                   COUNT(co.id) as cnt,
                   MIN(co.occurred_date) as min_date,
                   MAX(co.occurred_date) as max_date
            FROM callsigns cs
            LEFT JOIN callsign_occurrences co ON co.callsign_id = cs.id
            WHERE cs.id IN (${placeholders})
            GROUP BY cs.id
          ) sub
          WHERE c.id = sub.callsign_id`,
          callsignIds
        );
      }

      // 3-6. file_uploads 레코드 삭제
      const deleteResult = await txQuery(
        `DELETE FROM file_uploads WHERE id = $1`,
        [fileUploadId]
      );

      if ((deleteResult.rowCount || 0) === 0) {
        throw new Error('업로드 이력을 찾을 수 없습니다.');
      }
    });

    return NextResponse.json({
      message: '업로드 이력이 삭제되었습니다.',
      id: fileUploadId,
    });
  } catch (error) {
    logger.error('업로드 이력 삭제 오류', error, 'admin/file-uploads');
    const errorMessage = error instanceof Error ? error.message : '업로드 이력 삭제 중 오류가 발생했습니다.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
