// 로그인 폼 - react-hook-form+zod 검증, POST /api/auth/login 호출, 성공 시 authStore에 토큰 저장 후 /airline 이동
/**
 * LoginForm 컴포넌트
 * - react-hook-form + zod 유효성 검사
 * - 로그인 성공 시 비밀번호 변경 여부에 따라 라우팅
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/authStore';
import { AUTH_ERRORS, ROUTES } from '@/lib/constants';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해주세요.')
    .email(AUTH_ERRORS.INVALID_EMAIL),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // 쿠키 저장 필수
        body: JSON.stringify({
          email: values.email,
          password: values.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setServerError(error.error || AUTH_ERRORS.UNKNOWN_ERROR);
        return;
      }

      const result = await response.json();

      // Zustand에 저장
      setAuth(result.user, result.accessToken);

      // 상태에 따라 라우팅
      if (result.user.status === 'suspended') {
        setServerError(AUTH_ERRORS.SUSPENDED_ACCOUNT);
        useAuthStore.getState().logout();
      } else if (result.forceChangePassword) {
        // 첫 로그인 - 비밀번호 변경 필수 (강제 모드)
        router.push(`${ROUTES.CHANGE_PASSWORD}?forced=true`);
      } else {
        // 정상 로그인 - 역할에 따라 리다이렉트
        if (result.user.role === 'admin') {
          // 관리자는 항상 관리자 대시보드로 이동
          router.push(ROUTES.ADMIN);
        } else {
          // 항공사 사용자는 항공사 대시보드로 이동
          router.push(ROUTES.AIRLINE);
        }
      }
    } catch (err: any) {
      setServerError(AUTH_ERRORS.UNKNOWN_ERROR);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Input
        id="email"
        type="email"
        label="이메일"
        placeholder="user@example.com"
        autoComplete="email"
        required
        error={errors.email?.message}
        {...register('email')}
      />

      <Input
        id="password"
        type="password"
        label="비밀번호"
        placeholder="비밀번호 입력"
        autoComplete="current-password"
        required
        error={errors.password?.message}
        {...register('password')}
      />

      {serverError && (
        <div
          role="alert"
          className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      <Button
        type="submit"
        variant="primary"
        fullWidth
        size="lg"
        isLoading={isSubmitting}
      >
        로그인
      </Button>

      <div className="text-center text-sm">
        <Link
          href={ROUTES.FORGOT_PASSWORD}
          className="text-primary hover:text-primary-dark hover:underline"
        >
          비밀번호 찾기
        </Link>
      </div>
    </form>
  );
}
