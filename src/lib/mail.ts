// 이메일 발송 서비스 - Nodemailer transporter(SMTP), sendPasswordResetEmail(to,tempPassword) 함수, EMAIL_HOST/PORT/USER/PASS 환경변수
/**
 * Nodemailer를 사용한 이메일 발송 서비스
 *
 * 지원하는 SMTP 서버:
 * - Gmail (무료, 간단)
 * - Outlook/Hotmail
 * - SendGrid (유료, 무료 티어 있음)
 * - Mailgun
 * - 직접 SMTP 서버 (회사 메일 등)
 */

import nodemailer, { Transporter } from 'nodemailer';
import { ROUTES } from '@/lib/constants';
import { logger } from '@/lib/logger';

// SMTP 트랜스포터 (이메일 발송 설정)
let transporter: Transporter | null = null;

/**
 * 이메일 발송 서비스 초기화
 * 환경 변수에서 SMTP 설정 읽기
 */
function initializeTransporter(): Transporter {
  if (transporter) {
    return transporter; // 캐시된 트랜스포터 반환
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;

  // 개발환경: 이메일 발송 없이 콘솔에만 출력
  if (!smtpHost || !smtpPort) {
    logger.warn('SMTP 설정이 없습니다. 개발 모드로 실행 중...', 'mail');
    return nodemailer.createTransport({
      host: 'localhost',
      port: 1025,
      secure: false,
      logger: true,
      debug: true,
    } as any);
  }

  // 프로덕션: 실제 SMTP 서버 연결
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: parseInt(smtpPort) === 465, // 465 포트는 SSL 사용
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  return transporter;
}

/**
 * 이메일 발송 함수
 */
export async function sendEmail(options: {
  to: string; // 수신자 이메일
  subject: string; // 제목
  html?: string; // HTML 본문
  text?: string; // 텍스트 본문
}): Promise<void> {
  try {
    const mailer = initializeTransporter();

    const result = await mailer.sendMail({
      from: process.env.SMTP_FROM_EMAIL || 'noreply@callsign.system',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    logger.info('이메일 발송 성공', 'mail', {
      messageId: result.messageId,
      to: options.to,
      subject: options.subject,
    });
  } catch (error) {
    logger.error('이메일 발송 실패', error, 'mail');
    throw error;
  }
}

/**
 * 임시 비밀번호 이메일 전송
 */
export async function sendTempPasswordEmail(
  email: string,
  tempPassword: string
): Promise<void> {
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const loginUrl = `${appBaseUrl}${ROUTES.LOGIN}`;

  const html = `
    <h2>유사호출부호 공유시스템 - 비밀번호 초기화</h2>
    <p>안녕하세요,</p>
    <p>비밀번호 초기화를 요청하셨습니다.</p>
    <p><strong>임시 비밀번호:</strong> <code>${tempPassword}</code></p>
    <p>위 임시 비밀번호로 로그인한 후 반드시 새로운 비밀번호로 변경해주세요.</p>
    <p><a href="${loginUrl}">로그인 바로가기</a></p>
    <hr>
    <p style="color: #666; font-size: 12px;">
      이 이메일은 자동 발송되었습니다. 심의하지 않은 비밀번호 초기화라면 무시해주세요.
    </p>
  `;

  const text = `
유사호출부호 공유시스템 - 비밀번호 초기화

안녕하세요,
비밀번호 초기화를 요청하셨습니다.

임시 비밀번호: ${tempPassword}

위 임시 비밀번호로 로그인한 후 반드시 새로운 비밀번호로 변경해주세요.
로그인: ${loginUrl}

이 이메일은 자동 발송되었습니다. 심의하지 않은 비밀번호 초기화라면 무시해주세요.
  `;

  await sendEmail({
    to: email,
    subject: '[유사호출부호 공유시스템] 비밀번호 초기화 임시 비밀번호',
    html,
    text,
  });
}
