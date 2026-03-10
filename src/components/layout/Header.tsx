/**
 * Header 컴포넌트
 * - airline.html .top-bar 스타일 참고
 * - 비로그인: 로그인 버튼
 * - 로그인됨: 사용자 이메일 + 대시보드 링크
 * - 관리자: "관리자 페이지" 추가 링크
 */

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { ROUTES } from '@/lib/constants';
import { ADMIN_LINKS } from '@/lib/admin-navigation';

// 항공사별 시그니쳐 색상 (파란 배경에서 색 대비 고려)
function getAirlineTextColor(airlineCode?: string): string {
  const colorMap: Record<string, string> = {
    KAL: '#FFFFFF', // 대한항공: 흰색 (파란색 배경에서 대비 부족)
    AAR: '#FFFFFF', // 아시아나: 흰색 (파란색 배경에서 대비 부족)
    JJA: '#FF6600', // 제주항공: 주황색 (색 대비 좋음)
    JNA: '#FFD700', // 진에어: 노란색 (색 대비 좋음)
    TWB: '#E31937', // 티웨이: 빨간색 (색 대비 좋음)
    ABL: '#FFFFFF', // 에어부산: 흰색 (파란색 배경에서 대비 부족)
    ASV: '#1BC47D', // 에어서울: 초록색 (색 대비 좋음)
    EOK: '#E31937', // 이스타: 빨간색 (색 대비 좋음)
    FGW: '#FFFFFF', // 플라이강원: 흰색 (파란색 배경에서 대비 부족)
  };
  return colorMap[airlineCode || ''] || '#FFFFFF';
}

export function Header() {
  const router = useRouter();
  const { user, isAuthenticated, isAdmin, logout } = useAuthStore((s) => ({
    user: s.user,
    isAuthenticated: s.isAuthenticated(),
    isAdmin: s.isAdmin(),
    logout: s.logout,
  }));

  async function handleLogout() {
    try {
      // store의 async logout 함수 사용 (쿠키 삭제 API 호출 포함)
      await logout();
    } catch {
      // 오류 발생해도 계속 진행
    } finally {
      // 로그인 페이지로 명확하게 이동
      router.push(ROUTES.LOGIN);
      // 페이지 새로고침으로 미들웨어 재실행
      router.refresh();
    }
  }

  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-12 h-36 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #111827 0%, #1f2937 60%, #111827 100%)',
        borderBottom: '1px solid rgba(75, 85, 99, 0.5)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Accent glow line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.6) 30%, rgba(139,92,246,0.6) 60%, transparent 100%)',
        }}
      />

      {/* Radial glow left */}
      <div
        className="absolute left-0 top-0 w-96 h-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at left center, rgba(99,102,241,0.08) 0%, transparent 70%)',
        }}
      />

      {/* Illustration (Tower Only) */}
      <div className="absolute left-[300px] bottom-0 h-full flex items-end justify-start opacity-20 pointer-events-none z-0">
        <svg viewBox="0 0 200 300" className="h-full">
          <g transform="translate(50, 110)" fill="#fff" style={{ filter: 'drop-shadow(0 0 8px rgba(139,92,246,0.5))' }}>
            <rect x="40" y="100" width="30" height="160" opacity="0.3" />
            <rect x="35" y="85" width="40" height="20" rx="1" opacity="0.5" />
            <path d="M20,85 L90,85 L80,45 L30,45 Z" />
            <rect x="25" y="45" width="60" height="8" fill="rgba(139, 92, 246, 0.4)" />
            <rect x="52" y="10" width="6" height="35" />
            <circle cx="55" cy="5" r="2" />
          </g>
        </svg>
      </div>

      {/* 로고 + 시스템명 + 항공사 정보 */}
      <div className="flex items-center gap-6 z-10">

        {/* 국토교통부 항공교통본부 */}
        <div className="flex items-center gap-3 pr-6 border-r border-white/15">
          {/* 태극 SVG 심볼 */}
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* 흰색 배경 원 */}
            <circle cx="20" cy="20" r="18" fill="white"/>
            {/* 태극 - 상단(파란색) */}
            <path
              d="M20 4 A16 16 0 0 1 20 36 A8 8 0 0 0 20 20 A8 8 0 0 1 20 4Z"
              fill="#0047AB"
            />
            {/* 태극 - 하단(빨간색) */}
            <path
              d="M20 4 A16 16 0 0 0 20 36 A8 8 0 0 1 20 20 A8 8 0 0 0 20 4Z"
              fill="#CD2E3A"
            />
            {/* 중앙 작은 원 */}
            <circle cx="20" cy="12" r="3.5" fill="#0047AB"/>
            <circle cx="20" cy="28" r="3.5" fill="#CD2E3A"/>
          </svg>
          {/* 부처명 두 줄 */}
          <div className="flex flex-col">
            <span className="text-white font-black text-sm leading-tight tracking-tight">국토교통부</span>
            <span className="text-white font-black text-sm leading-tight tracking-tight">항공교통본부</span>
          </div>
        </div>

        {/* 시스템명 */}
        <Link
          href={ROUTES.HOME}
          className="flex flex-col text-white hover:opacity-90 transition-opacity"
        >
          <span className="text-white font-black text-3xl leading-tight tracking-tighter">
            유사호출부호 경고시스템
          </span>
          <div className="flex items-center gap-3 mt-1.5">
            <p className="text-violet-400 text-[10px] font-black uppercase tracking-[0.4em]">Similar Callsign Warning System</p>
          </div>
        </Link>

        {/* 항공사/기관 정보 */}
        {isAuthenticated && user && (
          <div className="flex flex-col justify-center ml-10 pl-10 border-l border-white/15">
            <span
              className="text-emerald-400 font-black text-2xl tracking-tighter"
              style={{ color: isAdmin ? '#FFFFFF' : getAirlineTextColor(user.airline?.code) }}
            >
              {isAdmin ? '항공교통본부' : (user.airline?.name_en || user.airline?.name_ko)}
            </span>
            {!isAdmin && user.airline?.name_ko && (
              <span className="text-white/40 text-xs font-bold -mt-1 uppercase tracking-widest">{user.airline.name_ko}</span>
            )}
            {isAdmin && (
              <span className="text-white/40 text-xs font-bold -mt-1 uppercase tracking-widest"></span>
            )}
          </div>
        )}
      </div>

      {/* 우측 하단 영역: 간소화된 네비게이션 */}
      <nav className="absolute right-12 bottom-6 flex items-center gap-6 z-10" aria-label="사용자 네비게이션">
        {isAuthenticated && user ? (
          <>
            {/* 이메일 표시 (간소화) */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></div>
              </div>
              <span className="text-white/40 text-[10px] font-bold tracking-wide uppercase">
                {user.email}
              </span>
            </div>

            <div className="w-px h-3 bg-white/10" />

            {/* 공지사항 (모든 로그인 사용자) - 항공사 페이지에서만 숨김 */}
            {/* <Link
              href={ROUTES.ANNOUNCEMENTS}
              className="text-white/60 hover:text-white text-[11px] font-black uppercase tracking-widest transition-all"
            >
              공지사항
            </Link>

            <span className="text-white/10 text-[10px]">|</span> */}

            {/* 유사호출부호 관리 (관리자만) */}
            {isAdmin && (
              <Link
                href={ROUTES.CALLSIGN_MANAGEMENT}
                className="text-white/60 hover:text-white text-[11px] font-black uppercase tracking-widest transition-all"
              >
                유사호출부호
              </Link>
            )}

            {isAdmin && <span className="text-white/10 text-[10px]">|</span>}

            {isAdmin && (
              <Link
                href={ADMIN_LINKS.USERS_TAB}
                className="text-white/60 hover:text-white text-[11px] font-black uppercase tracking-widest transition-all"
              >
                관리자 페이지
              </Link>
            )}

            <div className="w-px h-3 bg-white/10" />

            {/* 로그아웃 (간소화) */}
            <button
              onClick={handleLogout}
              className="text-rose-400/80 hover:text-rose-400 text-[11px] font-black uppercase tracking-widest transition-all"
              type="button"
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            href={ROUTES.LOGIN}
            className="px-8 py-3 text-white text-xs font-black uppercase tracking-widest rounded-none bg-white/10 hover:bg-white/20 transition-all border border-white/20 backdrop-blur-md shadow-lg"
          >
            Login
          </Link>
        )}
      </nav>
    </header>
  );
}
