// DELETE /api/admin/file-uploads/[id]/force-delete - 업로드 파일+연관 데이터 강제 삭제, 트랜잭션 처리, 관리자 전용
/**
 * DELETE /api/admin/file-uploads/[id]/force-delete
 * 파일 강제삭제 (조치 여부 상관없이 삭제 + 관리자 비밀번호 재검증)
 *
 * 삭제 로직 (callsign_uploads junction 기반):
 * 1. callsign_uploads에서 해당 업로드의 콜사인 조회
 * 2. 고아 콜사인 식별 (이 업로드만 연결된 콜사인)
 * 3. 고아 콜사인: action_history → actions → occurrences → callsigns 삭제
 * 4. 생존 콜사인: file_upload_id 복원, occurrence_count 재계산
 * 5. callsign_uploads 링크 삭제, file_uploads 삭제
 * 6. 감사 로그 기록
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query, transaction } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fileUploadId } = await params;
    const body = await request.json();
    const { adminPassword } = body;

    // 1. 인증 확인 (관리자만)
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

    // 2. 비밀번호 재검증
    if (!adminPassword || adminPassword.trim().length === 0) {
      return NextResponse.json(
        { error: '관리자 비밀번호가 필요합니다.' },
        { status: 400 }
      );
    }

    // 관리자 사용자 정보 조회
    const adminResult = await query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [payload.userId]
    );

    if (adminResult.rows.length === 0) {
      return NextResponse.json(
        { error: '관리자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const adminUser = adminResult.rows[0];
    const isPasswordValid = await bcrypt.compare(adminPassword, adminUser.password_hash);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '비밀번호가 맞지 않습니다.' },
        { status: 400 }
      );
    }

    // 3. 파일 존재 확인
    const fileResult = await query(
      `SELECT id, file_name, total_rows FROM file_uploads WHERE id = $1`,
      [fileUploadId]
    );

    if (fileResult.rows.length === 0) {
      return NextResponse.json(
        { error: '업로드 이력을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const file = fileResult.rows[0] as { id: string; file_name: string; total_rows: number };

    // 4. 해당 업로드와 연결된 콜사인 조회 (junction 테이블 기반)
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

    const callsignIds = (callsignsResult.rows as { id: string }[]).map((row) => row.id);

    // 5. 트랜잭션으로 원자적 삭제 수행
    let deletedStats = {
      actionHistory: 0,
      actions: 0,
      occurrences: 0,
      callsigns: 0,
      file: 0,
    };

    try {
      await transaction(async (txQuery) => {
        if (callsignIds.length > 0) {
          const placeholders = callsignIds.map((_: string, i: number) => `$${i + 1}`).join(',');

          // Step 1: 고아 콜사인 식별 (이 업로드만 연결된 콜사인)
          const orphanedResult = await txQuery(
            `SELECT c.id FROM callsigns c
             WHERE c.id IN (${placeholders})
               AND NOT EXISTS (
                 SELECT 1 FROM callsign_uploads cu
                 WHERE cu.callsign_id = c.id
                   AND cu.file_upload_id != $${callsignIds.length + 1}
               )`,
            [...callsignIds, fileUploadId]
          );
          const orphanedIds = (orphanedResult.rows as { id: string }[]).map(r => r.id);

          // Step 2: 고아 콜사인의 action_history 삭제
          if (orphanedIds.length > 0) {
            const orphanPlaceholders = orphanedIds.map((_: string, i: number) => `$${i + 1}`).join(',');
            const historyDeleteResult = await txQuery(
              `DELETE FROM action_history WHERE action_id IN (
                SELECT id FROM actions WHERE callsign_id IN (${orphanPlaceholders})
              )`,
              orphanedIds
            );
            deletedStats.actionHistory = historyDeleteResult.rowCount || 0;

            // Step 3: 고아 콜사인의 actions 삭제
            const actionsDeleteResult = await txQuery(
              `DELETE FROM actions WHERE callsign_id IN (${orphanPlaceholders})`,
              orphanedIds
            );
            deletedStats.actions = actionsDeleteResult.rowCount || 0;
          }

          // Step 4: 해당 업로드의 callsign_occurrences 삭제
          const occurrencesDeleteResult = await txQuery(
            `DELETE FROM callsign_occurrences WHERE file_upload_id = $1`,
            [fileUploadId]
          );
          deletedStats.occurrences = occurrencesDeleteResult.rowCount || 0;

          // Step 5: callsign_uploads 링크 삭제
          await txQuery(
            `DELETE FROM callsign_uploads WHERE file_upload_id = $1`,
            [fileUploadId]
          );

          // Step 6: 고아 콜사인 삭제
          if (orphanedIds.length > 0) {
            const orphanPlaceholders = orphanedIds.map((_: string, i: number) => `$${i + 1}`).join(',');
            const callsignsDeleteResult = await txQuery(
              `DELETE FROM callsigns WHERE id IN (${orphanPlaceholders})`,
              orphanedIds
            );
            deletedStats.callsigns = callsignsDeleteResult.rowCount || 0;
          }

          // Step 7: 생존 콜사인의 file_upload_id 복원 + occurrence_count 재계산
          const survivorIds = callsignIds.filter(id => !orphanedIds.includes(id));
          if (survivorIds.length > 0) {
            const survivorPlaceholders = survivorIds.map((_: string, i: number) => `$${i + 1}`).join(',');

            await txQuery(
              `UPDATE callsigns c
               SET file_upload_id = (
                 SELECT cu.file_upload_id FROM callsign_uploads cu
                 WHERE cu.callsign_id = c.id
                 ORDER BY cu.created_at DESC LIMIT 1
               ),
               updated_at = CURRENT_TIMESTAMP
               WHERE c.id IN (${survivorPlaceholders})`,
              survivorIds
            );

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
                WHERE cs.id IN (${survivorPlaceholders})
                GROUP BY cs.id
              ) sub
              WHERE c.id = sub.callsign_id`,
              survivorIds
            );
          }
        }

        // Step 8: file_uploads 삭제
        const fileDeleteResult = await txQuery(
          `DELETE FROM file_uploads WHERE id = $1`,
          [fileUploadId]
        );
        deletedStats.file = fileDeleteResult.rowCount || 0;

        if (deletedStats.file === 0) {
          throw new Error('파일 삭제에 실패했습니다.');
        }
      });

      // 6. 감사 로그 기록 (트랜잭션 외부 - 삭제 성공 보장 후)
      await query(
        `INSERT INTO audit_logs (user_id, action, table_name, old_data, new_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          payload.userId,
          'force_delete_file_upload',
          'file_uploads',
          JSON.stringify({
            id: fileUploadId,
            file_name: file.file_name,
            total_rows: file.total_rows,
          }),
          JSON.stringify({
            deleted_stats: deletedStats,
          }),
        ]
      );

      return NextResponse.json({
        message: '파일이 강제 삭제되었습니다.',
        id: fileUploadId,
        deletedFile: file.file_name,
        ...deletedStats,
      });
    } catch (txError) {
      logger.error('강제 삭제 트랜잭션 실패', txError, 'admin/file-uploads/force-delete');
      const errorMessage = txError instanceof Error ? txError.message : '파일 삭제 중 오류가 발생했습니다.';
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('파일 강제 삭제 오류', error, 'admin/file-uploads/force-delete');
    return NextResponse.json(
      { error: '파일 강제 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
