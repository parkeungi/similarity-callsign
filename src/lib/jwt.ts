// JWT 토큰 관리 - generateAccessToken(30m)·generateRefreshToken(7d)·verifyToken(검증+디코드), jsonwebtoken 기반, JWT_SECRET 환경변수
/**
 * JWT 토큰 생성 및 검증
 *
 * 보안 정책:
 * - AccessToken:  JWT_SECRET 서명, audience: 'katc1:access',  만료: 30m
 * - RefreshToken: REFRESH_TOKEN_SECRET 서명, audience: 'katc1:refresh', 만료: 7d
 * - audience/issuer 검증으로 토큰 혼용 공격 차단
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';

const ISSUER = 'katc1';
const ACCESS_AUDIENCE = 'katc1:access';
const REFRESH_AUDIENCE = 'katc1:refresh';
const ACCESS_TOKEN_EXPIRES = '30m';
const REFRESH_TOKEN_EXPIRES = '7d';

function getAccessSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다.');
  return secret;
}

function getRefreshSecret(): string {
  const secret = process.env.REFRESH_TOKEN_SECRET;
  const jwtSecret = process.env.JWT_SECRET;

  // 프로덕션: REFRESH_TOKEN_SECRET 필수, JWT_SECRET과 달라야 함
  if (process.env.NODE_ENV === 'production') {
    if (!secret) {
      throw new Error('[보안] 프로덕션 환경에서는 REFRESH_TOKEN_SECRET이 필수입니다.');
    }
    if (secret === jwtSecret) {
      logger.warn('REFRESH_TOKEN_SECRET과 JWT_SECRET이 동일합니다. 보안을 위해 분리를 권장합니다.', 'jwt/security');
    }
    if (secret.length < 32) {
      logger.warn('REFRESH_TOKEN_SECRET이 32자 미만입니다. 더 긴 시크릿을 권장합니다.', 'jwt/security');
    }
    return secret;
  }

  // 개발: 폴백 허용 (하위 호환)
  const finalSecret = secret || jwtSecret;
  if (!finalSecret) throw new Error('REFRESH_TOKEN_SECRET 환경변수가 설정되지 않았습니다.');
  if (!secret) {
    logger.warn('REFRESH_TOKEN_SECRET이 설정되지 않아 JWT_SECRET을 사용합니다. 보안 강화를 위해 별도 설정을 권장합니다.', 'jwt/security');
  }
  return finalSecret;
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
 * role을 포함하여 미들웨어에서 admin 경로 접근 제어에 사용
 */
export function generateRefreshToken(userId: string, role: 'admin' | 'user' = 'user'): string {
  return jwt.sign({ userId, role }, getRefreshSecret(), {
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
 * RefreshToken → bcrypt 해시 (DB 저장용)
 * bcrypt 사용 — DB 유출 시에도 토큰 크랙 방지 (공공기관 보안 강화)
 * cost=10: 적절한 성능과 보안 균형
 */
export async function hashRefreshToken(token: string): Promise<string> {
  return await bcrypt.hash(token, 10);
}
