// Tailwind CSS 설정 - src/ 하위 콘텐츠 경로, 커스텀 테마 확장, tailwindcss-animate 플러그인
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 브랜드 컬러 (airline.html CSS 변수 기반)
        primary: {
          DEFAULT: '#2563eb',
          light: '#dbeafe',
          dark: '#1d4ed8',
        },
        navy: {
          DEFAULT: '#1e3a5f',
          light: '#2a4f7e',
          dark: '#152b47',
        },
        sky: {
          DEFAULT: '#0891b2',
          light: '#ecfeff',
          dark: '#0e7490',
        },
        // 시맨틱 컬러
        danger: {
          DEFAULT: '#dc2626',
          light: '#fef2f2',
        },
        warning: {
          DEFAULT: '#f59e0b',
          light: '#fffbeb',
        },
        success: {
          DEFAULT: '#16a34a',
          light: '#f0fdf4',
        },
        info: {
          DEFAULT: '#0891b2',
          light: '#ecfeff',
        },
        // 표면 컬러
        surface: {
          DEFAULT: '#ffffff',
          alt: '#f8f9fb',
        },
      },
      fontFamily: {
        sans: [
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Segoe UI',
          'sans-serif',
        ],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
        lg: '14px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,0.06)',
        DEFAULT: '0 2px 8px rgba(0,0,0,0.08)',
        lg: '0 8px 24px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
