import { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header />
      <div className="flex flex-1">
        {children}
      </div>
    </div>
  );
}
