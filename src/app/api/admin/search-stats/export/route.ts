// GET /api/admin/search-stats/export - 사전조회 이력 엑셀 다운로드 (항공사별 정렬, 국내 항공사만)
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: '관리자만 접근할 수 있습니다.' }, { status: 403 });
    }

    const dateFrom = request.nextUrl.searchParams.get('dateFrom');
    const dateTo = request.nextUrl.searchParams.get('dateTo');

    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (dateFrom && !datePattern.test(dateFrom)) {
      return NextResponse.json({ error: '유효하지 않은 날짜 형식입니다 (YYYY-MM-DD).' }, { status: 400 });
    }
    if (dateTo && !datePattern.test(dateTo)) {
      return NextResponse.json({ error: '유효하지 않은 날짜 형식입니다 (YYYY-MM-DD).' }, { status: 400 });
    }

    const params: string[] = [];
    let paramIndex = 1;
    let conditions = '';

    if (dateFrom) {
      conditions += ` AND sl.searched_at >= $${paramIndex++}::date`;
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions += ` AND sl.searched_at < ($${paramIndex++}::date + INTERVAL '1 day')`;
      params.push(dateTo);
    }

    // matched_airline_codes를 UNNEST하여 국내 항공사(airlines 테이블 등록)만 추출
    // airlines.display_order ASC → 항공사 순서, searched_at DESC → 최신순
    const result = await query(
      `SELECT
        a.code                                                              AS "항공사 코드",
        a.name_ko                                                           AS "항공사명",
        TO_CHAR(sl.searched_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI:SS') AS "조회 일시",
        sl.searched_callsign                                                AS "검색 호출부호",
        COALESCE(sl.matched_risk_levels, '-')                              AS "위험도",
        sl.result_count                                                     AS "검색 결과 수",
        CASE WHEN sl.result_count = 0 THEN 'O' ELSE 'X' END               AS "결과없음 여부"
      FROM search_logs sl
      CROSS JOIN LATERAL (
        SELECT TRIM(value) AS code
        FROM UNNEST(string_to_array(sl.matched_airline_codes, ',')) AS t(value)
      ) pos
      JOIN airlines a ON a.code = pos.code
      WHERE sl.matched_airline_codes IS NOT NULL ${conditions}
      ORDER BY a.display_order ASC, sl.searched_at DESC`,
      params
    );

    const rows = result.rows;

    // No. 순번 추가
    const dataWithIndex = rows.map((row: Record<string, unknown>, i: number) => ({
      'No.': i + 1,
      ...row,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(dataWithIndex);

    // 컬럼 너비 설정
    worksheet['!cols'] = [
      { wch: 5 },   // No.
      { wch: 10 },  // 항공사 코드
      { wch: 14 },  // 항공사명
      { wch: 20 },  // 조회 일시
      { wch: 14 },  // 검색 호출부호
      { wch: 18 },  // 위험도
      { wch: 12 },  // 검색 결과 수
      { wch: 12 },  // 결과없음 여부
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, '항공사별 조회 이력');

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `사전조회_이력_${dateStr}.xlsx`;

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    logger.info('사전조회 이력 엑셀 다운로드', 'admin/search-stats/export', {
      adminId: payload.userId,
      dateFrom,
      dateTo,
      rowCount: rows.length,
    });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) {
    logger.error('사전조회 이력 엑셀 내보내기 실패', error, 'admin/search-stats/export');
    return NextResponse.json({ error: '엑셀 내보내기 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
