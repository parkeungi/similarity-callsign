/**
 * CreateUserModal 컴포넌트 (관리자용)
 * - 기본 비밀번호로 사용자 생성
 * - 이메일 + 항공사 선택
 */

'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/store/authStore';
import { useAirlines } from '@/hooks/useAirlines';
import { PASSWORD_REGEX, PASSWORD_RULE } from '@/lib/constants';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateUserModal({ isOpen, onClose }: CreateUserModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [airlineCode, setAirlineCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);
  const { data: airlines = [], isLoading: airlinesLoading } = useAirlines();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // 유효성 검사
    if (!email || !password || !passwordConfirm || !airlineCode) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    if (!PASSWORD_REGEX.test(password)) {
      setError('비밀번호: 8자 이상, 대문자·소문자·숫자·특수문자 모두 포함 필요');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          password,
          airlineCode,
          role: 'user',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '사용자 생성 실패');
      }

      setSuccess(true);
      setEmail('');
      setPassword('');
      setPasswordConfirm('');
      setAirlineCode('');

      // 사용자 목록 새로고침
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });

      // 3초 후 모달 닫기
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '사용자 생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 shadow-slate-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-lg font-bold text-slate-800">사용자 추가</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-full transition-colors flex-shrink-0"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <form onSubmit={handleSubmit} className="space-y-5">
            {success && (
              <div className="px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm font-medium text-emerald-800">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  사용자가 생성되었습니다!
                </div>
                <div className="text-xs text-emerald-600/80 ml-6">
                  사용자는 첫 로그인 시 비밀번호를 반드시 변경해야 합니다.
                </div>
              </div>
            )}

            {error && (
              <div className="px-4 py-3 rounded-lg bg-rose-50 border border-rose-200 text-sm font-medium text-rose-800">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-bold text-slate-600 mb-1.5">
                이메일 <span className="text-rose-500">*</span>
              </label>
              <input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                className="w-full px-3.5 py-2.5 rounded-md border border-slate-200 text-slate-800 text-sm font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-shadow"
              />
            </div>

            <div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-xs font-bold text-slate-600">
                  초기 비밀번호 <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="8자 이상, 대/소문자+숫자+특수문자"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    className="w-full pl-3.5 pr-12 py-2.5 rounded-md border border-slate-200 text-slate-800 text-sm font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-shadow"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium bg-white px-1"
                  >
                    {showPassword ? '숨기기' : '보이기'}
                  </button>
                </div>
              </div>
              <p className="text-[11px] font-medium text-slate-400 mt-1.5 ml-1">
                8자 이상, 대문자·소문자·숫자·특수문자(!@#$%^&*) 모두 포함
              </p>
            </div>

            <div>
              <label htmlFor="passwordConfirm" className="block text-xs font-bold text-slate-600 mb-1.5">
                비밀번호 확인 <span className="text-rose-500">*</span>
              </label>
              <input
                id="passwordConfirm"
                type={showPassword ? 'text' : 'password'}
                placeholder="초기 비밀번호 재입력"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                disabled={isLoading}
                required
                className="w-full px-3.5 py-2.5 rounded-md border border-slate-200 text-slate-800 text-sm font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-shadow"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="airlineCode" className="text-xs font-bold text-slate-600">
                소속 항공사 <span className="text-rose-500">*</span>
              </label>
              <select
                id="airlineCode"
                value={airlineCode}
                onChange={(e) => setAirlineCode(e.target.value)}
                disabled={isLoading || airlinesLoading}
                className="w-full px-3.5 py-2.5 rounded-md border border-slate-200 text-slate-800 text-sm font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-shadow disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed bg-white"
                required
              >
                <option value="">항공사를 선택하세요</option>
                {airlines.map((airline) => (
                  <option key={airline.code} value={airline.code}>
                    {airline.name_ko} ({airline.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3.5 text-xs text-blue-800 mt-2 flex gap-3 items-start">
              <span className="text-blue-500 mt-0.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </span>
              <div className="flex flex-col gap-1 leading-relaxed">
                <p className="font-bold text-blue-900">새 사용자 계정 안내</p>
                <ul className="text-blue-800/80 list-disc list-inside space-y-0.5">
                  <li>첫 로그인 시 <span className="font-semibold underline underline-offset-2">비밀번호를 반드시 변경</span>해야 합니다.</li>
                  <li>비밀번호 변경 전까지는 시스템의 모든 메뉴 및 서비스 접근이 불가능합니다.</li>
                </ul>
              </div>
            </div>
          </form>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-2 justify-end rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors shadow-sm focus:outline-none disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || success}
            className="px-5 py-2 bg-blue-600 rounded-lg text-sm font-bold text-white hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-70 flex items-center justify-center min-w-[80px]"
          >
            {isLoading ? (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : success ? '완료' : '생성'}
          </button>
        </div>
      </div>
    </div>
  );
}
