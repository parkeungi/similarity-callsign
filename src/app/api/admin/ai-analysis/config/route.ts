// GET /api/admin/ai-analysis/config - AI Provider 설정 상태 확인 (키 노출 없이 boolean만 반환)
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { getAvailableProviders } from '@/lib/ai';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.substring(7);
  const payload = verifyToken(token || '');
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  const providers = getAvailableProviders();

  return NextResponse.json({ providers });
}
