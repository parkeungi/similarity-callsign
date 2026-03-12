// GET /api/admin/overview - 관리자 대시보드 개요(총 호출부호·항공사·조치완료율·최근업로드), callsigns·airlines·actions·file_uploads 집계
/**
 * GET /api/admin/overview
 * 전체 현황 관리 - 유사호출부호별 조치 현황 조회
 *
 * 컬럼:
 * - 등록일: callsigns.uploaded_at
 * - 유사호출부호: callsigns.callsign_pair
 * - 조치유형: callsigns.error_type / sub_error
 * - 발생건수: callsigns.occurrence_count
 * - 최근발생일: callsigns.last_occurred_at
 * - 항공사1: callsigns.airline_code
 * - 항공사2: callsigns.other_airline_code
 * - 조치현황: 진행중/부분완료/완료
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';

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

    // 조치 현황 조회
    const result = await query(`
      SELECT
        c.id,
        c.uploaded_at as registration_date,
        c.callsign_pair,
        c.my_callsign,
        c.other_callsign,
        c.airline_code,
        c.other_airline_code,
        c.error_type,
        c.sub_error,
        c.occurrence_count,
        c.last_occurred_at,
        c.status as callsign_status,
        a1.name_ko as airline1_name,
        a2.name_ko as airline2_name,

        -- 항공사1 조치 상태 및 조치유형
        (SELECT status FROM actions
         WHERE callsign_id = c.id AND airline_id = a1.id AND COALESCE(is_cancelled, false) = false
         ORDER BY registered_at DESC LIMIT 1) as airline1_action_status,

        (SELECT action_type FROM actions
         WHERE callsign_id = c.id AND airline_id = a1.id AND COALESCE(is_cancelled, false) = false
         ORDER BY registered_at DESC LIMIT 1) as airline1_action_type,

        -- 항공사2 조치 상태 및 조치유형
        (SELECT status FROM actions
         WHERE callsign_id = c.id AND airline_id = a2.id AND COALESCE(is_cancelled, false) = false
         ORDER BY registered_at DESC LIMIT 1) as airline2_action_status,

        (SELECT action_type FROM actions
         WHERE callsign_id = c.id AND airline_id = a2.id AND COALESCE(is_cancelled, false) = false
         ORDER BY registered_at DESC LIMIT 1) as airline2_action_type,

        -- 항공사1 조치 완료일
        (SELECT completed_at FROM actions
         WHERE callsign_id = c.id AND airline_id = a1.id AND status = 'completed' AND COALESCE(is_cancelled, false) = false
         ORDER BY registered_at DESC LIMIT 1) as airline1_completed_at,

        -- 항공사2 조치 완료일
        (SELECT completed_at FROM actions
         WHERE callsign_id = c.id AND airline_id = a2.id AND status = 'completed' AND COALESCE(is_cancelled, false) = false
         ORDER BY registered_at DESC LIMIT 1) as airline2_completed_at

      FROM callsigns c
      LEFT JOIN airlines a1 ON c.airline_id = a1.id
      LEFT JOIN airlines a2 ON c.other_airline_code = a2.code
      WHERE c.status IN ('in_progress', 'completed')
      ORDER BY c.uploaded_at DESC
    `);

    // 국내항공사 목록
    const domesticAirlines = ['KAL', 'AAR', 'JJA', 'JNA', 'TWB', 'ABL', 'ASV', 'ESR', 'EOK', 'FGW', 'APZ', 'ARK'];

    // 데이터 변환
    const data = result.rows.map((row: any) => {
      const isSameAirline = row.airline_code === row.other_airline_code;
      const isOtherForeign = !domesticAirlines.includes(row.other_airline_code);
      const isBothDomestic = domesticAirlines.includes(row.airline_code) && domesticAirlines.includes(row.other_airline_code);

      let action_status = '진행중';

      if (isSameAirline || isOtherForeign) {
        // 같은 항공사 또는 외항사: 한 쪽만 완료해도 완료
        if (row.airline1_action_status === 'completed' || row.airline2_action_status === 'completed') {
          action_status = '완료';
        }
      } else if (isBothDomestic) {
        // 서로 다른 국내항공사: 양쪽 모두 완료해야 완료
        if (row.airline1_action_status === 'completed' && row.airline2_action_status === 'completed') {
          action_status = '완료';
        } else if (row.airline1_action_status === 'completed' || row.airline2_action_status === 'completed') {
          action_status = '부분완료';
        }
      }

      // 조치 완료일 (두 항공사 중 늦은 날짜)
      let completion_date = null;
      if (action_status === '완료') {
        const date1 = row.airline1_completed_at ? new Date(row.airline1_completed_at).getTime() : 0;
        const date2 = row.airline2_completed_at ? new Date(row.airline2_completed_at).getTime() : 0;
        const latestDate = Math.max(date1, date2);
        if (latestDate > 0) {
          completion_date = new Date(latestDate).toISOString().split('T')[0];
        }
      }

      return {
        id: row.id,
        registration_date: row.registration_date ? row.registration_date.split(' ')[0] : null,
        callsign_pair: row.callsign_pair,
        my_callsign: row.my_callsign,
        other_callsign: row.other_callsign,
        error_type: row.error_type,
        sub_error: row.sub_error,
        occurrence_count: row.occurrence_count,
        last_occurred_at: row.last_occurred_at ? row.last_occurred_at.split(' ')[0] : null,

        // 항공사 정보
        airline1_code: row.airline_code,
        airline1_name: row.airline1_name,
        airline2_code: row.other_airline_code,
        airline2_name: row.airline2_name,

        // 조치 상태 및 조치유형
        airline1_action_status: row.airline1_action_status || 'no_action',
        airline1_action_type: row.airline1_action_type || '-',
        airline2_action_status: row.airline2_action_status || 'no_action',
        airline2_action_type: row.airline2_action_type || '-',

        // 최종 조치 현황
        action_status,
        completion_date
      };
    });

    return NextResponse.json({
      data,
      summary: {
        total: data.length,
        completed: data.filter((item: any) => item.action_status === '완료').length,
        partially_completed: data.filter((item: any) => item.action_status === '부분완료').length,
        in_progress: data.filter((item: any) => item.action_status === '진행중').length
      }
    });
  } catch (error) {
    console.error('전체 현황 조회 오류:', error);
    return NextResponse.json(
      { error: '전체 현황 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
