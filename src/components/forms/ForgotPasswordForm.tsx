// 비밀번호 찾기 폼 - 이메일 입력+유효성 검사, POST /api/auth/forgot-password 호출, 발송 완료 메시지 표시
/**
 * ForgotPasswordForm 컴포넌트
 * - 이메일 입력 후 리셋 링크 발송
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AUTH_ERRORS, ROUTES } from '@/lib/constants';
import { forgotPasswordAPI } from '@/lib/api/auth';

const schema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해주세요.')
    .email(AUTH_ERRORS.INVALID_EMAIL),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      await forgotPasswordAPI(values);
      setIsSuccess(true);
    } catch {
      // 열거 공격 방어: 이메일 존재 여부 노출하지 않음
      setIsSuccess(true);
    }
  }

  if (isSuccess) {
    return (
      <div className="text-center space-y-4">
        <div
          className="w-14 h-14 mx-auto rounded-full bg-green-100 flex items-center justify-center"
          aria-hidden="true"
        >
          <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-sm text-gray-600">
            이메일이 등록되어 있다면 비밀번호 재설정 링크를 발송했습니다.
          </p>
          <p className="mt-1 text-xs text-gray-500">스팸 폴더도 확인해주세요.</p>
        </div>
        <Link
          href={ROUTES.LOGIN}
          className="inline-block text-sm text-primary hover:underline font-medium"
        >
          로그인으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Input
        id="email"
        type="email"
        label="이메일"
        placeholder="가입 시 사용한 이메일"
        autoComplete="email"
        required
        error={errors.email?.message}
        hint="입력하신 이메일로 비밀번호 재설정 링크를 발송합니다."
        {...register('email')}
      />

      {serverError && (
        <div role="alert" className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
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
        재설정 링크 발송
      </Button>

      <div className="text-center">
        <Link
          href={ROUTES.LOGIN}
          className="text-sm text-gray-600 hover:text-gray-900 hover:underline"
        >
          로그인으로 돌아가기
        </Link>
      </div>
    </form>
  );
}
