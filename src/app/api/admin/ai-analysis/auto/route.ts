// POST /api/admin/ai-analysis/auto - AI API를 호출하여 자동 분석 실행, 관리자 전용
import { NextRequest, NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import { fetchPendingPairs } from '@/lib/ai/fetch-pending-pairs';
import { buildAnalysisPrompt } from '@/lib/ai/prompt-builder';
import { importAiResults } from '@/lib/ai/import-results';
import { parseAiResponse } from '@/lib/ai/parse-response';
import { callAiAnalysis, getAvailableProviders, type AiProvider } from '@/lib/ai';
import { logger } from '@/lib/logger';

// Vercel Hobby: 최대 60초, Pro: 최대 300초 (플랜에 맞게 조정)
export const maxDuration = 60;

interface AutoRequest {
  provider?: AiProvider;
  model?: string;
  overwrite?: boolean;
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
    // 기본: anthropic 우선, 없으면 openai
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

  // 미분석 쌍 조회
  const pairs = await fetchPendingPairs();
  if (pairs.length === 0) {
    return NextResponse.json({
      success: true,
      message: '분석할 미분석 콜사인 쌍이 없습니다.',
      summary: { total: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
    });
  }

  // 중복 실행 방지 + Job 생성 (advisory lock으로 원자적 처리)
  let jobId: number | null = null;
  try {
    jobId = await transaction(async (txQuery) => {
      // advisory lock 획득 시도 (트랜잭션 종료 시 자동 해제)
      const lockResult = await txQuery(`SELECT pg_try_advisory_xact_lock(1001) AS locked`);
      if (!lockResult.rows[0]?.locked) {
        return null; // 다른 요청이 lock 점유 중
      }

      // stale running job 자동 만료 (10분 이상 경과 시 failed 처리)
      await txQuery(
        `UPDATE ai_analysis_jobs SET status = 'failed', error_message = '타임아웃으로 자동 만료', completed_at = NOW()
         WHERE status = 'running' AND started_at < NOW() - INTERVAL '10 minutes'`
      );

      // running 상태 Job 확인
      const runningJob = await txQuery(
        `SELECT id FROM ai_analysis_jobs WHERE status = 'running' LIMIT 1`
      );
      if (runningJob.rows.length > 0) {
        return null; // 이미 진행 중
      }

      // 새 Job 생성
      const jobResult = await txQuery(
        `INSERT INTO ai_analysis_jobs (status, provider, model, total_pairs, started_at, created_by)
         VALUES ('running', $1, $2, $3, NOW(), $4)
         RETURNING id`,
        [provider, model, pairs.length, payload.userId]
      );
      return jobResult.rows[0]?.id ?? null;
    });
  } catch {
    // 테이블 미존재 시 무시 (마이그레이션 전)
  }

  // lock 획득 실패 또는 이미 running job 존재
  if (jobId === null) {
    return NextResponse.json({
      error: '이미 진행 중인 AI 분석 작업이 있습니다. 완료 후 다시 시도하세요.',
    }, { status: 409 });
  }

  try {
    // 프롬프트 생성
    const promptData = buildAnalysisPrompt(pairs);

    // AI API 호출
    const aiResult = await callAiAnalysis(provider, model, promptData.prompt, pairs);

    // 응답 파싱
    const parsed = parseAiResponse(aiResult.text);

    // DB에 저장
    const analyzedBy = `${provider}:${aiResult.model}`;
    const summary = await importAiResults(parsed.results, overwrite, analyzedBy);

    // Job 완료 기록
    if (jobId) {
      try {
        await query(
          `UPDATE ai_analysis_jobs
           SET status = 'completed', processed_pairs = $1, inserted_count = $2,
               updated_count = $3, error_count = $4, token_input = $5, token_output = $6,
               completed_at = NOW()
           WHERE id = $7`,
          [summary.valid, summary.inserted, summary.updated, summary.errors,
           aiResult.inputTokens, aiResult.outputTokens, jobId]
        );
      } catch {
        // 업데이트 실패 무시
      }
    }

    return NextResponse.json({
      success: true,
      provider,
      model: aiResult.model,
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

    // Job 실패 기록 (내부 로그에는 전체 메시지 저장)
    if (jobId) {
      try {
        await query(
          `UPDATE ai_analysis_jobs
           SET status = 'failed', error_message = $1, completed_at = NOW()
           WHERE id = $2`,
          [rawMessage.substring(0, 1000), jobId]
        );
      } catch {
        // 업데이트 실패 무시
      }
    }

    logger.error('AI 자동 분석 실패', error, 'admin/ai-analysis/auto');

    // 클라이언트에는 AI 응답 원문을 노출하지 않음
    const safeMessage = rawMessage.includes('AI 응답에서')
      ? 'AI 응답 파싱 실패: JSON 형식이 올바르지 않습니다.'
      : rawMessage.substring(0, 200);

    return NextResponse.json({
      error: `AI 분석 실패: ${safeMessage}`,
    }, { status: 500 });
  }
}
