// 쿠키 파싱 유틸리티 - parseCookies(cookieString)→Record<string,string>, 서버사이드 쿠키 읽기용
/**
 * 공통 쿠키 파싱 유틸리티
 * - document.cookie에서 "name=value" 형태의 문자열을 전달하면 JSON 객체로 파싱한다.
 * - 이중으로 URL 인코딩된 값도 복구한다.
 */

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseJsonCookie<T>(cookieEntry: string | undefined): T | null {
  if (!cookieEntry) return null;
  const [, ...rest] = cookieEntry.split('=');
  const rawValue = rest.join('=').trim();
  if (!rawValue) return null;

  const attempts: string[] = [];
  attempts.push(rawValue);

  const once = safeDecode(rawValue);
  if (!attempts.includes(once)) attempts.push(once);

  const twice = safeDecode(once);
  if (!attempts.includes(twice)) attempts.push(twice);

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // 다음 후보 시도
    }
  }

  return null;
}
