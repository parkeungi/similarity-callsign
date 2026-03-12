/**
 * POST /api/admin/upload-callsigns
 * Excel 파일로 유사호출부호 데이터 일괄 업로드
 * 
 * 요청:
 *   - Content-Type: multipart/form-data
 *   - file: Excel 파일 (.xlsx)
 * 
 * 응답:
 *   - 성공: { success: true, total: N, inserted: N, updated: N }
 *   - 실패: { error: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { buildStorageTimestamp } from '@/lib/occurrence-format';

export const dynamic = 'force-dynamic';

interface ExcelRow {
  airline_code: string;
  callsign_pair: string;
  my_callsign: string;
  other_callsign: string;
  other_airline_code?: string;
  // 관할 섹터 및 공항 정보
  sector?: string;
  departure_airport1?: string;
  arrival_airport1?: string;
  departure_airport2?: string;
  arrival_airport2?: string;
  // 유사도 분석 정보
  same_airline_code?: string;
  same_callsign_length?: string;
  same_number_position?: string;
  same_number_count?: number | null;
  same_number_ratio?: number | null;
  similarity?: string;
  // 관제 정보
  max_concurrent_traffic?: number | null;
  coexistence_minutes?: number | null;
  error_probability?: number | null;
  atc_recommendation?: string;
  // 오류 정보
  error_type?: string;
  sub_error?: string;
  risk_level?: string;
  occurrence_count?: number | null;
}

export async function POST(request: NextRequest) {
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

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: '파일이 없습니다.' },
        { status: 400 }
      );
    }

    // 파일 확장자 체크
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Excel 파일(.xlsx, .xls)만 업로드 가능합니다.' },
        { status: 400 }
      );
    }

    // 파일 업로드 기록 생성
    const uploadRecord = await query(
      `INSERT INTO file_uploads (file_name, file_size, uploaded_by, status)
       VALUES ($1, $2, $3, 'processing')`,
      [file.name, file.size, payload.userId]
    );

    // 실제 저장된 ID를 조회 (file_uploads.id는 TEXT UUID이므로)
    const idResult = await query(
      `SELECT id FROM file_uploads WHERE uploaded_by = $1 AND file_name = $2 ORDER BY uploaded_at DESC LIMIT 1`,
      [payload.userId, file.name]
    );

    if (idResult.rows.length === 0) {
      return NextResponse.json(
        { error: '파일 업로드 기록 조회 실패' },
        { status: 500 }
      );
    }

    const uploadId = idResult.rows[0].id;

    try {
      // 파일 데이터 읽기
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // xlsx 라이브러리 동적 import
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      // 첫 번째 시트 읽기
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // JSON으로 변환 (헤더 포함)
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (jsonData.length < 2) {
        throw new Error('데이터가 없습니다.');
      }

      // 헤더와 데이터 분리
      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1);

      let insertedCount = 0;
      let updatedCount = 0;
      const errors: string[] = [];

      // 각 행 처리
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        // 빈 행 스킵 (편명1이 있어야 유효한 행)
        if (!row || row.length === 0 || !row[4]) continue;

        try {
          // 엑셀 컬럼 매핑 (callsign.xlsx 기준)
          // 0: 순서, 1: 시작일시, 2: 종료일시, 3: 관할섹터명, 4: 편명1
          // 5: 출발공항1, 6: 목적공항1, 7: 편명2, 8: 출발공항2, 9: 목적공항2
          // 10: CALLSIGNPAIR, 11: 항공사구분, 12: 항공사국문
          // 13: 항공사코드동일여부, 14: 편명번호길이동일여부, 15: 편명번호동일숫자위치
          // 16: 편명번호동일숫자갯수, 17: 편명번호동일숫자구성비율(%)
          // 18: 편명유사도, 19: 최대동시관제량, 20: 공존시간(분)
          // 21: 오류발생가능성, 22: 관제사권고사항, 23: 오류유형, 24: 세부오류유형

          const callsign1 = String(row[4] || '').trim();
          const callsign2 = String(row[7] || '').trim();
          const airlineCodeRaw = String(row[11] || '').trim(); // "KAL | TWB" 또는 "KAL"

          // 추가 필드 추출
          const sector = row[3] ? String(row[3]).trim() : undefined;
          const departureAirport1 = row[5] ? String(row[5]).trim() : undefined;
          const arrivalAirport1 = row[6] ? String(row[6]).trim() : undefined;
          const departureAirport2 = row[8] ? String(row[8]).trim() : undefined;
          const arrivalAirport2 = row[9] ? String(row[9]).trim() : undefined;
          const sameAirlineCode = row[13] ? String(row[13]).trim() : undefined;
          const sameCallsignLength = row[14] ? String(row[14]).trim() : undefined;
          const sameNumberPosition = row[15] ? String(row[15]).trim() : undefined;
          // NaN 방지 헬퍼: 빈 셀/비숫자 → null
          const toInt = (v: any): number | null => {
            if (v === undefined || v === null || v === '') return null;
            const n = Number(v);
            return isNaN(n) ? null : Math.round(n);
          };
          const toFloat = (v: any): number | null => {
            if (v === undefined || v === null || v === '') return null;
            const n = Number(v);
            return isNaN(n) ? null : n;
          };

          const sameNumberCount = toInt(row[16]);
          const sameNumberRatio = toFloat(row[17]);
          const similarity = row[18] ? String(row[18]).trim() : undefined;
          const maxConcurrentTraffic = toInt(row[19]);
          const coexistenceMinutes = toInt(row[20]);
          const errorProbability = toFloat(row[21]);
          const atcRecommendation = row[22] ? String(row[22]).trim() : undefined;
          const errorType = row[23] ? String(row[23]).trim() : undefined;
          const subError = row[24] ? String(row[24]).trim() : undefined;
          // 발생건수 추출 (컬럼 25로 가정, 없으면 최소 1건으로 처리)
          const occurrenceCountRaw = toInt(row[25]);
          const occurrenceCount = occurrenceCountRaw && occurrenceCountRaw > 0 ? occurrenceCountRaw : 1;

          // 항공사 코드가 우리 시스템의 항공사 코드에 매핑되는지 확인
          // 우리 시스템에서 관리하는 국내 항공사만 필터링
          const domesticAirlines = [
            'KAL', // 대한항공
            'AAR', // 아시아나항공
            'JJA', // 제주항공
            'JNA', // 진에어
            'TWB', // 티웨이항공
            'ABL', // 에어부산
            'ASV', // 에어서울
            'ESR', // 이스타항공
            'EOK', // 이스타항공 (구코드)
            'FGW', // 플라이강원
            'ARK', // 에어로케이항공
            'APZ', // 에어프레미아
          ];

          // 편명1과 편명2에서 항공사 코드 추출 (예: KAL852 -> KAL)
          const airlineCode1 = callsign1.replace(/[0-9]/g, '').trim();
          const airlineCode2 = callsign2.replace(/[0-9]/g, '').trim();

          // 편명1 또는 편명2 중 하나라도 국내 항공사인지 확인
          const isCallsign1Domestic = domesticAirlines.includes(airlineCode1);
          const isCallsign2Domestic = domesticAirlines.includes(airlineCode2);

          // 둘 다 국내 항공사가 아니면 스킵
          if (!isCallsign1Domestic && !isCallsign2Domestic) {
            continue;
          }

          // 국내 항공사를 my_callsign으로, 나머지를 other_callsign으로 설정
          let myAirlineCode: string, myCallsign: string, otherCallsign: string, otherAirlineCode: string;
          let myDepartureAirport: string | undefined, myArrivalAirport: string | undefined;
          let otherDepartureAirport: string | undefined, otherArrivalAirport: string | undefined;

          if (isCallsign1Domestic) {
            myAirlineCode = airlineCode1;
            myCallsign = callsign1;
            otherCallsign = callsign2;
            otherAirlineCode = airlineCode2;
            myDepartureAirport = departureAirport1;
            myArrivalAirport = arrivalAirport1;
            otherDepartureAirport = departureAirport2;
            otherArrivalAirport = arrivalAirport2;
          } else {
            myAirlineCode = airlineCode2;
            myCallsign = callsign2;
            otherCallsign = callsign1;
            otherAirlineCode = airlineCode1;
            myDepartureAirport = departureAirport2;
            myArrivalAirport = arrivalAirport2;
            otherDepartureAirport = departureAirport1;
            otherArrivalAirport = arrivalAirport1;
          }

          const rowData: ExcelRow = {
            airline_code: myAirlineCode,
            callsign_pair: `${myCallsign} | ${otherCallsign}`,
            my_callsign: myCallsign,
            other_callsign: otherCallsign,
            other_airline_code: otherAirlineCode || undefined,
            // 관할 섹터 및 공항 정보
            sector,
            departure_airport1: myDepartureAirport,
            arrival_airport1: myArrivalAirport,
            departure_airport2: otherDepartureAirport,
            arrival_airport2: otherArrivalAirport,
            // 유사도 분석 정보
            same_airline_code: sameAirlineCode,
            same_callsign_length: sameCallsignLength,
            same_number_position: sameNumberPosition,
            same_number_count: sameNumberCount,
            same_number_ratio: sameNumberRatio,
            similarity,
            // 관제 정보
            max_concurrent_traffic: maxConcurrentTraffic,
            coexistence_minutes: coexistenceMinutes,
            error_probability: errorProbability,
            atc_recommendation: atcRecommendation,
            // 오류 정보
            error_type: errorType,
            sub_error: subError,
            risk_level: similarity, // 유사도를 risk_level로도 사용
            occurrence_count: occurrenceCount,
          };

          // 필수 필드 검증
          if (!rowData.airline_code || !rowData.callsign_pair || !rowData.my_callsign || !rowData.other_callsign) {
            errors.push(`행 ${i + 2}: 필수 필드 누락`);
            continue;
          }

          // 항공사 ID 조회
          const airlineResult = await query(
            'SELECT id FROM airlines WHERE code = $1',
            [rowData.airline_code]
          );

          if (airlineResult.rows.length === 0) {
            errors.push(`행 ${i + 2}: 항공사 코드(${rowData.airline_code})를 찾을 수 없습니다.`);
            continue;
          }

          const airlineId = airlineResult.rows[0].id;

          // Step 1: 기존 레코드 확인
          const existingResult = await query(
            `SELECT id FROM callsigns WHERE airline_code = $1 AND callsign_pair = $2`,
            [rowData.airline_code, rowData.callsign_pair]
          );

          let callsignId: string;
          let isNewCallsign: boolean;

          if (existingResult.rows.length > 0) {
            // 업데이트
            callsignId = existingResult.rows[0].id;
            isNewCallsign = false;

            await query(
              `UPDATE callsigns SET
                sector = $1,
                departure_airport1 = $2,
                arrival_airport1 = $3,
                departure_airport2 = $4,
                arrival_airport2 = $5,
                same_airline_code = $6,
                same_callsign_length = $7,
                same_number_position = $8,
                same_number_count = $9,
                same_number_ratio = $10,
                similarity = $11,
                max_concurrent_traffic = $12,
                coexistence_minutes = $13,
                error_probability = $14,
                atc_recommendation = $15,
                error_type = $16,
                sub_error = $17,
                risk_level = $18,
                occurrence_count = $19,
                file_upload_id = $20,
                updated_at = CURRENT_TIMESTAMP,
                status = 'in_progress'
               WHERE id = $21`,
              [
                rowData.sector,
                rowData.departure_airport1,
                rowData.arrival_airport1,
                rowData.departure_airport2,
                rowData.arrival_airport2,
                rowData.same_airline_code,
                rowData.same_callsign_length,
                rowData.same_number_position,
                rowData.same_number_count,
                rowData.same_number_ratio,
                rowData.similarity,
                rowData.max_concurrent_traffic,
                rowData.coexistence_minutes,
                rowData.error_probability,
                rowData.atc_recommendation,
                rowData.error_type,
                rowData.sub_error,
                rowData.risk_level,
                rowData.occurrence_count,
                uploadId,
                callsignId,
              ]
            );
          } else {
            // 삽입 (신규 Callsign + Actions 처리)
            isNewCallsign = true;

            try {
              // 1. Callsign INSERT (초기 상태: 조치 미등록)
              const insertResult = await query(
                `INSERT INTO callsigns
                  (airline_id, airline_code, callsign_pair, my_callsign, other_callsign,
                   other_airline_code, sector, departure_airport1, arrival_airport1,
                   departure_airport2, arrival_airport2, same_airline_code, same_callsign_length,
                   same_number_position, same_number_count, same_number_ratio, similarity,
                   max_concurrent_traffic, coexistence_minutes, error_probability, atc_recommendation,
                   error_type, sub_error, risk_level, occurrence_count, file_upload_id, uploaded_at, status,
                   my_action_status, other_action_status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, CURRENT_TIMESTAMP, 'in_progress', 'no_action', 'no_action')`,
                [
                  airlineId,
                  rowData.airline_code,
                  rowData.callsign_pair,
                  rowData.my_callsign,
                  rowData.other_callsign,
                  rowData.other_airline_code,
                  rowData.sector,
                  rowData.departure_airport1,
                  rowData.arrival_airport1,
                  rowData.departure_airport2,
                  rowData.arrival_airport2,
                  rowData.same_airline_code,
                  rowData.same_callsign_length,
                  rowData.same_number_position,
                  rowData.same_number_count,
                  rowData.same_number_ratio,
                  rowData.similarity,
                  rowData.max_concurrent_traffic,
                  rowData.coexistence_minutes,
                  rowData.error_probability,
                  rowData.atc_recommendation,
                  rowData.error_type,
                  rowData.sub_error,
                  rowData.risk_level,
                  rowData.occurrence_count,
                  uploadId,
                ]
              );

              // 2. 새로 삽입된 ID 가져오기
              const idResult = await query(
                `SELECT id FROM callsigns WHERE airline_code = $1 AND callsign_pair = $2 ORDER BY uploaded_at DESC LIMIT 1`,
                [rowData.airline_code, rowData.callsign_pair]
              );

              callsignId = idResult.rows[0].id;

              // 📌 IMPORTANT: Actions은 나중에 항공사가 조치등록할 때 생성됨
              // (관리자의 호출부호 업로드에서는 callsigns만 생성)
            } catch (txError) {
              errors.push(`행 ${i + 2}: Callsign 또는 Actions 생성 실패 - ${txError instanceof Error ? txError.message : String(txError)}`);
              continue;
            }
          }

          // Step 2: 발생 날짜 및 시간 추출 (시작일시 row[1], 종료일시(row[2])는 보조용)
          const parseExcelDateTime = (value: any): Date | null => {
            if (value instanceof Date && !Number.isNaN(value.getTime())) {
              return value;
            }
            if (typeof value === 'number') {
              // Excel serial (with fractional part for time)
              const excelEpoch = new Date(Date.UTC(1899, 11, 30));
              return new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
            }
            if (typeof value === 'string') {
              const trimmed = value.trim();
              if (!trimmed) return null;
              const parsed = Date.parse(trimmed);
              if (!Number.isNaN(parsed)) {
                return new Date(parsed);
              }
            }
            return null;
          };

          const parseTimeValue = (value: any): string | null => {
            if (value === undefined || value === null || value === '') return null;
            if (typeof value === 'number') {
              const totalMinutes = Math.round(value * 24 * 60);
              const hours = Math.floor(totalMinutes / 60) % 24;
              const minutes = totalMinutes % 60;
              return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            }
            const str = String(value).trim();
            if (!str) return null;
            if (str.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
              const parts = str.split(':');
              const hour = parts[0].padStart(2, '0');
              const minute = parts[1].padStart(2, '0');
              return `${hour}:${minute}`;
            }
            const parsed = Date.parse(str);
            if (!Number.isNaN(parsed)) {
              const parsedDate = new Date(parsed);
              return `${String(parsedDate.getHours()).padStart(2, '0')}:${String(parsedDate.getMinutes()).padStart(2, '0')}`;
            }
            return null;
          };

          const formatMinutes = (date: Date): string => {
            return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
          };

          const startDateTime = parseExcelDateTime(row[1]);
          let occurredDate = startDateTime
            ? startDateTime.toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
          let occurredTime = startDateTime
            ? formatMinutes(startDateTime)
            : '00:00';

          // 보조 시간 컬럼(row[2]) 사용 (예: 종료일시에만 시간이 있는 파일)
          if ((!startDateTime || occurredTime === '00:00') && row[2]) {
            const fallbackTime = parseTimeValue(row[2]);
            if (fallbackTime) {
              occurredTime = fallbackTime;
            }
          }

          const { date: normalizedDate, timestamp } = buildStorageTimestamp(
            occurredDate,
            occurredTime
          );

          // Step 3: callsign_occurrences 테이블에 발생 이력 저장
          // 같은 callsign이 같은 날짜+시간에 나타나면 스킵 (UNIQUE constraint)
          try {
            // PostgreSQL TIMESTAMP 컬럼에는 전체 datetime 문자열 필요
            await query(
              `INSERT INTO callsign_occurrences
                (callsign_id, occurred_date, occurred_time, error_type, sub_error, file_upload_id)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (callsign_id, occurred_date) DO NOTHING`,
              [
                callsignId,
                normalizedDate,
                timestamp,
                rowData.error_type,
                rowData.sub_error,
                uploadId,
              ]
            );
          } catch (occurrenceError) {
            // 발생 이력 저장 실패해도 호출부호는 이미 저장되었으므로 진행
            console.warn(
              `발생 이력 저장 실패 (callsignId: ${callsignId}, date: ${normalizedDate}, time: ${occurredTime}):`,
              occurrenceError
            );
          }

          if (isNewCallsign) {
            insertedCount++;
          } else {
            updatedCount++;
          }
        } catch (rowError) {
          errors.push(`행 ${i + 2}: ${rowError instanceof Error ? rowError.message : String(rowError)}`);
        }
      }

      // Step 4: 각 callsign의 occurrence_count와 last_occurred_at 업데이트
      // SQLite 호환 UPDATE 문법 사용
      const callsignIds = await query(
        `SELECT id FROM callsigns WHERE file_upload_id = $1`,
        [uploadId]
      );

      for (const callsign of callsignIds.rows) {
        const countResult = await query(
          `SELECT COUNT(*) as count FROM callsign_occurrences WHERE callsign_id = $1`,
          [callsign.id]
        );

        const dateResult = await query(
          `SELECT MIN(occurred_date) as min_date, MAX(occurred_date) as max_date FROM callsign_occurrences WHERE callsign_id = $1`,
          [callsign.id]
        );

        const count = parseInt(countResult.rows[0].count, 10) || 0;
        const minDate = dateResult.rows[0].min_date;
        const maxDate = dateResult.rows[0].max_date;

        await query(
          `UPDATE callsigns SET occurrence_count = $1, first_occurred_at = $2, last_occurred_at = $3 WHERE id = $4`,
          [count, minDate || null, maxDate || null, callsign.id]
        );
      }

      // 업로드 기록 업데이트
      await query(
        `UPDATE file_uploads
         SET status = 'completed',
             total_rows = $1,
             success_count = $2,
             failed_count = $3,
             error_message = $4,
             processed_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [rows.length, insertedCount + updatedCount, errors.length, errors.join('\n'), uploadId]
      );

      return NextResponse.json({
        success: true,
        total: rows.length,
        inserted: insertedCount,
        updated: updatedCount,
        failed: errors.length,
        errors: errors.slice(0, 10), // 최대 10개만 반환
      });
    } catch (parseError) {
      // 파싱 실패 시 업로드 기록 업데이트
      await query(
        `UPDATE file_uploads 
         SET status = 'failed',
             error_message = $1
         WHERE id = $2`,
        [parseError instanceof Error ? parseError.message : '파일 파싱 오류', uploadId]
      );

      throw parseError;
    }
  } catch (error) {
    console.error('Excel 업로드 오류:', error);
    // W-10 FIX: 500 에러에서 내부 상세 메시지 제거
    return NextResponse.json(
      { error: 'Excel 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
