// GET /api/admin/ai-analysis/export - AI 분석요청 JSON 내보내기 (v4: 점수변별력·reason분류·ai_reason 차별화 강화)
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { fetchPendingPairs } from '@/lib/ai/fetch-pending-pairs';
import { buildAnalysisPrompt } from '@/lib/ai/prompt-builder';
import { logger } from '@/lib/logger';

/**
 * GET /api/admin/ai-analysis/export
 * 미분석 + 재분석 필요 콜사인 쌍을 강화된 JSON으로 내보내기
 */
export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.substring(7);
  const payload = verifyToken(token || '');
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  try {
    const pairs = await fetchPendingPairs();
    const exportData = buildAnalysisPrompt(pairs);

    // 파일명 생성
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `ai_analysis_request_${dateStr}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    logger.error('분석요청 파일 생성 실패', error, 'admin/ai-analysis/export');
    return NextResponse.json({ error: '분석요청 파일 생성 실패' }, { status: 500 });
  }
}
