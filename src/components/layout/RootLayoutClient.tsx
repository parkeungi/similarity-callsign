// 루트 클라이언트 컴포넌트 - SessionProvider(세션 타임아웃)·Providers(TanStack Query) 래핑
'use client';

import { Providers } from '@/components/layout/Providers';

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
