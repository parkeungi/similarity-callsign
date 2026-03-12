/**
 * DELETE /api/admin/file-uploads/[id]/force-delete
 * 파일 강제삭제 (조치 여부 상관없이 삭제 + 관리자 비밀번호 재검증)
 *
 * 요청:
 * {
 *   adminPassword: string  // 관리자 비밀번호 (재검증용)
 * }
 *
 * 삭제 순서 (원자성 보장):
 * 1. action_history 삭제 (action_id FK)
 * 2. actions 삭제 (callsign_id FK)
 * 3. callsign_occurrences 삭제 (callsign_id FK)
 * 4. callsigns 삭제 (file_upload_id 필터)
 * 5. file_uploads 삭제
 * 6. 감사 로그 기록
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query, transaction } from '@/lib/db';
import bcrypt from 'bcryptjs';

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
        { status: 400 }  // 401 대신 400 사용 (인증 실패가 아닌 잘못된 요청)
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

    // 4. 해당 파일의 모든 callsigns 찾기
    const callsignsResult = await query(
      `SELECT id FROM callsigns WHERE file_upload_id = $1`,
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
        // Step 1: action_history 삭제 (action_id FK)
        if (callsignIds.length > 0) {
          const placeholders = callsignIds.map((_: string, i: number) => `$${i + 1}`).join(',');
          const historyDeleteResult = await txQuery(
            `DELETE FROM action_history WHERE action_id IN (
              SELECT id FROM actions WHERE callsign_id IN (${placeholders})
            )`,
            callsignIds
          );
          deletedStats.actionHistory = historyDeleteResult.changes || 0;
        }

        // Step 2: actions 삭제 (callsign_id FK)
        if (callsignIds.length > 0) {
          const placeholders = callsignIds.map((_: string, i: number) => `$${i + 1}`).join(',');
          const actionsDeleteResult = await txQuery(
            `DELETE FROM actions WHERE callsign_id IN (${placeholders})`,
            callsignIds
          );
          deletedStats.actions = actionsDeleteResult.changes || 0;
        }

        // Step 3: callsign_occurrences 삭제 (callsign_id FK)
        if (callsignIds.length > 0) {
          const placeholders = callsignIds.map((_: string, i: number) => `$${i + 1}`).join(',');
          const occurrencesDeleteResult = await txQuery(
            `DELETE FROM callsign_occurrences WHERE callsign_id IN (${placeholders})`,
            callsignIds
          );
          deletedStats.occurrences = occurrencesDeleteResult.changes || 0;
        }

        // Step 4: callsigns 삭제
        const callsignsDeleteResult = await txQuery(
          `DELETE FROM callsigns WHERE file_upload_id = $1`,
          [fileUploadId]
        );
        deletedStats.callsigns = callsignsDeleteResult.changes || 0;

        // Step 5: file_uploads 삭제
        const fileDeleteResult = await txQuery(
          `DELETE FROM file_uploads WHERE id = $1`,
          [fileUploadId]
        );
        deletedStats.file = fileDeleteResult.changes || 0;

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
      console.error('[Force Delete] 트랜잭션 실패:', txError);
      const errorMessage = txError instanceof Error ? txError.message : '파일 삭제 중 오류가 발생했습니다.';
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Force Delete] 오류:', error);
    return NextResponse.json(
      { error: '파일 강제 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
