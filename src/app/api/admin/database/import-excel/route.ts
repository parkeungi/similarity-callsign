// POST /api/admin/database/import-excel - 엑셀(XLSX) 파일을 파싱하여 시트별 테이블에 데이터 삽입, 관리자 전용
// FK 의존성 순서로 임포트, ALTER TABLE DISABLE TRIGGER로 FK 우회, 시퀀스 리셋
import { NextRequest, NextResponse } from 'next/server';
import { transaction } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import * as XLSX from 'xlsx';
import { logger } from '@/lib/logger';
import { ALLOWED_ADMIN_TABLES, MASKED_COLUMNS, IMPORT_ORDER } from '@/lib/db/admin-tables';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.substring(7);
  const payload = verifyToken(token || '');
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '파일이 필요합니다.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: '파일 크기가 10MB를 초과합니다.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    // 시트명 → 데이터 매핑
    const sheetDataMap = new Map<string, Record<string, unknown>[]>();
    const invalidTables: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const tableName = sheetName.trim();
      if (!ALLOWED_ADMIN_TABLES.has(tableName)) {
        invalidTables.push(tableName);
        continue;
      }
      const sheet = workbook.Sheets[sheetName];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
      if (rows.length > 0) {
        sheetDataMap.set(tableName, rows);
      }
    }

    // FK 의존성 순서로 정렬
    const orderedTables = IMPORT_ORDER.filter((t) => sheetDataMap.has(t));
    for (const t of sheetDataMap.keys()) {
      if (!orderedTables.includes(t)) orderedTables.push(t);
    }

    const results: { table: string; inserted: number; skipped: number; error?: string; errors?: string[] }[] = [];

    for (const t of invalidTables) {
      results.push({ table: t, inserted: 0, skipped: 0, error: '허용되지 않은 테이블' });
    }

    if (orderedTables.length === 0) {
      return NextResponse.json({
        success: true,
        fileName: file.name,
        results,
      });
    }

    // 트랜잭션 내에서 FK 트리거 비활성화 후 임포트
    await transaction(async (trx) => {
      // 임포트할 테이블의 FK 트리거만 비활성화 (Supabase 호환)
      for (const tableName of orderedTables) {
        await trx(`ALTER TABLE "${tableName}" DISABLE TRIGGER ALL`);
      }

      try {
        for (const tableName of orderedTables) {
          const rows = sheetDataMap.get(tableName)!;
          let inserted = 0;
          let skipped = 0;
          const rowErrors: string[] = [];

          try {
            // 실제 테이블 스키마에서 컬럼 목록 조회 (SQL Injection 방지)
            const schemaResult = await trx(
              `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
              [tableName]
            );
            const validColumns = new Set<string>(schemaResult.rows.map((r: { column_name: string }) => r.column_name));

            for (const row of rows) {
              try {
                // 스키마에 존재하는 컬럼만 필터, 마스킹 값 제외
                const filteredEntries = Object.entries(row).filter(([col, val]) => {
                  if (!validColumns.has(col)) return false;
                  if (MASKED_COLUMNS.has(col) && val === '***') return false;
                  return true;
                });

                if (filteredEntries.length === 0) {
                  skipped++;
                  continue;
                }

                const columns = filteredEntries.map(([col]) => `"${col}"`);
                const placeholders = filteredEntries.map((_, i) => `$${i + 1}`);
                const values = filteredEntries.map(([, val]) => {
                  if (val === '' || val === 'NULL') return null;
                  if (val === 'true' || val === 'TRUE') return true;
                  if (val === 'false' || val === 'FALSE') return false;
                  return val;
                });

                const result = await trx(
                  `INSERT INTO "${tableName}" (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT DO NOTHING RETURNING 1`,
                  values
                );

                if (result.rows.length > 0) {
                  inserted++;
                } else {
                  skipped++;
                }
              } catch (err) {
                skipped++;
                if (rowErrors.length < 3) {
                  rowErrors.push(err instanceof Error ? err.message : 'unknown');
                }
              }
            }

            // SERIAL 시퀀스 리셋 (해당 테이블에 시퀀스가 있는 경우)
            try {
              const seqResult = await trx(
                `SELECT pg_get_serial_sequence($1, 'id') as seq`,
                [`${tableName}`]
              );
              if (seqResult.rows[0]?.seq) {
                await trx(
                  `SELECT setval($1, GREATEST(COALESCE((SELECT MAX(id) FROM "${tableName}"), 0), 1))`,
                  [seqResult.rows[0].seq]
                );
              }
            } catch {
              // 시퀀스가 없는 테이블 (UUID PK 등) → 무시
            }
          } catch (err) {
            results.push({
              table: tableName,
              inserted,
              skipped,
              error: err instanceof Error ? err.message : '알 수 없는 오류',
            });
            continue;
          }

          results.push({
            table: tableName,
            inserted,
            skipped,
            errors: rowErrors.length > 0 ? rowErrors : undefined,
          });
        }
      } finally {
        // FK 트리거 재활성화 (에러 시에도 반드시 실행)
        for (const tableName of orderedTables) {
          try {
            await trx(`ALTER TABLE "${tableName}" ENABLE TRIGGER ALL`);
          } catch {
            // 개별 테이블 트리거 복원 실패 시 다음 테이블 계속 처리
          }
        }
      }
    });

    logger.info('관리자 작업: 엑셀 데이터 임포트', 'admin/database/import-excel', {
      adminId: payload.userId,
      fileName: file.name,
      results,
    });

    return NextResponse.json({
      success: true,
      fileName: file.name,
      results,
    });
  } catch (error) {
    logger.error('엑셀 임포트 실패', error, 'admin/database/import-excel');
    const msg = error instanceof Error ? error.message : '엑셀 임포트에 실패했습니다.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
