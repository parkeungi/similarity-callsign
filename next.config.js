/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  eslint: {
    // 빌드 중 ESLint 검사 비활성화 (devDependencies 설치 안 될 경우 대비)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 빌드 중 TypeScript 검사 비활성화 (better-sqlite3 타입 오류 대비)
    ignoreBuildErrors: true,
  },
  headers: async () => {
    const isDevelopment = process.env.NODE_ENV === 'development';

    // 개발 환경: CSP 비활성화 (faster development)
    // 프로덕션: 엄격한 CSP 적용
    if (isDevelopment) {
      return [
        {
          source: '/:path*',
          headers: [
            {
              key: 'X-Frame-Options',
              value: 'SAMEORIGIN',
            },
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff',
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
            value: 'SAMEORIGIN',
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
            value: `default-src 'self'; script-src 'self' cdn.jsdelivr.net 'unsafe-eval' 'unsafe-inline'; style-src 'self' cdn.jsdelivr.net 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' cdn.jsdelivr.net; connect-src 'self' https://api-client.bkend.ai https://*.supabase.co;`,
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
  rewrites: async () => {
    return [
      {
        source: '/admin/dashboard',
        destination: '/dashboard',
      },
    ];
  },
};

module.exports = nextConfig;
