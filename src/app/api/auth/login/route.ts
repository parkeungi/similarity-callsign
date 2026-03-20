// POST /api/auth/login - 이메일+비밀번호 인증 → JWT(Access+Refresh) 발급, bcrypt 비교, IP Rate Limiting(10회/분), 5회 실패 시 15분 계정 잠금, users·refresh_tokens 테이블 사용
/**
 * POST /api/auth/login
 * 로그인 API
 *
 * 보안 정책 (행안부 정보보호 지침):
 * - IP 기반 Rate Limiting: 10회/분 초과 시 429
 * - 계정 잠금: 5회 연속 실패 시 15분 잠금
 * - 성공 시 실패 횟수 초기화
 * - 열거 공격 방어: 이메일/비밀번호 오류 메시지 동일
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import { generateAccessToken, generateRefreshToken, hashRefreshToken } from '@/lib/jwt';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { COOKIE_OPTIONS } from '@/lib/constants';
import { setCsrfTokenCookie } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import * as authQueries from '@/lib/db/queries/auth';

const MAX_FAILED_ATTEMPTS = 5;       // 계정 잠금 임계값
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15분
const IP_RATE_LIMIT = 10;            // IP당 허용 횟수
const IP_WINDOW_MS = 60 * 1000;      // 1분

export async function POST(request: NextRequest) {
  try {
    // ── 1. IP Rate Limiting ────────────────────────────────────────────────
    const ip = getClientIp(request);
    const rl = rateLimit(`login:${ip}`, IP_RATE_LIMIT, IP_WINDOW_MS);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `요청이 너무 많습니다. ${rl.retryAfterSec}초 후 다시 시도해주세요.` },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }

    // ── 2. 입력 파싱 ────────────────────────────────────────────────────────
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ── 3. 사용자 조회 ──────────────────────────────────────────────────────
    const result = await query(authQueries.getUserByEmail, [normalizedEmail]);

    if (result.rows.length === 0) {
      // 열거 공격 방어: 동일 메시지
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    // ── 4. 계정 잠금 확인 ───────────────────────────────────────────────────
    if (user.locked_until) {
      const lockedUntil = new Date(user.locked_until);
      if (lockedUntil > new Date()) {
        const remainingSec = Math.ceil((lockedUntil.getTime() - Date.now()) / 1000);
        const remainingMin = Math.ceil(remainingSec / 60);
        return NextResponse.json(
          {
            error: `계정이 잠겨 있습니다. ${remainingMin}분 후 다시 시도해주세요.`,
            lockedUntil: lockedUntil.toISOString(),
          },
          { status: 423 }
        );
      }
      // 잠금 기간 경과 — 자동 해제
      await query(
        `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
        [user.id]
      );
    }

    // ── 5. 비밀번호 검증 ────────────────────────────────────────────────────
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      const newFailCount = (user.failed_login_attempts || 0) + 1;

      if (newFailCount >= MAX_FAILED_ATTEMPTS) {
        // 계정 잠금
        const lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        await query(
          `UPDATE users
           SET failed_login_attempts = $1, locked_until = $2
           WHERE id = $3`,
          [newFailCount, lockUntil.toISOString(), user.id]
        );
        return NextResponse.json(
          {
            error: `비밀번호를 ${MAX_FAILED_ATTEMPTS}회 잘못 입력했습니다. 계정이 15분간 잠겼습니다.`,
            lockedUntil: lockUntil.toISOString(),
          },
          { status: 423 }
        );
      }

      // 실패 횟수만 증가
      await query(
        `UPDATE users SET failed_login_attempts = $1 WHERE id = $2`,
        [newFailCount, user.id]
      );
      const remaining = MAX_FAILED_ATTEMPTS - newFailCount;
      return NextResponse.json(
        {
          error: `이메일 또는 비밀번호가 올바르지 않습니다. (${remaining}회 더 실패하면 계정이 잠깁니다.)`,
        },
        { status: 401 }
      );
    }

    // ── 6. 계정 상태 확인 ───────────────────────────────────────────────────
    if (user.status === 'suspended') {
      return NextResponse.json({ error: '정지된 계정입니다.' }, { status: 403 });
    }

    // ── 7. 로그인 성공 — 실패 횟수 초기화 ────────────────────────────────────
    await query(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL,
           last_login_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [user.id]
    );

    // ── 8. 90일 비밀번호 만료 확인 ──────────────────────────────────────────
    if (user.last_password_changed_at) {
      const lastChanged = new Date(user.last_password_changed_at);
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      if (lastChanged < ninetyDaysAgo) {
        await query(
          `UPDATE users SET password_change_required = true WHERE id = $1`,
          [user.id]
        );
        user.password_change_required = true;
      }
    }

    // ── 9. 토큰 발급 ────────────────────────────────────────────────────────
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      airlineId: user.airline_id,
    });

    const refreshToken = generateRefreshToken(user.id, user.role);
    const tokenHash = hashRefreshToken(refreshToken);

    // RefreshToken 해시 DB 저장 (로그아웃/탈취 무효화용)
    await query(
      `UPDATE users SET refresh_token_hash = $1 WHERE id = $2`,
      [tokenHash, user.id]
    );

    const airline = user.airline_code
      ? {
          id: user.airline_id,
          code: user.airline_code,
          name_ko: user.airline_name_ko,
          name_en: user.airline_name_en,
        }
      : null;

    const needsPasswordChange = !!user.is_default_password || !!user.password_change_required;

    const sanitizedUser = {
      id: user.id,
      email: user.email,
      status: user.status,
      role: user.role,
      airline_id: user.airline_id,
      airline,
      is_default_password: user.is_default_password,
      password_change_required: user.password_change_required,
      forceChangePassword: needsPasswordChange,
    };

    const response = NextResponse.json(
      { user: sanitizedUser, accessToken, forceChangePassword: needsPasswordChange },
      { status: 200 }
    );

    // RefreshToken httpOnly 쿠키 설정
    response.cookies.set(COOKIE_OPTIONS.REFRESH_TOKEN_NAME, refreshToken, {
      httpOnly: COOKIE_OPTIONS.HTTP_ONLY,
      secure: COOKIE_OPTIONS.SECURE,
      sameSite: COOKIE_OPTIONS.SAME_SITE,
      maxAge: COOKIE_OPTIONS.REFRESH_TOKEN_MAX_AGE,
      path: COOKIE_OPTIONS.PATH,
    });

    // CSRF 토큰 쿠키 설정 (Double Submit Cookie 패턴)
    setCsrfTokenCookie(response);

    return response;
  } catch (error) {
    logger.error('로그인 처리 중 오류', error, 'auth/login');
    return NextResponse.json(
      { error: '로그인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
