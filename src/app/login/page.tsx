// 로그인 페이지 - LoginForm 컴포넌트 렌더링, 인증 완료 시 /airline로 리다이렉트
'use client';

import { LoginForm } from '@/components/forms/LoginForm';
import Link from 'next/link';
import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/constants';
import { NanoIcon } from '@/components/ui/NanoIcon';
import { Plane } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isAdmin } = useAuthStore((s) => ({
    isAuthenticated: s.isAuthenticated(),
    isAdmin: s.isAdmin(),
  }));

  // 이미 로그인된 경우 대시보드로 리다이렉트
  useEffect(() => {
    if (isAuthenticated) {
      const redirectTo = isAdmin ? ROUTES.ADMIN : ROUTES.AIRLINE;
      router.push(redirectTo);
    }
  }, [isAuthenticated, isAdmin, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center px-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 space-y-8">
          {/* Header */}
          <div className="space-y-4 text-center">
            {/* Logo */}
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20 backdrop-blur-md">
                <NanoIcon icon={Plane} color="info" size="lg" />
              </div>
            </div>

            {/* Title */}
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter">
                유사호출부호 공유시스템 | 항공교통본부
              </h1>
              <p className="text-cyan-400 text-xs font-black uppercase tracking-[0.3em] mt-3">
                SIMILAR CALLSIGN SHARING SYSTEM
              </p>
            </div>

            {/* Subtitle */}
            <p className="text-white/60 text-sm font-medium">
              항공교통 안전 관리 통합 시스템에 로그인하세요
            </p>
          </div>

          {/* Login Form */}
          <LoginForm />

          {/* Footer Info */}
          <div className="pt-4 border-t border-white/10 space-y-3 text-center text-xs text-white/50">
            <p>항공교통본부 관리자 또는 항공사 담당자만 이용 가능합니다</p>
            <p className="text-white/30">
              문의: <a href="tel:+82-2-2608-7100" className="text-cyan-400 hover:text-cyan-300 transition">
                +82-2-2608-7100
              </a>
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-center text-xs text-white/40 space-y-2">
          <p>🔒 본 시스템은 암호화된 연결로 보호됩니다</p>
          <p>⚠️ 개인 정보 보호를 위해 공용 컴퓨터에서의 사용을 권장하지 않습니다</p>
        </div>
      </div>
    </div>
  );
}
