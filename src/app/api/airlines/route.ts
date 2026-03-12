/**
 * GET /api/airlines
 * 공개 항공사 목록 API (인증 불필요)
 * - display_order 기준 정렬
 * - TanStack Query 클라이언트에서 staleTime: 30초로 캐싱 가능
 * - code 파라미터로 특정 항공사 조회 가능
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // code 파라미터로 특정 항공사 조회 가능
    const code = request.nextUrl.searchParams.get('code');

    let result;
    try {
        // code 파라미터가 있으면 필터링 (SQL 인젝션 방지)
        if (code) {
          result = await query(
            'SELECT id, code, name_ko, name_en, display_order FROM airlines WHERE code = $1 ORDER BY display_order ASC, code ASC',
            [code]
          );
        } else {
          result = await query(
            'SELECT id, code, name_ko, name_en, display_order FROM airlines ORDER BY display_order ASC, code ASC'
          );
        }
    } catch (err: any) {
      if (err.code === '42703') { // column does not exist 에러
        if (code) {
          result = await query(
            'SELECT id, code, name_ko, name_en, 0 as display_order FROM airlines WHERE code = $1 ORDER BY created_at ASC, code ASC',
            [code]
          );
        } else {
          result = await query(
            'SELECT id, code, name_ko, name_en, 0 as display_order FROM airlines ORDER BY created_at ASC, code ASC'
          );
        }
      } else {
        throw err;
      }
    }

    return NextResponse.json(
      {
        airlines: result.rows,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('항공사 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '항공사 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
