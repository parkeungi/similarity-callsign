/** Next.js 설정 - CSP·HSTS·X-Frame-Options 보안 헤더, ESLint/TypeScript 빌드 에러 무시, /dashboard→/admin/dashboard 리다이렉트/리라이트 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  eslint: {
    // 빌드 중 ESLint 검사 비활성화 (devDependencies 설치 안 될 경우 대비)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Next.js 14.2 내부 타입과 @types/react 호환성 문제로 비활성화 (Next.js 업그레이드 시 false로 전환 시도)
    ignoreBuildErrors: true,
  },
  headers: async () => {
    const isDevelopment = process.env.NODE_ENV === 'development';

    // 개발 환경: CSP 완화 (faster development), 기본 보안 헤더는 유지
    if (isDevelopment) {
      return [
        {
          source: '/:path*',
          headers: [
            {
              key: 'X-Frame-Options',
              value: 'DENY',
            },
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff',
            },
            {
              key: 'X-XSS-Protection',
              value: '1; mode=block',
            },
            {
              key: 'Referrer-Policy',
              value: 'strict-origin-when-cross-origin',
            },
            {
              key: 'Permissions-Policy',
              value: 'camera=(), microphone=(), geolocation=()',
            },
          ],
        },
      ];
    }

    // 프로덕션 환경
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; script-src-elem 'self' cdn.jsdelivr.net; style-src 'self' cdn.jsdelivr.net 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' cdn.jsdelivr.net data:; connect-src 'self' https://api-client.bkend.ai https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests;`,
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  redirects: async () => {
    return [
      {
        source: '/dashboard',
        destination: '/admin/dashboard',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
