/**
 * POST /api/auth/forgot-password
 * 비밀번호 찾기 안내
 *
 * 폐쇄형 시스템 정책:
 * - 이메일 발송 없음
 * - 관리자 문의 안내만 반환
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      message:
        '비밀번호를 잊으셨나요? 시스템 관리자(항공교통본부)에게 문의하여 비밀번호를 초기화해주세요.',
    },
    { status: 200 }
  );
}
