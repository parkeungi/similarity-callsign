// GET/POST/DELETE /api/admin/airlines - 항공사 CRUD, airlines 테이블, display_order 관리, POST 시 중복 code 검증, 관리자 전용
/**
 * GET /api/admin/airlines - 항공사 목록 조회 (관리자만)
 * POST /api/admin/airlines - 항공사 생성 (관리자만)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';

// 관리자 인증 확인 헬퍼
function checkAdminAuth(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: true, message: '인증이 필요합니다.', status: 401 };
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload || payload.role !== 'admin') {
    return { error: true, message: '관리자만 접근 가능합니다.', status: 403 };
  }

  return { error: false };
}

export async function GET(request: NextRequest) {
  try {
    const authCheck = checkAdminAuth(request.headers.get('Authorization'));
    if (authCheck.error) {
      return NextResponse.json(
        { error: authCheck.message },
        { status: authCheck.status }
      );
    }

    // display_order 기준으로 정렬된 항공사 목록 조회
    // display_order가 같을 경우 code 기준으로 2차 정렬
    // display_order 컬럼이 없으면 created_at, code 기준으로 정렬
    let result;
    try {
      result = await query(
        'SELECT id, code, name_ko, name_en, display_order FROM airlines ORDER BY display_order ASC, code ASC'
      );
    } catch (err: any) {
      if (err.code === '42703') { // column does not exist 에러
        result = await query(
          'SELECT id, code, name_ko, name_en, 0 as display_order FROM airlines ORDER BY created_at ASC, code ASC'
        );
      } else {
        throw err;
      }
    }

    return NextResponse.json(
      { airlines: result.rows },
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

export async function POST(request: NextRequest) {
  try {
    const authCheck = checkAdminAuth(request.headers.get('Authorization'));
    if (authCheck.error) {
      return NextResponse.json(
        { error: authCheck.message },
        { status: authCheck.status }
      );
    }

    const body = await request.json();
    const { code, name_ko, name_en } = body;

    // 유효성 검사
    if (!code || !name_ko) {
      return NextResponse.json(
        { error: '코드와 한글명은 필수입니다.' },
        { status: 400 }
      );
    }

    // 코드 중복 확인
    const existing = await query(
      'SELECT id FROM airlines WHERE code = $1',
      [code]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: '이미 존재하는 코드입니다.' },
        { status: 409 }
      );
    }

    // 다음 display_order 조회
    let nextOrder = 1;
    try {
      const orderResult = await query(
        'SELECT COALESCE(MAX(display_order), 0) as max_order FROM airlines'
      );
      nextOrder = orderResult.rows[0].max_order + 1;
    } catch (err: any) {
      if (err.code === '42703') { // column does not exist 에러
        nextOrder = 1;
      } else {
        throw err;
      }
    }

    // 항공사 생성
    await query(
      `INSERT INTO airlines (code, name_ko, name_en, display_order)
       VALUES ($1, $2, $3, $4)`,
      [code, name_ko, name_en, nextOrder]
    );

    // 생성된 항공사 조회
    const createdResult = await query(
      `SELECT id, code, name_ko, name_en, display_order FROM airlines
       WHERE code = $1`,
      [code]
    );

    if (createdResult.rows.length === 0) {
      return NextResponse.json(
        { error: '항공사 생성 확인 실패' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { airline: createdResult.rows[0] },
      { status: 201 }
    );
  } catch (error) {
    console.error('항공사 생성 오류:', error);
    return NextResponse.json(
      { error: '항공사 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
