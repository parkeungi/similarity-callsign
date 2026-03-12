// JWT 토큰 관리 - generateAccessToken(1h)·generateRefreshToken(7d)·verifyToken(검증+디코드), jsonwebtoken 기반, JWT_SECRET 환경변수
/**
 * JWT 토큰 생성 및 검증
 *
 * 보안 정책:
 * - AccessToken:  JWT_SECRET 서명, audience: 'katc1:access',  만료: 1h
 * - RefreshToken: REFRESH_TOKEN_SECRET 서명, audience: 'katc1:refresh', 만료: 7d
 * - audience/issuer 검증으로 토큰 혼용 공격 차단
 */

import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

const ISSUER = 'katc1';
const ACCESS_AUDIENCE = 'katc1:access';
const REFRESH_AUDIENCE = 'katc1:refresh';
const ACCESS_TOKEN_EXPIRES = '1h';
const REFRESH_TOKEN_EXPIRES = '7d';

function getAccessSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다.');
  return secret;
}

function getRefreshSecret(): string {
  // REFRESH_TOKEN_SECRET 미설정 시 경고 후 JWT_SECRET 사용 (하위 호환)
  const secret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('REFRESH_TOKEN_SECRET 환경변수가 설정되지 않았습니다.');
  if (!process.env.REFRESH_TOKEN_SECRET) {
    console.warn('[JWT] REFRESH_TOKEN_SECRET이 설정되지 않아 JWT_SECRET을 사용합니다. 보안 강화를 위해 별도 설정을 권장합니다.');
  }
  return secret;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'suspended';
  airlineId?: string;
}

/**
 * AccessToken 생성 (1시간 유효)
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, getAccessSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRES,
    issuer: ISSUER,
    audience: ACCESS_AUDIENCE,
  });
}

/**
 * RefreshToken 생성 (7일 유효)
 */
export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, getRefreshSecret(), {
    expiresIn: REFRESH_TOKEN_EXPIRES,
    issuer: ISSUER,
    audience: REFRESH_AUDIENCE,
  });
}

/**
 * AccessToken 검증
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getAccessSecret(), {
      issuer: ISSUER,
      audience: ACCESS_AUDIENCE,
    }) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * RefreshToken 검증
 */
export function verifyRefreshToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, getRefreshSecret(), {
      issuer: ISSUER,
      audience: REFRESH_AUDIENCE,
    }) as { userId: string };
  } catch {
    return null;
  }
}

/**
 * RefreshToken → SHA-256 해시 (DB 저장용)
 * bcrypt 불필요 — JWT 자체가 서명된 토큰이므로 SHA-256으로 충분
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
