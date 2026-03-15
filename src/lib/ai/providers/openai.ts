// OpenAI GPT API 호출 래퍼 (자동 분석용)
import OpenAI from 'openai';

export const OPENAI_DEFAULT_MODEL = 'gpt-4o';

interface OpenAIResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * OpenAI GPT API를 호출하여 분석 결과 텍스트를 반환
 */
export async function callOpenAI(
  systemPrompt: string,
  userMessage: string,
  model: string = OPENAI_DEFAULT_MODEL
): Promise<OpenAIResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
  }

  const client = new OpenAI({ apiKey, timeout: 240_000 });

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    max_completion_tokens: 16384,
  });

  const text = response.choices[0]?.message?.content || '';

  return {
    text,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
  };
}
