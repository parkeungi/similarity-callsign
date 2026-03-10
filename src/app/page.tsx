'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Building2, ShieldCheck, Mail, Lock } from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import { useAuthStore } from '@/store/authStore';

// 고퀄리티 이미지와 태스크 중심 슬로건을 활용한 신규 레이아웃
export default function Home() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || '로그인 실패');
        setIsSubmitting(false);
        return;
      }

      const result = await response.json();

      // 전역 auth 상태 저장 (헤더/미들웨어와 일관성 유지)
      if (result.user && result.accessToken) {
        setAuth(result.user, result.accessToken);
      }

      // 역할에 따라 즉시 라우팅 (테스트 단계에서는 추가 검증 생략)
      const destination = result.user.role === 'admin' ? ROUTES.ADMIN : ROUTES.AIRLINE;
      router.push(destination);
    } catch (err) {
      setError('로그인 중 오류가 발생했습니다.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col relative overflow-hidden bg-[#030712] font-sans">
      {/* 프리미엄 배경 레이어 */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(3, 7, 18, 0.4), rgba(3, 7, 18, 0.6) 40%, rgba(3, 7, 18, 0.9) 100%),
            url('https://images.unsplash.com/photo-1542296332-2e4473faf563?q=80&w=2940&auto=format&fit=crop')
          `,
        }}
      />

      {/* 미세 그리드 오버레이 */}
      <div
        className="absolute inset-0 z-10 opacity-15 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#3b82f6 0.7px, transparent 0.7px)', backgroundSize: '40px 40px' }}
      />

      {/* 헤더 로고 */}
      <header className="absolute top-10 left-10 z-20 animate-in fade-in slide-in-from-top-4 duration-1000">
        <div>
          <h1 className="text-xl font-black tracking-tight text-white leading-none mb-1.5 uppercase flex items-center gap-2">
            <span>유사호출부호 경고시스템</span>
            <span className="text-white/40 font-medium">|</span>
            <span>항공교통본부</span>
          </h1>
          <p className="text-[10px] text-blue-400 font-bold tracking-[0.4em] leading-none uppercase">SIMILAR CALLSIGN WARNING SYSTEM</p>
        </div>
      </header>

      <main className="relative z-30 w-full flex-1 flex flex-col lg:flex-row items-center justify-between gap-16 lg:gap-32 px-10 pt-20 pb-20 lg:pb-32">

        {/* 왼쪽 메인 슬로건 영역 */}
        <div className="flex-1 text-left animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200 fill-mode-both lg:self-end">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-none bg-blue-500/10 border border-blue-400/20 mb-10">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[11px] font-black text-blue-400 uppercase tracking-widest leading-none">실시간 영공 감시 중</span>
          </div>

          <h2 className="text-5xl md:text-6xl lg:text-7xl font-black text-white leading-[1.1] tracking-tighter mb-10 text-balance">
            대한민국 하늘의 안전,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300">데이터가 연결합니다.</span>
          </h2>

          <p className="text-lg md:text-xl text-white/60 leading-relaxed font-medium mb-16 max-w-xl">
            차세대 항공 관제 및 유사호출부호 경보 시스템.<br />
            가장 정밀한 데이터 분석으로 안전한 비행 환경을 조성합니다.
          </p>

          <div className="flex gap-16 items-center">
            <div className="flex flex-col">
              <span className="text-3xl font-black text-white tracking-tighter">99.9%</span>
              <span className="text-[10px] font-bold text-white/30 tracking-[0.2em] mt-2 uppercase">Reliability</span>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-3xl font-black text-white tracking-tighter">24Hrs</span>
              <span className="text-[10px] font-bold text-white/30 tracking-[0.2em] mt-2 uppercase">Monitoring</span>
            </div>
          </div>
        </div>

        {/* 오른쪽 로그인 영역 */}
        <div className="w-full max-w-[460px] animate-in fade-in slide-in-from-right-8 duration-1000 delay-400 fill-mode-both">
          <div className="bg-slate-900/75 backdrop-blur-[28px] rounded-none p-8 md:p-10 border border-white/5 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] relative overflow-hidden">
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative z-10">
              <div className="mb-8 text-center text-white/80">
                <span className="text-[11px] font-extrabold text-blue-400 uppercase tracking-[0.5em] block mb-3">Login System</span>
                <h3 className="text-4xl font-black text-white tracking-[0.2em] uppercase">LOGIN</h3>
              </div>

              {/* 탭 스타일 */}
              <div className="flex bg-black/40 p-1 rounded-none border border-white/5 mb-8 shadow-2xl">
                <button
                  type="button"
                  onClick={() => setIsAdmin(false)}
                  className={`flex-1 py-3.5 rounded-none text-[13px] font-bold transition-all duration-300 ${!isAdmin ? 'bg-white/10 text-white border border-white/5 shadow-xl' : 'text-white/40 hover:text-white'}`}
                >
                  항공사 업무
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdmin(true)}
                  className={`flex-1 py-3.5 rounded-none text-[13px] font-bold transition-all duration-300 ${isAdmin ? 'bg-white/10 text-white border border-white/5 shadow-xl' : 'text-white/40 hover:text-white'}`}
                >
                  운영 관리자
                </button>
              </div>

              <form className="space-y-7" onSubmit={handleLogin}>
                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-white/40 tracking-[0.1em] ml-2 uppercase">Account ID</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-white/30 group-focus-within:text-blue-400 transition-colors" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@kac.or.kr"
                      className="w-full pl-14 pr-6 py-3 bg-black/40 border border-white/5 rounded-none text-white placeholder-white/20 text-[17px] font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-black/60 transition-all shadow-inner"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[11px] font-bold text-white/40 tracking-[0.1em] ml-2 uppercase">Password</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-white/30 group-focus-within:text-blue-400 transition-colors" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-14 pr-6 py-3 bg-black/40 border border-white/5 rounded-none text-white placeholder-white/20 text-[17px] tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-black/60 transition-all font-mono shadow-inner"
                      required
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-none text-xs font-bold animate-in fade-in zoom-in-95 duration-300">
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center group cursor-pointer">
                    <input type="checkbox" className="hidden peer" />
                    <div className="w-5 h-5 rounded-none border border-white/10 bg-white/5 peer-checked:bg-blue-600 peer-checked:border-blue-500 flex items-center justify-center transition-all group-hover:bg-white/10">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="ml-3 text-[13px] font-semibold text-white/40 group-hover:text-white/70 transition-colors">로그인 상태 유지</span>
                  </label>
                  <Link href={ROUTES.FORGOT_PASSWORD} className="text-[13px] font-bold text-blue-400/90 hover:text-blue-300 transition-colors">계정 찾기</Link>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-3 mt-8 rounded-none text-base font-black text-white bg-blue-600 hover:bg-blue-500 shadow-2xl shadow-blue-600/30 active:scale-[0.98] transition-all tracking-[0.3em] uppercase ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? 'LOGGING IN...' : 'LOGIN'}
                </button>
              </form>

              <div className="mt-10 pt-8 border-t border-white/5 text-center">
                <p className="text-[11px] font-black text-white/30 tracking-[0.2em] uppercase leading-loose">
                  Korea Airports Corporation <span className="text-white/10 mx-1">|</span> Aviation Services
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="relative z-20 py-5 bg-gray-800 text-gray-300 border-t border-gray-700">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap gap-6 items-center justify-center">
            <div className="text-sm font-medium text-white">
              Similar Callsign Warning System | Korea Airports Corporation
            </div>
            <div className="flex gap-5 text-sm">
              <span className="text-gray-400">Aviation Safety Division</span>
              <div>
                <span className="text-gray-400">T.</span>
                <span className="font-medium ml-1">1588-2311</span>
              </div>
              <div>
                <span className="text-gray-400">E.</span>
                <span className="font-medium ml-1">info@airport.kr</span>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-600 mt-3 pt-3 text-xs text-gray-400 text-center">
            © 2026 Korea Airports Corporation. All Rights Reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
