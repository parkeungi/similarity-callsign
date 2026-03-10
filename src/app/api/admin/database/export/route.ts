import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import * as XLSX from 'xlsx';

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
]);

// 마스킹할 컬럼
const MASKED_COLUMNS = new Set(['password', 'password_hash', 'hashed_password', 'refresh_token']);

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.substring(7);
  const payload = verifyToken(token || '');
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  let tables: string[];
  try {
    const body = await request.json();
    tables = body.tables;
  } catch {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  if (!Array.isArray(tables) || tables.length === 0) {
    return NextResponse.json({ error: '테이블을 선택해주세요.' }, { status: 400 });
  }

  // 화이트리스트 검증
  const invalidTables = tables.filter((t) => !ALLOWED_TABLES.has(t));
  if (invalidTables.length > 0) {
    return NextResponse.json(
      { error: `허용되지 않은 테이블: ${invalidTables.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const workbook = XLSX.utils.book_new();

    for (const tableName of tables) {
      const result = await query(`SELECT * FROM "${tableName}" ORDER BY 1`);

      const rows = result.rows.map((row: Record<string, unknown>) => {
        const masked = { ...row };
        for (const col of Object.keys(masked)) {
          if (MASKED_COLUMNS.has(col)) {
            masked[col] = '***';
          }
        }
        return masked;
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // 시트 이름은 최대 31자 제한
      const sheetName = tableName.substring(0, 31);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `katc1_db_backup_${dateStr}.xlsx`;

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('[DB Export] Error:', error);
    return NextResponse.json({ error: '엑셀 내보내기 실패' }, { status: 500 });
  }
}
