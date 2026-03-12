/**
 * 인증 페이지 레이아웃
 * - 중앙 카드 형태
 * - airline.html .login-container 스타일 참고
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #0891b2 100%)',
      }}
    >
      {/* 시스템 타이틀 */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
          <span className="text-white font-bold text-xl tracking-tight">항공교통본부</span>
        </div>
        <p className="text-white/70 text-sm">유사호출부호 공유시스템</p>
      </div>

      {/* 카드 영역 */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        {children}
      </div>

      {/* 푸터 */}
      <p className="mt-6 text-white/50 text-xs text-center">
        국토교통부 항공교통본부 · 유사호출부호 안전관리 시스템
      </p>
    </div>
  );
}
