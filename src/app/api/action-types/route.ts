// GET /api/action-types - 활성 조치유형 목록 조회, action_types 테이블(is_active=true), display_order 순 정렬
/**
 * GET /api/action-types
 * 활성 조치유형 목록 조회 - 인증된 모든 유저 접근 가능 (항공사 포함)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    const result = await query(
      'SELECT id, name, description, display_order FROM action_types WHERE is_active = true ORDER BY display_order ASC, name ASC'
    );

    return NextResponse.json({ data: result.rows });
  } catch (error) {
    logger.error('조치유형 조회 오류', error, 'api/action-types');
    return NextResponse.json({ error: '조치유형 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
