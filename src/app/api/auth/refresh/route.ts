// POST /api/auth/refresh - refreshToken 쿠키로 새 AccessToken 발급, refresh_tokens 테이블 검증, 만료 시 401 반환
/**
 * POST /api/auth/refresh
 * 토큰 갱신 (refreshToken 쿠키 기반)
 *
 * 보안 정책:
 * - IP 기반 Rate Limiting: 30회/분
 * - JWT 서명 검증 (REFRESH_TOKEN_SECRET, audience: katc1:refresh)
 * - DB 저장 해시와 비교 → 탈취된 토큰 즉시 차단
 * - 토큰 rotation: 갱신마다 새 refreshToken 발급 + 해시 업데이트
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from '@/lib/jwt';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { COOKIE_OPTIONS } from '@/lib/constants';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const REFRESH_RATE_LIMIT = 30;       // IP당 허용 횟수
const REFRESH_WINDOW_MS = 60 * 1000; // 1분

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // ── Rate Limiting ────────────────────────────────────────────────────────
    const ip = getClientIp(request);
    const rl = rateLimit(`refresh:${ip}`, REFRESH_RATE_LIMIT, REFRESH_WINDOW_MS);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `요청이 너무 많습니다. ${rl.retryAfterSec}초 후 다시 시도해주세요.` },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    const refreshToken = request.cookies.get('refreshToken')?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: '리프레시 토큰이 필요합니다.' }, { status: 401 });
    }

    // ── 1. JWT 서명 검증 ────────────────────────────────────────────────────
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 리프레시 토큰입니다.' }, { status: 401 });
    }

    // ── 2. DB에서 사용자 + 저장된 해시 조회 ─────────────────────────────────
    const result = await query(
      `SELECT
         u.id, u.email, u.status, u.role, u.airline_id,
         u.is_default_password, u.password_change_required,
         u.refresh_token_hash,
         a.code as airline_code,
         a.name_ko as airline_name_ko,
         a.name_en as airline_name_en
       FROM users u
       LEFT JOIN airlines a ON u.airline_id = a.id
       WHERE u.id = $1`,
      [payload.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const user = result.rows[0];

    // ── 3. DB 해시 검증 (탈취 토큰 차단) ───────────────────────────────────
    // bcrypt.compare 사용 (bcrypt는 매번 다른 salt 생성하므로 직접 비교 불가)
    if (!user.refresh_token_hash) {
      return NextResponse.json({ error: '유효하지 않은 리프레시 토큰입니다.' }, { status: 401 });
    }

    const isValidHash = await bcrypt.compare(refreshToken, user.refresh_token_hash);

    if (!isValidHash) {
      // 해시 불일치 = 이미 로그아웃되었거나 탈취된 토큰
      return NextResponse.json({ error: '유효하지 않은 리프레시 토큰입니다.' }, { status: 401 });
    }

    // ── 4. 계정 상태 확인 ───────────────────────────────────────────────────
    if (user.status === 'suspended') {
      return NextResponse.json({ error: '정지된 계정입니다.' }, { status: 403 });
    }

    // ── 5. 새 토큰 생성 (rotation) ──────────────────────────────────────────
    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      airlineId: user.airline_id,
    });

    const newRefreshToken = generateRefreshToken(user.id, user.role);
    const newHash = await hashRefreshToken(newRefreshToken);

    // DB 해시 업데이트 (이전 refreshToken 즉시 무효화)
    await query(
      `UPDATE users SET refresh_token_hash = $1 WHERE id = $2`,
      [newHash, user.id]
    );

    const airline = user.airline_code
      ? {
          id: user.airline_id,
          code: user.airline_code,
          name_ko: user.airline_name_ko,
          name_en: user.airline_name_en,
        }
      : null;

    const sanitizedUser = {
      id: user.id,
      email: user.email,
      status: user.status,
      role: user.role,
      airline_id: user.airline_id,
      airline,
      is_default_password: user.is_default_password,
      password_change_required: user.password_change_required,
      forceChangePassword: !!user.is_default_password || !!user.password_change_required,
    };

    const response = NextResponse.json(
      { user: sanitizedUser, accessToken: newAccessToken },
      { status: 200 }
    );

    response.cookies.set(COOKIE_OPTIONS.REFRESH_TOKEN_NAME, newRefreshToken, {
      httpOnly: COOKIE_OPTIONS.HTTP_ONLY,
      secure: COOKIE_OPTIONS.SECURE,
      sameSite: COOKIE_OPTIONS.SAME_SITE,
      maxAge: COOKIE_OPTIONS.REFRESH_TOKEN_MAX_AGE,
      path: COOKIE_OPTIONS.PATH,
    });

    return response;
  } catch (error) {
    logger.error('토큰 갱신 중 오류', error, 'auth/refresh');
    return NextResponse.json({ error: '토큰 갱신 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
