// GET /api/admin/database/[table] - 특정 테이블 데이터 조회 (페이지네이션), 관리자 전용
// DELETE /api/admin/database/[table] - 특정 테이블 데이터 전체 삭제 (TRUNCATE), 관리자 전용
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import { logger } from '@/lib/logger';
import { ALLOWED_ADMIN_TABLES, MASKED_COLUMNS } from '@/lib/db/admin-tables';

export async function GET(
  request: NextRequest,
  { params }: { params: { table: string } }
) {
  const token = request.headers.get('Authorization')?.substring(7);
  const payload = verifyToken(token || '');
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const tableName = params.table;
  if (!ALLOWED_ADMIN_TABLES.has(tableName)) {
    return NextResponse.json({ error: '허용되지 않은 테이블입니다.' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '50', 10)));
  const offset = (page - 1) * limit;

  try {
    // 전체 행 수
    const countResult = await query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    // 데이터 조회
    const dataResult = await query(
      `SELECT * FROM "${tableName}" ORDER BY 1 LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // 민감 컬럼 마스킹
    const maskedRows = dataResult.rows.map((row: Record<string, unknown>) => {
      const masked = { ...row };
      for (const col of Object.keys(masked)) {
        if (MASKED_COLUMNS.has(col)) {
          masked[col] = '***';
        }
      }
      return masked;
    });

    // 컬럼 목록
    const columns = dataResult.rows.length > 0 ? Object.keys(dataResult.rows[0]) : [];

    return NextResponse.json({
      data: maskedRows,
      columns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('테이블 데이터 조회 실패', error, 'admin/database/table', { tableName });
    return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { table: string } }
) {
  const token = request.headers.get('Authorization')?.substring(7);
  const payload = verifyToken(token || '');
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const tableName = params.table;
  if (!ALLOWED_ADMIN_TABLES.has(tableName)) {
    return NextResponse.json({ error: '허용되지 않은 테이블입니다.' }, { status: 400 });
  }

  try {
    // 삭제 전: 대상 테이블 + CASCADE로 영향받는 테이블 행 수 확인
    const countResult = await query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    const deletedCount = parseInt(countResult.rows[0]?.count || '0', 10);

    if (deletedCount === 0) {
      return NextResponse.json({ success: true, deletedCount: 0, cascadeInfo: [], message: '삭제할 데이터가 없습니다.' });
    }

    // CASCADE 영향 범위 조회 (FK로 참조하는 테이블의 행 수)
    const cascadeResult = await query(
      `SELECT
        tc.table_name as child_table,
        (SELECT COUNT(*) FROM information_schema.tables t2 WHERE t2.table_name = tc.table_name AND t2.table_schema = 'public') as exists_check
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.constraint_column_usage AS ccu
         ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND ccu.table_name = $1
         AND tc.table_name != $1
       GROUP BY tc.table_name`,
      [tableName]
    );

    const cascadeInfo: { table: string; rowCount: number }[] = [];
    for (const row of cascadeResult.rows) {
      try {
        const childCount = await query(`SELECT COUNT(*) as count FROM "${row.child_table}"`);
        const cnt = parseInt(childCount.rows[0]?.count || '0', 10);
        if (cnt > 0) {
          cascadeInfo.push({ table: row.child_table, rowCount: cnt });
        }
      } catch {
        // 무시
      }
    }

    // TRUNCATE RESTART IDENTITY CASCADE (시퀀스도 함께 리셋)
    await query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`);

    logger.info('관리자 작업: 테이블 데이터 삭제', 'admin/database/delete', {
      adminId: payload.userId,
      tableName,
      deletedCount,
      cascadeInfo,
    });

    const cascadeMsg = cascadeInfo.length > 0
      ? `\n연쇄 삭제: ${cascadeInfo.map(c => `${c.table}(${c.rowCount}건)`).join(', ')}`
      : '';

    return NextResponse.json({
      success: true,
      deletedCount,
      cascadeInfo,
      message: `${tableName} 테이블의 ${deletedCount}건이 삭제되었습니다.${cascadeMsg}`,
    });
  } catch (error) {
    logger.error('테이블 데이터 삭제 실패', error, 'admin/database/delete', { tableName });
    return NextResponse.json({ error: '데이터 삭제 실패' }, { status: 500 });
  }
}
