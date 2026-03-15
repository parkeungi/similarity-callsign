// 구조화된 로거 - 환경별 로그 레벨 제어, 민감 정보 마스킹, JSON 형식 출력
/**
 * 구조화된 로깅 유틸리티
 *
 * 기능:
 * - 환경별 로그 레벨 제어 (development: debug, production: warn)
 * - 민감 정보 자동 마스킹 (비밀번호, 토큰, 이메일 등)
 * - 일관된 JSON 형식 (로그 수집/분석 용이)
 * - 타임스탬프 자동 추가
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// 로그 레벨 우선순위
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// 환경별 최소 로그 레벨
function getMinLogLevel(): LogLevel {
  if (process.env.NODE_ENV === 'production') {
    return 'warn'; // 프로덕션: warn 이상만 출력
  }
  return 'debug'; // 개발: 모두 출력
}

// 민감 정보 키 목록
const SENSITIVE_KEYS = [
  'password',
  'password_hash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'api_key',
  'apiKey',
  'authorization',
  'cookie',
  'credit_card',
  'ssn',
];

/**
 * 이메일 마스킹: user@example.com → u***@example.com
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***@${domain}`;
}

/**
 * 토큰 마스킹: eyJhbG... → eyJ***...
 */
function maskToken(token: string): string {
  if (token.length <= 10) return '***';
  return `${token.substring(0, 3)}***${token.substring(token.length - 3)}`;
}

/**
 * 객체 내 민감 정보 재귀적 마스킹
 */
function maskSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // 이메일 패턴 감지
    if (data.includes('@') && data.includes('.')) {
      return maskEmail(data);
    }
    // JWT 토큰 패턴 감지
    if (data.startsWith('eyJ') || data.length > 100) {
      return maskToken(data);
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(maskSensitiveData);
  }

  if (typeof data === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk))) {
        masked[key] = '***MASKED***';
      } else {
        masked[key] = maskSensitiveData(value);
      }
    }
    return masked;
  }

  return data;
}

/**
 * 로그 엔트리 생성
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: string,
  data?: Record<string, unknown>,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context) entry.context = context;
  if (data) entry.data = maskSensitiveData(data) as Record<string, unknown>;
  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    };
  }

  return entry;
}

/**
 * 로그 출력
 */
function log(level: LogLevel, message: string, context?: string, data?: Record<string, unknown>, error?: Error): void {
  const minLevel = getMinLogLevel();
  if (LOG_LEVELS[level] < LOG_LEVELS[minLevel]) {
    return; // 로그 레벨 미달 시 출력 안 함
  }

  const entry = createLogEntry(level, message, context, data, error);

  // 프로덕션: JSON 형식, 개발: 가독성 좋은 형식
  if (process.env.NODE_ENV === 'production') {
    const output = JSON.stringify(entry);
    switch (level) {
      case 'error':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  } else {
    // 개발 환경: 컬러 + 가독성
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]${context ? ` [${context}]` : ''}`;
    switch (level) {
      case 'error':
        console.error(prefix, message, data ? entry.data : '', error || '');
        break;
      case 'warn':
        console.warn(prefix, message, data ? entry.data : '');
        break;
      case 'info':
        console.info(prefix, message, data ? entry.data : '');
        break;
      default:
        console.log(prefix, message, data ? entry.data : '');
    }
  }
}

/**
 * 로거 인터페이스
 */
export const logger = {
  /**
   * 디버그 로그 (개발 환경에서만 출력)
   */
  debug: (message: string, context?: string, data?: Record<string, unknown>) => {
    log('debug', message, context, data);
  },

  /**
   * 정보 로그
   */
  info: (message: string, context?: string, data?: Record<string, unknown>) => {
    log('info', message, context, data);
  },

  /**
   * 경고 로그
   */
  warn: (message: string, context?: string, data?: Record<string, unknown>) => {
    log('warn', message, context, data);
  },

  /**
   * 에러 로그
   */
  error: (message: string, error?: Error | unknown, context?: string, data?: Record<string, unknown>) => {
    const err = error instanceof Error ? error : undefined;
    log('error', message, context, data, err);
  },
};

export default logger;
