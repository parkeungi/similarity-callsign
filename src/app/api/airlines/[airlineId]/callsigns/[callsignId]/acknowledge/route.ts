// PATCH /api/airlines/[airlineId]/callsigns/[callsignId]/acknowledge - 재검출 항목 확인 처리, JWT 권한 검증
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ airlineId: string; callsignId: string }> }
) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const { airlineId, callsignId } = await params;

    // 권한 검증: 관리자이거나 해당 항공사 소속 사용자만
    if (payload.role !== 'admin' && payload.airlineId !== airlineId) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 요청 항공사의 ICAO 코드 조회
    const airlineResult = await query(
      'SELECT code FROM airlines WHERE id = $1',
      [airlineId]
    );
    const airlineCode = airlineResult.rows[0]?.code;
    if (!airlineCode) {
      return NextResponse.json(
        { error: '항공사 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 해당 callsign이 이 항공사에 관련되는지 확인 (자사 또는 상대사로 포함)
    const callsignResult = await query(
      'SELECT id, callsign_pair FROM callsigns WHERE id = $1 AND (airline_id = $2 OR other_airline_code = $3)',
      [callsignId, airlineId, airlineCode]
    );

    if (callsignResult.rows.length === 0) {
      return NextResponse.json(
        { error: '해당 호출부호를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const callsignPair = callsignResult.rows[0].callsign_pair;

    // 자사 소유 행을 우선 업데이트, 없으면 전달된 행 업데이트
    const updateResult = await query(
      'UPDATE callsigns SET re_detected_acknowledged_at = NOW(), updated_at = NOW() WHERE airline_id = $1 AND callsign_pair = $2',
      [airlineId, callsignPair]
    );

    if (updateResult.rowCount === 0) {
      // 자사 행이 없는 경우 (상대사로만 표시되는 행) → 해당 행 직접 업데이트
      await query(
        'UPDATE callsigns SET re_detected_acknowledged_at = NOW(), updated_at = NOW() WHERE id = $1',
        [callsignId]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: '재검출 확인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
