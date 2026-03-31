// GET /api/admin/file-uploads/[id]/download - 업로드 이력의 callsigns 데이터를 업로드 형식 엑셀로 다운로드
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import * as XLSX from 'xlsx';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fileUploadId } = await params;

    // 인증 확인
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    // 파일 업로드 정보 조회
    const fileResult = await query(
      `SELECT id, file_name FROM file_uploads WHERE id = $1`,
      [fileUploadId]
    );

    if (fileResult.rows.length === 0) {
      return NextResponse.json({ error: '업로드 이력을 찾을 수 없습니다.' }, { status: 404 });
    }

    const fileName = fileResult.rows[0].file_name;

    // 해당 file_upload_id의 callsigns + callsign_occurrences 데이터 조회
    // sector, airport, same_*, traffic 등은 callsigns 테이블에 있음
    // occurred_date/time, error_type, sub_error는 callsign_occurrences에 있음
    const callsignsResult = await query(
      `SELECT
        c.my_callsign,
        c.other_callsign,
        c.callsign_pair,
        c.airline_code,
        c.other_airline_code,
        c.risk_level,
        c.similarity,
        c.error_type,
        c.sub_error,
        c.occurrence_count,
        c.sector,
        c.departure_airport1,
        c.arrival_airport1,
        c.departure_airport2,
        c.arrival_airport2,
        c.same_airline_code,
        c.same_callsign_length,
        c.same_number_position,
        c.same_number_count,
        c.same_number_ratio,
        c.max_concurrent_traffic,
        c.coexistence_minutes,
        c.error_probability,
        c.atc_recommendation,
        TO_CHAR(co.occurred_date, 'YYYY-MM-DD') AS occurred_date_str,
        TO_CHAR(co.occurred_time, 'HH24:MI') AS occurred_time_str,
        co.coexistence_minutes as occ_coexistence_minutes,
        co.error_type as occ_error_type,
        co.sub_error as occ_sub_error
      FROM callsigns c
      LEFT JOIN callsign_uploads cu ON cu.callsign_id = c.id AND cu.file_upload_id = $1
      LEFT JOIN callsign_occurrences co ON co.callsign_id = c.id AND co.file_upload_id = $1
      WHERE cu.id IS NOT NULL OR (c.file_upload_id = $1 AND NOT EXISTS (SELECT 1 FROM callsign_uploads cu2 WHERE cu2.callsign_id = c.id))
      ORDER BY c.callsign_pair, co.occurred_date, co.occurred_time`,
      [fileUploadId]
    );

    // 업로드 엑셀 형식으로 변환
    // 컬럼 순서: 시작일시, 종료일시, 관할섹터명, 편명1, 출발공항1, 도착공항1,
    //           편명2, 출발공항2, 도착공항2, 편명1|편명2, 항공사구분, 항공사국문,
    //           항공사코드동일여부, 편명번호길이동일여부, 편명번호동일숫자위치,
    //           편명번호동일숫자갯수, 편명번호동일숫자구성비율(%),
    //           편명유사도, 최대동시관제량, 공존시간(분),
    //           오류발생가능성_점수, 오류발생가능성_등급,
    //           보고여부, 관제사권고사항, 보고일시, 보고자, 혼돈편명,
    //           오류유형, 세부오류유형, 비고
    const excelRows = callsignsResult.rows.map((row: any) => {
      // SQL TO_CHAR로 포맷된 문자열 사용 → pg 타입 변환 문제 없음
      const occurredDate = row.occurred_date_str || '';
      const occurredTime = row.occurred_time_str || '';

      // 종료일시: 발생 건별 coexistence_minutes(우선) → callsigns coexistence_minutes(fallback) 으로 계산
      const coexMins = row.occ_coexistence_minutes ?? row.coexistence_minutes ?? null;
      let endDatetime = '';
      if (occurredDate && occurredTime && coexMins !== null) {
        const startMs = new Date(`${occurredDate}T${occurredTime}:00`).getTime();
        if (!isNaN(startMs)) {
          const endDate = new Date(startMs + coexMins * 60 * 1000);
          const pad = (n: number) => String(n).padStart(2, '0');
          endDatetime = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())} ${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
        }
      }

      return {
        '시작일시': occurredDate && occurredTime ? `${occurredDate} ${occurredTime}` : occurredDate,
        '종료일시': endDatetime,
        '관할섹터명': row.sector || '',
        '편명1': row.my_callsign || '',
        '출발공항1': row.departure_airport1 || '',
        '도착공항1': row.arrival_airport1 || '',
        '편명2': row.other_callsign || '',
        '출발공항2': row.departure_airport2 || '',
        '도착공항2': row.arrival_airport2 || '',
        '편명1|편명2': row.callsign_pair || '',
        '항공사구분': row.airline_code && row.other_airline_code
          ? `${row.airline_code} | ${row.other_airline_code}`
          : row.airline_code || '',
        '항공사국문': '',
        '항공사코드동일여부': row.same_airline_code || '',
        '편명번호길이동일여부': row.same_callsign_length || '',
        '편명번호동일숫자위치': row.same_number_position || '',
        '편명번호동일숫자갯수': row.same_number_count ?? '',
        '편명번호동일숫자구성비율(%)': row.same_number_ratio ?? '',
        '편명유사도': row.similarity || '',
        '최대동시관제량': row.max_concurrent_traffic ?? '',
        '공존시간(분)': row.coexistence_minutes ?? '',
        '오류발생가능성_점수': row.error_probability ?? '',
        '오류발생가능성_등급': row.risk_level || '',
        '보고여부': '',
        '관제사권고사항': row.atc_recommendation || '',
        '보고일시': '',
        '보고자': '',
        '혼돈편명': '',
        '오류유형': row.occ_error_type || row.error_type || '',
        '세부오류유형': row.occ_sub_error || row.sub_error || '',
        '비고': '',
      };
    });

    // XLSX 생성
    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '유사호출부호');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const downloadFileName = fileName.replace(/\.[^.]+$/, '') + '_다운로드.xlsx';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadFileName)}"`,
      },
    });
  } catch (error) {
    logger.error('파일 다운로드 오류', error, 'admin/file-uploads/download');
    return NextResponse.json(
      { error: '파일 다운로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
