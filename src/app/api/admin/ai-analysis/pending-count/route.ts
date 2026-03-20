// GET /api/admin/ai-analysis/pending-count - 미분석 쌍 총 건수 조회 (배치 계산용)
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { fetchPendingPairsCount } from '@/lib/ai/fetch-pending-pairs';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.substring(7);
  const payload = verifyToken(token || '');
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const counts = await fetchPendingPairsCount();

    return NextResponse.json({
      success: true,
      totalPairs: counts.total,
      newCount: counts.newCount,
      staleCount: counts.staleCount,
    });
  } catch (error) {
    logger.error('미분석 건수 조회 실패', error, 'admin/ai-analysis/pending-count');
    return NextResponse.json({ error: '미분석 건수 조회 실패' }, { status: 500 });
  }
}
