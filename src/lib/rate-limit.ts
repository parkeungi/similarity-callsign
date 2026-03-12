// IP Rate Limiting - 인메모리 Map 기반, checkRateLimit(ip, maxRequests, windowMs)→boolean, 로그인 API에서 사용
/**
 * IP 기반 Rate Limiting (인메모리)
 * - 로그인: 10회/분 초과 시 429 반환
 * - 비밀번호 찾기: 5회/10분 초과 시 429 반환
 *
 * 단일 인스턴스(Render.com) 환경에 적합.
 * 다중 인스턴스 환경에서는 Redis 기반으로 교체 필요.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number; // epoch ms
}

const store = new Map<string, RateLimitEntry>();

// 주기적 정리 (메모리 누수 방지) — 5분마다 만료 항목 제거
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * @param key     식별 키 (예: `login:1.2.3.4`, `forgot:1.2.3.4`)
 * @param limit   허용 횟수
 * @param windowMs 윈도우 크기 (ms)
 * @returns { allowed: boolean, remaining: number, retryAfterSec: number }
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);

  return {
    allowed: entry.count <= limit,
    remaining,
    retryAfterSec,
  };
}

/** 요청 IP 추출 (Vercel/Render 환경 대응) */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
