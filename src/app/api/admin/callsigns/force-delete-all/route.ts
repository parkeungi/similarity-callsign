// DELETE /api/admin/callsigns/force-delete-all - 모든 callsigns·callsign_occurrences·actions·file_uploads 강제 삭제, 관리자 전용
/**
 * DELETE /api/admin/callsigns/force-delete-all
 * 전체 데이터 강제삭제 (모든 호출부호 및 관련 데이터)
 *
 * 요청:
 * {
 *   adminPassword: string  // 관리자 비밀번호 (재검증용)
 * }
 *
 * 삭제 순서 (원자성 보장):
 * 1. action_history 전체 삭제
 * 2. actions 전체 삭제
 * 3. callsign_ai_analysis 전체 삭제
 * 4. callsign_occurrences 전체 삭제
 * 5. callsigns 전체 삭제
 * 6. file_uploads 전체 삭제
 * 7. 감사 로그 기록
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query, transaction } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  try {
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

    // 3. 삭제 전 통계 조회
    const statsResult = await query(`
      SELECT
        (SELECT COUNT(*) FROM callsigns) as callsigns_count,
        (SELECT COUNT(*) FROM callsign_occurrences) as occurrences_count,
        (SELECT COUNT(*) FROM actions) as actions_count,
        (SELECT COUNT(*) FROM file_uploads) as uploads_count,
        (SELECT COUNT(*) FROM callsign_ai_analysis) as ai_analysis_count
    `);
    const stats = statsResult.rows[0];

    // 4. 트랜잭션으로 원자적 삭제 수행
    let deletedStats = {
      actionHistory: 0,
      actions: 0,
      aiAnalysis: 0,
      occurrences: 0,
      callsigns: 0,
      fileUploads: 0,
    };

    try {
      await transaction(async (txQuery) => {
        // Step 1: action_history 전체 삭제
        const historyDeleteResult = await txQuery(`DELETE FROM action_history`);
        deletedStats.actionHistory = historyDeleteResult.rowCount || 0;

        // Step 2: actions 전체 삭제
        const actionsDeleteResult = await txQuery(`DELETE FROM actions`);
        deletedStats.actions = actionsDeleteResult.rowCount || 0;

        // Step 3: callsign_ai_analysis 전체 삭제
        const aiAnalysisDeleteResult = await txQuery(`DELETE FROM callsign_ai_analysis`);
        deletedStats.aiAnalysis = aiAnalysisDeleteResult.rowCount || 0;

        // Step 4: callsign_occurrences 전체 삭제
        const occurrencesDeleteResult = await txQuery(`DELETE FROM callsign_occurrences`);
        deletedStats.occurrences = occurrencesDeleteResult.rowCount || 0;

        // Step 4.5: callsign_uploads 전체 삭제
        await txQuery(`DELETE FROM callsign_uploads`);

        // Step 5: callsigns 전체 삭제
        const callsignsDeleteResult = await txQuery(`DELETE FROM callsigns`);
        deletedStats.callsigns = callsignsDeleteResult.rowCount || 0;

        // Step 6: file_uploads 전체 삭제
        const uploadsDeleteResult = await txQuery(`DELETE FROM file_uploads`);
        deletedStats.fileUploads = uploadsDeleteResult.rowCount || 0;
      });

      // 5. 감사 로그 기록 (트랜잭션 외부)
      await query(
        `INSERT INTO audit_logs (user_id, action, table_name, old_data, new_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          payload.userId,
          'force_delete_all_callsigns',
          'callsigns',
          JSON.stringify({
            before_delete: stats,
          }),
          JSON.stringify({
            deleted_stats: deletedStats,
          }),
        ]
      );

      return NextResponse.json({
        message: '모든 데이터가 삭제되었습니다.',
        deletedStats,
      });
    } catch (txError) {
      logger.error('전체 데이터 강제 삭제 트랜잭션 실패', txError, 'admin/callsigns/force-delete-all');
      return NextResponse.json(
        { error: '데이터 삭제 중 오류가 발생했습니다.' },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('전체 데이터 강제 삭제 오류', error, 'admin/callsigns/force-delete-all');
    return NextResponse.json(
      { error: '데이터 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
