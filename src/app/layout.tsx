import type { Metadata } from 'next';
import './globals.css';
import { RootLayoutClient } from '@/components/layout/RootLayoutClient';

export const metadata: Metadata = {
  title: 'KATC 유사호출부호 경고시스템',
  description: '항공사 유사호출부호 경고시스템',
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
