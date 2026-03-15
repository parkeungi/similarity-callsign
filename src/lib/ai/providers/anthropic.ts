// Anthropic Claude API 호출 래퍼 (자동 분석용)
import Anthropic from '@anthropic-ai/sdk';

export const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-20250514';

interface AnthropicResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Anthropic Claude API를 호출하여 분석 결과 텍스트를 반환
 */
export async function callAnthropic(
  systemPrompt: string,
  userMessage: string,
  model: string = ANTHROPIC_DEFAULT_MODEL
): Promise<AnthropicResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.');
  }

  const client = new Anthropic({ apiKey, timeout: 240_000 });

  const response = await client.messages.create({
    model,
    max_tokens: 16384,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map(block => block.text)
    .join('');

  return {
    text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
