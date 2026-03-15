// 루트 클라이언트 컴포넌트 - SessionProvider(세션 복구+타임아웃)·Providers(TanStack Query) 래핑
'use client';

import { Providers } from '@/components/layout/Providers';
import { SessionProvider } from '@/components/providers/SessionProvider';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';

export function RootLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Providers>
        <SessionProvider>{children}</SessionProvider>
      </Providers>
    </ErrorBoundary>
  );
}
