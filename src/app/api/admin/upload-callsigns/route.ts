// POST /api/admin/upload-callsigns - Excel(xlsx) 업로드 → callsigns·callsign_occurrences UPSERT, file_uploads 이력 기록, 글로벌 쌍 키(callsign_a/b) 정규화, 관리자 전용
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
 *
 * 성능 최적화 (v2):
 *   - Batch UPSERT: 행별 쿼리 → 일괄 처리
 *   - 기존 레코드 일괄 조회
 *   - SAVEPOINT 제거
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query, transaction } from '@/lib/db';
import { buildStorageTimestamp } from '@/lib/occurrence-format';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface ParsedRow {
  airline_code: string;
  airline_id: string;
  callsign_pair: string;
  my_callsign: string;
  other_callsign: string;
  other_airline_code?: string;
  sector?: string;
  departure_airport1?: string;
  arrival_airport1?: string;
  departure_airport2?: string;
  arrival_airport2?: string;
  same_airline_code?: string;
  same_callsign_length?: string;
  same_number_position?: string;
  same_number_count?: number | null;
  same_number_ratio?: number | null;
  similarity?: string;
  max_concurrent_traffic?: number | null;
  coexistence_minutes?: number | null;
  error_probability?: number | null;
  atc_recommendation?: string;
  error_type?: string;
  sub_error?: string;
  risk_level?: string;
  occurrence_count?: number;
  // 발생 이력용
  occurred_date: string;
  occurred_time: string;
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

    // 파일 크기 제한 (10MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '파일 크기가 10MB를 초과합니다.' },
        { status: 400 }
      );
    }

    // 파일 확장자 체크
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExtension = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExtension) {
      return NextResponse.json(
        { error: 'Excel(.xlsx, .xls) 또는 CSV(.csv) 파일만 업로드 가능합니다.' },
        { status: 400 }
      );
    }

    // 파일 업로드 기록 생성
    const uploadRecord = await query(
      `INSERT INTO file_uploads (file_name, file_size, uploaded_by, status)
       VALUES ($1, $2, $3, 'processing') RETURNING id`,
      [file.name, file.size, payload.userId]
    );

    if (uploadRecord.rows.length === 0) {
      return NextResponse.json(
        { error: '파일 업로드 기록 생성 실패' },
        { status: 500 }
      );
    }

    const uploadId = uploadRecord.rows[0].id;

    try {
      // 파일 데이터 읽기
      const arrayBuffer = await file.arrayBuffer();
      let buffer = Buffer.from(arrayBuffer);

      // CSV 파일인 경우 EUC-KR → UTF-8 인코딩 변환
      const isCSV = file.name.toLowerCase().endsWith('.csv');
      if (isCSV) {
        const iconv = await import('iconv-lite');
        // BOM이 있으면 UTF-8, 없으면 EUC-KR로 판단
        const isUTF8 = buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF;
        if (!isUTF8) {
          const decoded = iconv.decode(buffer, 'euc-kr');
          buffer = Buffer.from(decoded, 'utf-8');
        }
      }

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
      const rows = jsonData.slice(1);

      // 항공사 목록을 한 번만 조회 (성능 최적화)
      const allAirlinesResult = await query("SELECT id, code FROM airlines");
      const domesticAirlines = new Set(
        allAirlinesResult.rows
          .filter((a: { code: string }) => a.code !== 'FOREIGN')
          .map((a: { code: string }) => a.code)
      );
      const airlineIdMap = new Map<string, string>(
        allAirlinesResult.rows.map((a: { id: string; code: string }) => [a.code, a.id])
      );

      // ========== STEP 1: 모든 행 파싱 (DB 호출 없음) ==========
      const parsedRows: ParsedRow[] = [];
      const errors: string[] = [];
      let skippedCount = 0;

      // 헬퍼 함수들
      // 호출부호 쌍 정규화: "KAL121 | KAL112"와 "KAL112 | KAL121"을 동일 쌍으로 처리
      // swapped=true면 a/b가 뒤바뀌었으므로 연결 데이터(출도착 등)도 스왑 필요
      const normalizePair = (a: string, b: string): { sortedA: string; sortedB: string; swapped: boolean } => {
        if (a <= b) return { sortedA: a, sortedB: b, swapped: false };
        return { sortedA: b, sortedB: a, swapped: true };
      };

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

      const parseExcelDateTime = (value: any): Date | null => {
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
          return value;
        }
        if (typeof value === 'number') {
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

      const formatMinutes = (date: Date): string => {
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
      };

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        // 빈 행 스킵 (편명1이 있어야 유효한 행)
        if (!row || row.length === 0 || !row[3]) {
          skippedCount++;
          continue;
        }

        try {
          const callsign1 = String(row[3] || '').trim();
          const callsign2 = String(row[6] || '').trim();

          // 추가 필드 추출
          const sector = row[2] ? String(row[2]).trim() : undefined;
          const departureAirport1 = row[4] ? String(row[4]).trim() : undefined;
          const arrivalAirport1 = row[5] ? String(row[5]).trim() : undefined;
          const departureAirport2 = row[7] ? String(row[7]).trim() : undefined;
          const arrivalAirport2 = row[8] ? String(row[8]).trim() : undefined;
          const sameAirlineCode = row[12] ? String(row[12]).trim() : undefined;
          const sameCallsignLength = row[13] ? String(row[13]).trim() : undefined;
          const sameNumberPosition = row[14] ? String(row[14]).trim() : undefined;
          const sameNumberCount = toInt(row[15]);
          const sameNumberRatio = toFloat(row[16]);
          const similarity = row[17] ? String(row[17]).trim() : undefined;
          const maxConcurrentTraffic = toInt(row[18]);
          const coexistenceMinutes = toInt(row[19]);
          const errorProbability = toFloat(row[20]);
          const riskLevelGrade = row[21] ? String(row[21]).trim() : undefined;
          const atcRecommendation = row[23] ? String(row[23]).trim() : undefined;
          const errorType = row[27] ? String(row[27]).trim() : undefined;
          const subError = row[28] ? String(row[28]).trim() : undefined;

          // 편명에서 항공사 코드 추출
          const airlineCode1 = callsign1.replace(/[0-9]/g, '').trim();
          const airlineCode2 = callsign2.replace(/[0-9]/g, '').trim();

          // 국내 항공사 여부 확인
          const isCallsign1Domestic = domesticAirlines.has(airlineCode1);
          const isCallsign2Domestic = domesticAirlines.has(airlineCode2);

          // 오류발생가능성_등급이 '낮음' 또는 '매우낮음'이면 스킵
          const riskGradeNormalized = riskLevelGrade?.replace(/\s+/g, '');
          if (riskGradeNormalized && ['낮음', '매우낮음'].includes(riskGradeNormalized)) {
            skippedCount++;
            continue;
          }

          // 유사도가 '높음' 또는 '매우높음'인 경우만 업로드
          const similarityNormalized = similarity?.replace(/\s+/g, '');
          if (!similarityNormalized || !['높음', '매우높음'].includes(similarityNormalized)) {
            skippedCount++;
            continue;
          }

          // 공존시간 3분 미만 스킵
          if (coexistenceMinutes !== null && coexistenceMinutes < 3) {
            skippedCount++;
            continue;
          }

          // 국내/외항사 구분
          let myAirlineCode: string, myCallsign: string, otherCallsign: string, otherAirlineCode: string;
          let myDepartureAirport: string | undefined, myArrivalAirport: string | undefined;
          let otherDepartureAirport: string | undefined, otherArrivalAirport: string | undefined;

          if (!isCallsign1Domestic && !isCallsign2Domestic) {
            myAirlineCode = 'FOREIGN';
            myCallsign = callsign1;
            otherCallsign = callsign2;
            otherAirlineCode = airlineCode2;
            myDepartureAirport = departureAirport1;
            myArrivalAirport = arrivalAirport1;
            otherDepartureAirport = departureAirport2;
            otherArrivalAirport = arrivalAirport2;
          } else if (isCallsign1Domestic) {
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

          // 호출부호 쌍 정규화 (순서 무관하게 동일 쌍으로 처리)
          // swapped이면 callsign 순서가 바뀌었으므로 연결 데이터도 스왑
          const { sortedA, sortedB, swapped } = normalizePair(myCallsign, otherCallsign);
          const callsignPair = `${sortedA} | ${sortedB}`;

          // 정규화에 따라 callsign·출도착·항공사코드를 쌍 순서(A/B)로 정렬
          const callsignA = sortedA;
          const callsignB = sortedB;
          const depA = swapped ? otherDepartureAirport : myDepartureAirport;
          const arrA = swapped ? otherArrivalAirport : myArrivalAirport;
          const depB = swapped ? myDepartureAirport : otherDepartureAirport;
          const arrB = swapped ? myArrivalAirport : otherArrivalAirport;
          // swapped이면 정규화 후 "other"는 원래의 "my" 쪽
          const otherCode = swapped ? myAirlineCode : otherAirlineCode;

          // 필수 필드 검증
          if (!myAirlineCode || !callsignPair || !callsignA || !callsignB) {
            errors.push(`행 ${i + 2}: 필수 필드 누락`);
            continue;
          }

          // 항공사 ID 조회
          const airlineId = airlineIdMap.get(myAirlineCode);
          if (!airlineId) {
            errors.push(`행 ${i + 2}: 항공사 코드(${myAirlineCode})를 찾을 수 없습니다.`);
            continue;
          }

          // 발생 날짜/시간 파싱
          const startDateTime = parseExcelDateTime(row[0]);
          let occurredDate = startDateTime
            ? startDateTime.toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
          let occurredTime = startDateTime
            ? formatMinutes(startDateTime)
            : '00:00';

          if ((!startDateTime || occurredTime === '00:00') && row[1]) {
            const fallbackDateTime = parseExcelDateTime(row[1]);
            if (fallbackDateTime) {
              if (!startDateTime) {
                occurredDate = fallbackDateTime.toISOString().split('T')[0];
              }
              const fallbackTime = formatMinutes(fallbackDateTime);
              if (fallbackTime !== '00:00') {
                occurredTime = fallbackTime;
              }
            }
          }

          const { date: normalizedDate, timestamp: normalizedTimestamp } = buildStorageTimestamp(
            occurredDate,
            occurredTime
          );

          parsedRows.push({
            airline_code: myAirlineCode,
            airline_id: airlineId,
            callsign_pair: callsignPair,
            my_callsign: callsignA,
            other_callsign: callsignB,
            other_airline_code: otherCode || undefined,
            sector,
            departure_airport1: depA,
            arrival_airport1: arrA,
            departure_airport2: depB,
            arrival_airport2: arrB,
            same_airline_code: sameAirlineCode,
            same_callsign_length: sameCallsignLength,
            same_number_position: sameNumberPosition,
            same_number_count: sameNumberCount,
            same_number_ratio: sameNumberRatio,
            similarity,
            max_concurrent_traffic: maxConcurrentTraffic,
            coexistence_minutes: coexistenceMinutes,
            error_probability: errorProbability,
            atc_recommendation: atcRecommendation,
            error_type: errorType,
            sub_error: subError,
            risk_level: riskLevelGrade,
            occurrence_count: 1,
            occurred_date: normalizedDate,
            occurred_time: normalizedTimestamp,
          });
        } catch (rowError) {
          errors.push(`행 ${i + 2}: ${rowError instanceof Error ? rowError.message : String(rowError)}`);
        }
      }

      if (parsedRows.length === 0) {
        throw new Error('처리할 유효한 데이터가 없습니다.');
      }

      // ========== STEP 2: 기존 레코드 일괄 조회 ==========
      const uniquePairs = [...new Set(parsedRows.map(r => `${r.airline_code}::${r.callsign_pair}`))];
      const existingMap = new Map<string, string>(); // "airline_code::callsign_pair" -> id
      const completedSet = new Set<string>(); // 조치완료된 쌍 키

      // 청크로 나누어 조회 (PostgreSQL IN 절 제한 방지)
      const CHUNK_SIZE = 500;
      for (let i = 0; i < uniquePairs.length; i += CHUNK_SIZE) {
        const chunk = uniquePairs.slice(i, i + CHUNK_SIZE);
        const conditions = chunk.map((pair, idx) => {
          const [code, callsignPair] = pair.split('::');
          return `($${idx * 2 + 1}, $${idx * 2 + 2})`;
        }).join(', ');

        const params = chunk.flatMap(pair => {
          const [code, callsignPair] = pair.split('::');
          return [code, callsignPair];
        });

        const existingResult = await query(
          `SELECT id, airline_code, callsign_pair, status FROM callsigns
           WHERE (airline_code, callsign_pair) IN (${conditions})`,
          params
        );

        for (const row of existingResult.rows) {
          const key = `${row.airline_code}::${row.callsign_pair}`;
          existingMap.set(key, row.id);
          if (row.status === 'completed') {
            completedSet.add(key);
          }
        }
      }

      // ========== STEP 3: INSERT/UPDATE 분류 (배치 내 중복 제거) ==========
      const toInsert: ParsedRow[] = [];
      const toUpdateInProgress: (ParsedRow & { id: string })[] = [];  // 미완료 → 분석정보+상태 갱신
      const toUpdateCompleted: (ParsedRow & { id: string })[] = [];   // 조치완료 → 분석정보만 갱신, 상태 보존
      const insertKeySet = new Set<string>(); // 배치 내 중복 방지
      const updateKeySet = new Set<string>(); // UPDATE 중복 방지 (같은 쌍은 첫 행만 사용)

      for (const row of parsedRows) {
        const key = `${row.airline_code}::${row.callsign_pair}`;
        const existingId = existingMap.get(key);
        if (existingId) {
          if (!updateKeySet.has(key)) {
            updateKeySet.add(key);
            if (completedSet.has(key)) {
              toUpdateCompleted.push({ ...row, id: existingId });
            } else {
              toUpdateInProgress.push({ ...row, id: existingId });
            }
          }
          // 중복 행은 스킵 (occurrence는 별도 처리됨)
        } else if (!insertKeySet.has(key)) {
          insertKeySet.add(key);
          toInsert.push(row);
        }
      }

      let insertedCount = 0;
      let updatedCount = 0;

      // ========== STEP 4: Batch INSERT (트랜잭션) ==========
      await transaction(async (trx) => {
        // 4-1. Batch INSERT for new callsigns
        if (toInsert.length > 0) {
          const INSERT_BATCH_SIZE = 100;
          for (let i = 0; i < toInsert.length; i += INSERT_BATCH_SIZE) {
            const batch = toInsert.slice(i, i + INSERT_BATCH_SIZE);

            const values: any[] = [];
            const placeholders: string[] = [];
            let paramIdx = 1;

            for (const row of batch) {
              placeholders.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7}, $${paramIdx + 8}, $${paramIdx + 9}, $${paramIdx + 10}, $${paramIdx + 11}, $${paramIdx + 12}, $${paramIdx + 13}, $${paramIdx + 14}, $${paramIdx + 15}, $${paramIdx + 16}, $${paramIdx + 17}, $${paramIdx + 18}, $${paramIdx + 19}, $${paramIdx + 20}, $${paramIdx + 21}, $${paramIdx + 22}, $${paramIdx + 23}, $${paramIdx + 24}, $${paramIdx + 25}, CURRENT_TIMESTAMP, 'in_progress', 'no_action', 'no_action')`);
              values.push(
                row.airline_id,
                row.airline_code,
                row.callsign_pair,
                row.my_callsign,
                row.other_callsign,
                row.other_airline_code || null,
                row.sector || null,
                row.departure_airport1 || null,
                row.arrival_airport1 || null,
                row.departure_airport2 || null,
                row.arrival_airport2 || null,
                row.same_airline_code || null,
                row.same_callsign_length || null,
                row.same_number_position || null,
                row.same_number_count,
                row.same_number_ratio,
                row.similarity || null,
                row.max_concurrent_traffic,
                row.coexistence_minutes,
                row.error_probability,
                row.atc_recommendation || null,
                row.error_type || null,
                row.sub_error || null,
                row.risk_level || null,
                row.occurrence_count || 1,
                uploadId,
              );
              paramIdx += 26;
            }

            const insertResult = await trx(
              `INSERT INTO callsigns
                (airline_id, airline_code, callsign_pair, my_callsign, other_callsign,
                 other_airline_code, sector, departure_airport1, arrival_airport1,
                 departure_airport2, arrival_airport2, same_airline_code, same_callsign_length,
                 same_number_position, same_number_count, same_number_ratio, similarity,
                 max_concurrent_traffic, coexistence_minutes, error_probability, atc_recommendation,
                 error_type, sub_error, risk_level, occurrence_count, file_upload_id, uploaded_at, status,
                 my_action_status, other_action_status)
               VALUES ${placeholders.join(', ')}
               ON CONFLICT (airline_code, callsign_pair) DO NOTHING
               RETURNING id, callsign_pair, airline_code`,
              values
            );

            // 새로 삽입된 ID를 existingMap에 추가 (occurrence INSERT용)
            for (const row of insertResult.rows) {
              existingMap.set(`${row.airline_code}::${row.callsign_pair}`, row.id);
            }

            // DO NOTHING으로 스킵된 행의 ID를 별도 조회 (occurrence INSERT에 필요)
            const batchKeys = batch.map(r => `${r.airline_code}::${r.callsign_pair}`);
            const missingKeys = batchKeys.filter(k => !existingMap.has(k));
            if (missingKeys.length > 0) {
              const missingPairs = missingKeys.map(k => {
                const [code, ...pairParts] = k.split('::');
                return { code, pair: pairParts.join('::') };
              });
              const missingConditions = missingPairs.map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`).join(', ');
              const missingParams = missingPairs.flatMap(p => [p.code, p.pair]);
              const missingResult = await trx(
                `SELECT id, airline_code, callsign_pair FROM callsigns
                 WHERE (airline_code, callsign_pair) IN (${missingConditions})`,
                missingParams
              );
              for (const row of missingResult.rows) {
                existingMap.set(`${row.airline_code}::${row.callsign_pair}`, row.id);
              }
            }

            insertedCount += insertResult.rowCount || 0;

            // callsign_uploads junction 테이블에 링크 추가
            const junctionValues: any[] = [];
            const junctionPlaceholders: string[] = [];
            let jIdx = 1;
            for (const row of batch) {
              const key = `${row.airline_code}::${row.callsign_pair}`;
              const callsignId = existingMap.get(key);
              if (callsignId) {
                junctionPlaceholders.push(`($${jIdx}::uuid, $${jIdx + 1}::uuid)`);
                junctionValues.push(callsignId, uploadId);
                jIdx += 2;
              }
            }
            if (junctionPlaceholders.length > 0) {
              await trx(
                `INSERT INTO callsign_uploads (callsign_id, file_upload_id)
                 VALUES ${junctionPlaceholders.join(', ')}
                 ON CONFLICT (callsign_id, file_upload_id) DO NOTHING`,
                junctionValues
              );
            }
          }
        }

        // 4-2a. Batch UPDATE: 미완료 쌍 → 분석정보 + 상태 리셋
        const updateBatch = async (rows: (ParsedRow & { id: string })[], resetStatus: boolean) => {
          const UPDATE_BATCH_SIZE = 100;
          for (let i = 0; i < rows.length; i += UPDATE_BATCH_SIZE) {
            const batch = rows.slice(i, i + UPDATE_BATCH_SIZE);

            const values: any[] = [];
            const placeholders: string[] = [];
            let paramIdx = 1;

            for (const row of batch) {
              placeholders.push(`($${paramIdx}::uuid, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}, $${paramIdx + 6}, $${paramIdx + 7}, $${paramIdx + 8}, $${paramIdx + 9}::int, $${paramIdx + 10}::decimal, $${paramIdx + 11}, $${paramIdx + 12}::int, $${paramIdx + 13}::int, $${paramIdx + 14}::decimal, $${paramIdx + 15}, $${paramIdx + 16}, $${paramIdx + 17}, $${paramIdx + 18}, $${paramIdx + 19}::uuid)`);
              values.push(
                row.id,
                row.sector || null,
                row.departure_airport1 || null,
                row.arrival_airport1 || null,
                row.departure_airport2 || null,
                row.arrival_airport2 || null,
                row.same_airline_code || null,
                row.same_callsign_length || null,
                row.same_number_position || null,
                row.same_number_count,
                row.same_number_ratio,
                row.similarity || null,
                row.max_concurrent_traffic,
                row.coexistence_minutes,
                row.error_probability,
                row.atc_recommendation || null,
                row.error_type || null,
                row.sub_error || null,
                row.risk_level || null,
                uploadId,
              );
              paramIdx += 20;
            }

            // 미완료 쌍: status만 in_progress로 유지 (action_status는 보존)
            const statusClause = resetStatus
              ? `status = 'in_progress',`
              : '';

            await trx(
              `UPDATE callsigns AS c SET
                sector = v.sector,
                departure_airport1 = v.departure_airport1,
                arrival_airport1 = v.arrival_airport1,
                departure_airport2 = v.departure_airport2,
                arrival_airport2 = v.arrival_airport2,
                same_airline_code = v.same_airline_code,
                same_callsign_length = v.same_callsign_length,
                same_number_position = v.same_number_position,
                same_number_count = v.same_number_count,
                same_number_ratio = v.same_number_ratio,
                similarity = v.similarity,
                max_concurrent_traffic = v.max_concurrent_traffic,
                coexistence_minutes = v.coexistence_minutes,
                error_probability = v.error_probability,
                atc_recommendation = v.atc_recommendation,
                error_type = v.error_type,
                sub_error = v.sub_error,
                risk_level = v.risk_level,
                file_upload_id = v.file_upload_id,
                ${statusClause}
                updated_at = CURRENT_TIMESTAMP
              FROM (VALUES ${placeholders.join(', ')}) AS v(id, sector, departure_airport1, arrival_airport1, departure_airport2, arrival_airport2, same_airline_code, same_callsign_length, same_number_position, same_number_count, same_number_ratio, similarity, max_concurrent_traffic, coexistence_minutes, error_probability, atc_recommendation, error_type, sub_error, risk_level, file_upload_id)
              WHERE c.id = v.id`,
              values
            );

            updatedCount += batch.length;
          }
        };

        // 미완료 쌍: 분석정보 + 상태 리셋
        if (toUpdateInProgress.length > 0) {
          await updateBatch(toUpdateInProgress, true);
        }

        // 조치완료 쌍: 분석정보만 갱신, 상태/조치 보존 (재검출)
        if (toUpdateCompleted.length > 0) {
          await updateBatch(toUpdateCompleted, false);
        }

        // 4-2c. UPDATE된 콜사인들도 callsign_uploads junction에 링크 추가
        const allUpdatedRows = [...toUpdateInProgress, ...toUpdateCompleted];
        if (allUpdatedRows.length > 0) {
          const JUNCTION_BATCH_SIZE = 200;
          for (let i = 0; i < allUpdatedRows.length; i += JUNCTION_BATCH_SIZE) {
            const batch = allUpdatedRows.slice(i, i + JUNCTION_BATCH_SIZE);
            const jValues: any[] = [];
            const jPlaceholders: string[] = [];
            let jIdx = 1;
            for (const row of batch) {
              jPlaceholders.push(`($${jIdx}::uuid, $${jIdx + 1}::uuid)`);
              jValues.push(row.id, uploadId);
              jIdx += 2;
            }
            await trx(
              `INSERT INTO callsign_uploads (callsign_id, file_upload_id)
               VALUES ${jPlaceholders.join(', ')}
               ON CONFLICT (callsign_id, file_upload_id) DO NOTHING`,
              jValues
            );
          }
        }

        // 4-3. Batch INSERT for occurrences (배치 내 중복 제거)
        const occSeenKeys = new Set<string>();
        const dedupedOccRows = parsedRows.filter(row => {
          const callsignId = existingMap.get(`${row.airline_code}::${row.callsign_pair}`);
          if (!callsignId) return false;
          const occKey = `${callsignId}::${row.occurred_date}::${row.occurred_time}`;
          if (occSeenKeys.has(occKey)) return false;
          occSeenKeys.add(occKey);
          return true;
        });

        const OCCURRENCE_BATCH_SIZE = 200;
        for (let i = 0; i < dedupedOccRows.length; i += OCCURRENCE_BATCH_SIZE) {
          const batch = dedupedOccRows.slice(i, i + OCCURRENCE_BATCH_SIZE);

          const values: any[] = [];
          const placeholders: string[] = [];
          let paramIdx = 1;

          for (const row of batch) {
            const callsignId = existingMap.get(`${row.airline_code}::${row.callsign_pair}`);
            if (!callsignId) continue;

            placeholders.push(`($${paramIdx}::uuid, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, $${paramIdx + 5}::uuid, $${paramIdx + 6}, $${paramIdx + 7}, $${paramIdx + 8}, $${paramIdx + 9}, $${paramIdx + 10})`);
            values.push(
              callsignId,
              row.occurred_date,
              row.occurred_time,
              row.error_type || null,
              row.sub_error || null,
              uploadId,
              row.departure_airport1 || null,
              row.arrival_airport1 || null,
              row.departure_airport2 || null,
              row.arrival_airport2 || null,
              row.coexistence_minutes ?? null,
            );
            paramIdx += 11;
          }

          if (placeholders.length > 0) {
            await trx(
              `INSERT INTO callsign_occurrences
                (callsign_id, occurred_date, occurred_time, error_type, sub_error, file_upload_id,
                 departure_a, arrival_a, departure_b, arrival_b, coexistence_minutes)
               VALUES ${placeholders.join(', ')}
               ON CONFLICT (callsign_id, occurred_date, occurred_time) DO NOTHING`,
              values
            );
          }
        }

        // 4-4. occurrence_count 및 날짜 일괄 업데이트
        await trx(
          `UPDATE callsigns c SET
            occurrence_count = sub.cnt,
            first_occurred_at = sub.min_date,
            last_occurred_at = sub.max_date
          FROM (
            SELECT callsign_id,
                   COUNT(*) as cnt,
                   MIN(occurred_date) as min_date,
                   MAX(occurred_date) as max_date
            FROM callsign_occurrences
            WHERE callsign_id IN (SELECT id FROM callsigns WHERE file_upload_id = $1)
            GROUP BY callsign_id
          ) sub
          WHERE c.id = sub.callsign_id`,
          [uploadId]
        );

        // 4-5. AI 재분석 필요 여부 자동 감지
        await trx(
          `UPDATE callsign_ai_analysis ai
           SET needs_reanalysis = TRUE
           FROM callsigns c
           WHERE c.callsign_pair = ai.callsign_pair
             AND c.file_upload_id = $1
             AND ai.needs_reanalysis = FALSE
             AND (
               ai.coexistence_snapshot IS DISTINCT FROM c.coexistence_minutes
               OR ai.atc_snapshot IS DISTINCT FROM c.atc_recommendation
             )`,
          [uploadId]
        );
      }); // transaction 끝

      const reDetectedCount = toUpdateCompleted.length;
      const totalProcessed = insertedCount + updatedCount;

      // 처리된 건이 0건이면 이력 삭제 (의미 없는 기록 방지)
      if (totalProcessed === 0) {
        await query('DELETE FROM file_uploads WHERE id = $1', [uploadId]);
      } else {
        await query(
          `UPDATE file_uploads
           SET status = 'completed',
               total_rows = $1,
               success_count = $2,
               failed_count = $3,
               error_message = $4,
               processed_at = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [rows.length, totalProcessed, errors.length, errors.join('\n'), uploadId]
        );
      }

      return NextResponse.json({
        success: true,
        total: rows.length,
        inserted: insertedCount,
        updated: updatedCount,
        skipped: skippedCount,
        failed: errors.length,
        reDetected: reDetectedCount,
        errors: errors.slice(0, 10),
      });
    } catch (parseError) {
      // 파싱 실패 시 이력 삭제 (처리된 데이터 없으므로)
      await query('DELETE FROM file_uploads WHERE id = $1', [uploadId]);
      throw parseError;
    }
  } catch (error) {
    logger.error('Excel 업로드 오류', error, 'admin/upload-callsigns');
    const errorMessage = error instanceof Error ? error.message : 'Excel 업로드 중 오류가 발생했습니다.';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
