// GET /api/admin/database/[table] - 특정 테이블 데이터 조회, 동적 테이블명(화이트리스트 검증), 페이지네이션, 관리자 전용
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

// 허용된 테이블 목록 (화이트리스트 - SQL Injection 방지)
const ALLOWED_TABLES = new Set([
  'users',
  'airlines',
  'callsigns',
  'actions',
  'announcements',
  'file_uploads',
  'action_types',
  'occurrences',
  'callsign_ai_analysis',
]);

// 마스킹할 컬럼 (비밀번호 등 민감 정보)
const MASKED_COLUMNS = new Set(['password', 'password_hash', 'hashed_password', 'refresh_token']);

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
  if (!ALLOWED_TABLES.has(tableName)) {
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
    console.error(`[DB Table] Error fetching ${tableName}:`, error);
    return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 });
  }
}
