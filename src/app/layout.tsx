// 전역 루트 레이아웃 - HTML lang·메타데이터·Pretendard 폰트 설정, RootLayoutClient·Providers 래핑
import type { Metadata } from 'next';
import './globals.css';
import { RootLayoutClient } from '@/components/layout/RootLayoutClient';

export const metadata: Metadata = {
  title: '유사호출부호 공유시스템',
  description: '항공사 유사호출부호 공유시스템',
  icons: {
    icon: '/taegeuk.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
