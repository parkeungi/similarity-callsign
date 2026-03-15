// GET /api/admin/database/tables - PostgreSQL 전체 테이블 목록+행수 조회, information_schema 사용, 관리자 전용
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import { logger } from '@/lib/logger';

// 허용된 테이블 목록 (화이트리스트)
const ALLOWED_TABLES = [
  'users',
  'airlines',
  'callsigns',
  'callsign_occurrences',
  'actions',
  'action_history',
  'action_types',
  'announcements',
  'announcement_views',
  'file_uploads',
  'callsign_ai_analysis',
  'password_history',
  'audit_logs',
];

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.substring(7);
  const payload = verifyToken(token || '');
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    // information_schema에서 테이블 목록 조회
    const tablesResult = await query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
       ORDER BY table_name`
    );

    // 허용된 테이블만 필터링하고 row count 조회
    const allowedTables = tablesResult.rows
      .map((r: { table_name: string }) => r.table_name)
      .filter((name: string) => ALLOWED_TABLES.includes(name));

    const tableInfos = await Promise.all(
      allowedTables.map(async (tableName: string) => {
        try {
          const countResult = await query(
            `SELECT COUNT(*) as count FROM "${tableName}"`
          );
          return {
            name: tableName,
            rowCount: parseInt(countResult.rows[0]?.count || '0', 10),
          };
        } catch {
          return { name: tableName, rowCount: 0 };
        }
      })
    );

    return NextResponse.json({ data: tableInfos });
  } catch (error) {
    logger.error('테이블 목록 조회 실패', error, 'admin/database/tables');
    return NextResponse.json({ error: '테이블 목록 조회 실패' }, { status: 500 });
  }
}
