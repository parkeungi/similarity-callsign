// AI 응답 텍스트에서 JSON 결과를 견고하게 추출하는 파서
import type { AiAnalysisResult } from './import-results';

interface ParsedResponse {
  results: AiAnalysisResult[];
}

/**
 * 파싱된 객체에서 results 배열을 추출
 */
function extractResults(parsed: unknown): ParsedResponse | null {
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.results)) {
      return { results: obj.results };
    }
  }
  if (Array.isArray(parsed)) {
    return { results: parsed };
  }
  return null;
}

/**
 * 중괄호 매칭으로 올바른 JSON 종료 위치를 찾음
 */
function findMatchingBrace(str: string, startIdx: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < str.length; i++) {
    const ch = str[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

/**
 * AI 응답 텍스트에서 JSON을 추출하여 파싱
 * - 순수 JSON 직접 파싱
 * - ```json ... ``` 마크다운 블록 추출
 * - { "results": 패턴 탐색 (중괄호 매칭으로 정확한 범위 추출)
 */
export function parseAiResponse(raw: string): ParsedResponse {
  const trimmed = raw.trim();

  // 1. 직접 JSON 파싱 시도
  try {
    const result = extractResults(JSON.parse(trimmed));
    if (result) return result;
  } catch {
    // 파싱 실패 → 다음 시도
  }

  // 2. ```json ... ``` 마크다운 코드블록 추출
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      const result = extractResults(JSON.parse(codeBlockMatch[1].trim()));
      if (result) return result;
    } catch {
      // 파싱 실패 → 다음 시도
    }
  }

  // 3. { "results": [ 패턴 탐색 (중괄호 매칭)
  const patterns = ['{"results"', '{ "results"'];
  for (const pattern of patterns) {
    const startIdx = trimmed.indexOf(pattern);
    if (startIdx >= 0) {
      const endIdx = findMatchingBrace(trimmed, startIdx);
      if (endIdx >= 0) {
        try {
          const result = extractResults(JSON.parse(trimmed.substring(startIdx, endIdx + 1)));
          if (result) return result;
        } catch {
          // 파싱 실패 → 다음 패턴 시도
        }
      }
    }
  }

  throw new Error(
    'AI 응답에서 유효한 JSON을 추출할 수 없습니다. ' +
    '응답이 {"results": [...]} 형식인지 확인하세요. ' +
    `응답 시작: "${trimmed.substring(0, 100)}..."`
  );
}
