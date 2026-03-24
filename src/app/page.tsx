// 홈 페이지 - 비인증 사용자용, 로그인 폼(LoginForm) 렌더링, 인증 시 /airline로 리다이렉트
'use client';

import Link from 'next/link';
import { AppFooter } from '@/components/layout/AppFooter';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Mail, Lock } from 'lucide-react';
import { ROUTES } from '@/lib/constants';
import { useAuthStore } from '@/store/authStore';

// 고퀄리티 이미지와 태스크 중심 슬로건을 활용한 신규 레이아웃
export default function Home() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setUser = useAuthStore((s) => s.setUser);
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

      // 기본 비밀번호(1234) 사용자는 비밀번호 변경 페이지로 이동
      if (result.forceChangePassword) {
        router.push(`${ROUTES.CHANGE_PASSWORD}?forced=true`);
      } else {
        const destination = result.user.role === 'admin' ? ROUTES.ADMIN : ROUTES.AIRLINE;
        router.push(destination);
      }
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
            <span>유사호출부호 공유시스템</span>
            <span className="text-white/40 font-medium">|</span>
            <span>항공교통본부</span>
          </h1>
          <p className="text-[10px] text-blue-400 font-bold tracking-[0.4em] leading-none uppercase">SIMILAR CALLSIGN SHARING SYSTEM</p>
        </div>
      </header>

      <main className="relative z-30 w-full flex-1 flex flex-col lg:flex-row items-center justify-between gap-16 lg:gap-32 px-10 pt-20 pb-20 lg:pb-32">

        {/* 왼쪽 메인 슬로건 영역 */}
        <div className="flex-1 text-left animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200 fill-mode-both lg:self-end">


          <h2 className="text-4xl md:text-5xl lg:text-[3.5rem] font-black text-white leading-[1.1] tracking-tighter mb-8 text-balance">
            대한민국 하늘의 안전,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-300">데이터가 연결합니다.</span>
          </h2>

          <p className="text-base md:text-lg text-white/60 leading-relaxed font-medium mb-14 max-w-xl">
            차세대 항공 관제 및 유사호출부호 경보 시스템.<br />
            가장 정밀한 데이터 분석으로 안전한 비행 환경을 조성합니다.
          </p>

          <div className="flex gap-16 items-center">
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white tracking-tighter">99.9%</span>
              <span className="text-[10px] font-bold text-white/30 tracking-[0.2em] mt-2 uppercase">Reliability</span>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="flex flex-col">
              <span className="text-2xl font-black text-white tracking-tighter">24Hrs</span>
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

      <AppFooter />
    </div>
  );
}
