// AI 분석 모듈 메인 진입점 - Provider 감지, 분석 실행 오케스트레이션
import { callAnthropic, ANTHROPIC_DEFAULT_MODEL } from './providers/anthropic';
import { callOpenAI, OPENAI_DEFAULT_MODEL } from './providers/openai';

export type AiProvider = 'anthropic' | 'openai';

export interface ProviderConfig {
  configured: boolean;
  defaultModel: string;
}

export interface AiCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  provider: AiProvider;
  model: string;
}

/**
 * 환경변수를 확인하여 사용 가능한 AI Provider 목록 반환
 */
export function getAvailableProviders(): Record<AiProvider, ProviderConfig> {
  return {
    anthropic: {
      configured: !!process.env.ANTHROPIC_API_KEY,
      defaultModel: ANTHROPIC_DEFAULT_MODEL,
    },
    openai: {
      configured: !!process.env.OPENAI_API_KEY,
      defaultModel: OPENAI_DEFAULT_MODEL,
    },
  };
}

/**
 * 지정된 Provider로 AI 분석 API를 호출
 */
export async function callAiAnalysis(
  provider: AiProvider,
  model: string | undefined,
  promptJson: Record<string, unknown>,
  pairs: unknown[]
): Promise<AiCallResult> {
  const systemPrompt = [
    '당신은 항공관제 유사호출부호 위험도 분석 전문가입니다.',
    'JSON 형식의 프롬프트와 데이터를 받아 분석 결과를 JSON으로만 출력합니다.',
    '반드시 {"results": [...]} 형식으로 출력하세요. 다른 텍스트는 포함하지 마세요.',
  ].join('\n');

  const userMessage = JSON.stringify({ prompt: promptJson, data: { totalCount: pairs.length, pairs } });

  if (provider === 'anthropic') {
    const usedModel = model || ANTHROPIC_DEFAULT_MODEL;
    const result = await callAnthropic(systemPrompt, userMessage, usedModel);
    return { ...result, provider, model: usedModel };
  }

  if (provider === 'openai') {
    const usedModel = model || OPENAI_DEFAULT_MODEL;
    const result = await callOpenAI(systemPrompt, userMessage, usedModel);
    return { ...result, provider, model: usedModel };
  }

  throw new Error(`지원하지 않는 AI Provider: ${provider}`);
}
