// POST /api/admin/ai-analysis/auto - AI API를 호출하여 자동 분석 실행, 관리자 전용
// 배치 모드: batchSize + batchOffset 파라미터로 100건씩 분할 처리
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import { fetchPendingPairs } from '@/lib/ai/fetch-pending-pairs';
import { buildAnalysisPrompt } from '@/lib/ai/prompt-builder';
import { importAiResults } from '@/lib/ai/import-results';
import { parseAiResponse } from '@/lib/ai/parse-response';
import { callAiAnalysis, getAvailableProviders, type AiProvider } from '@/lib/ai';
import { logger } from '@/lib/logger';

// Vercel Hobby: 최대 60초, Pro: 최대 300초 (플랜에 맞게 조정)
export const maxDuration = 60;

/** 배치 크기 상수 */
const BATCH_SIZE = 100;

interface AutoRequest {
  provider?: AiProvider;
  model?: string;
  overwrite?: boolean;
  batchSize?: number;
  batchOffset?: number;
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.substring(7);
  const payload = verifyToken(token || '');
  if (!payload || payload.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
  }

  let body: AutoRequest;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // Provider 결정
  const providers = getAvailableProviders();
  const requestedProvider = body.provider;
  let provider: AiProvider;

  if (requestedProvider) {
    if (requestedProvider !== 'anthropic' && requestedProvider !== 'openai') {
      return NextResponse.json({
        error: `지원하지 않는 AI Provider: ${requestedProvider}. anthropic 또는 openai만 사용 가능합니다.`,
      }, { status: 400 });
    }
    if (!providers[requestedProvider]?.configured) {
      return NextResponse.json({
        error: `${requestedProvider.toUpperCase()}_API_KEY 환경변수가 설정되지 않았습니다.`,
      }, { status: 400 });
    }
    provider = requestedProvider;
  } else {
    if (providers.anthropic.configured) {
      provider = 'anthropic';
    } else if (providers.openai.configured) {
      provider = 'openai';
    } else {
      return NextResponse.json({
        error: 'AI API 키가 설정되지 않았습니다. .env에 ANTHROPIC_API_KEY 또는 OPENAI_API_KEY를 추가하세요.',
      }, { status: 400 });
    }
  }

  const model = body.model || providers[provider].defaultModel;
  const overwrite = body.overwrite ?? true;
  const batchSize = body.batchSize ?? BATCH_SIZE;
  const batchOffset = body.batchOffset ?? 0;

  // 해당 배치의 미분석 쌍 조회 (limit/offset)
  const pairs = await fetchPendingPairs(batchSize, batchOffset);
  if (pairs.length === 0) {
    return NextResponse.json({
      success: true,
      message: '이 배치에 분석할 미분석 콜사인 쌍이 없습니다.',
      batchOffset,
      batchSize,
      pairsInBatch: 0,
      summary: { total: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
    });
  }

  try {
    // 프롬프트 생성
    const promptData = buildAnalysisPrompt(pairs);

    // AI API 호출
    const aiResult = await callAiAnalysis(provider, model, promptData.prompt, pairs);

    // 응답 파싱
    const parsed = parseAiResponse(aiResult.text);

    // DB에 저장 (배치 단위 커밋)
    const analyzedBy = `${provider}:${aiResult.model}`;
    const summary = await importAiResults(parsed.results, overwrite, analyzedBy);

    // Job 기록 (배치별로는 간이 기록)
    try {
      await query(
        `INSERT INTO ai_analysis_jobs
         (status, provider, model, total_pairs, processed_pairs, inserted_count, updated_count, error_count,
          token_input, token_output, started_at, completed_at, created_by)
         VALUES ('completed', $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), $10)`,
        [provider, model, pairs.length, summary.valid, summary.inserted, summary.updated, summary.errors,
         aiResult.inputTokens, aiResult.outputTokens, payload.userId]
      );
    } catch {
      // Job 기록 실패 무시
    }

    return NextResponse.json({
      success: true,
      provider,
      model: aiResult.model,
      batchOffset,
      batchSize,
      pairsInBatch: pairs.length,
      tokenUsage: {
        input: aiResult.inputTokens,
        output: aiResult.outputTokens,
      },
      summary: {
        total: summary.total,
        valid: summary.valid,
        inserted: summary.inserted,
        updated: summary.updated,
        skipped: summary.skipped,
        errors: summary.errors,
      },
      validationErrors: summary.validationErrors.length > 0
        ? summary.validationErrors.slice(0, 10)
        : undefined,
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : '알 수 없는 오류';

    // Job 실패 기록
    try {
      await query(
        `INSERT INTO ai_analysis_jobs
         (status, provider, model, total_pairs, error_message, started_at, completed_at, created_by)
         VALUES ('failed', $1, $2, $3, $4, NOW(), NOW(), $5)`,
        [provider, model, pairs.length, rawMessage.substring(0, 1000), payload.userId]
      );
    } catch {
      // 업데이트 실패 무시
    }

    logger.error('AI 자동 분석 배치 실패', error, 'admin/ai-analysis/auto');

    const safeMessage = rawMessage.includes('AI 응답에서')
      ? 'AI 응답 파싱 실패: JSON 형식이 올바르지 않습니다.'
      : rawMessage.substring(0, 200);

    return NextResponse.json({
      error: `AI 분석 실패: ${safeMessage}`,
      batchOffset,
      batchSize,
      pairsInBatch: pairs.length,
    }, { status: 500 });
  }
}
