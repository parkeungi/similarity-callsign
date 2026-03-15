// GET /api/admin/stats - 전반적인 통계(항공사별·위험도별·상태별 건수), callsigns·actions 집계
/**
 * GET /api/admin/stats
 * 관리자 대시보드용 통계 데이터
 *
 * 응답:
 * {
 *   users: { total, active, suspended },
 *   recentLogins: [{ id, email, lastLoginAt }],
 *   systemStatus: { db: 'ok' | 'error', api: 'ok' }
 * }
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

    // 사용자 통계
    const statsResult = await query(`
      SELECT
        SUM(CASE WHEN 1=1 THEN 1 ELSE 0 END)                 AS total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)   AS active,
        SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended
      FROM users
    `);

    const stats = statsResult.rows[0];

    // 최근 로그인 5명 (last_login_at이 있는 사용자)
    const recentLoginsResult = await query(`
      SELECT id, email, last_login_at, status, role
      FROM users
      WHERE last_login_at IS NOT NULL
      ORDER BY last_login_at DESC
      LIMIT 5
    `);

    // DB 상태 확인
    let dbStatus: 'ok' | 'error' = 'ok';
    try {
      await query('SELECT 1');
    } catch {
      dbStatus = 'error';
    }

    return NextResponse.json({
      users: {
        total: parseInt(stats.total, 10),
        active: parseInt(stats.active, 10),
        suspended: parseInt(stats.suspended, 10),
      },
      recentLogins: recentLoginsResult.rows.map((row: any) => ({
        id: row.id,
        email: row.email,
        status: row.status,
        role: row.role,
        lastLoginAt: row.last_login_at,
      })),
      systemStatus: {
        db: dbStatus,
        api: 'ok',
      },
    });
  } catch (error) {
    logger.error('통계 조회 오류', error, 'admin/stats');
    return NextResponse.json(
      { error: '통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
