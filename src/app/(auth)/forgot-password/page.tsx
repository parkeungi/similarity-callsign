// 비밀번호 찾기 페이지 - 이메일 입력 → POST /api/auth/forgot-password로 임시 비밀번호 발송
import { ForgotPasswordForm } from '@/components/forms/ForgotPasswordForm';

export const metadata = {
  title: '비밀번호 찾기 | 유사호출부호 공유시스템',
};

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">비밀번호 찾기</h1>
        <p className="mt-1 text-sm text-gray-500">
          가입 이메일로 재설정 링크를 보내드립니다.
        </p>
      </div>
      <ForgotPasswordForm />
    </>
  );
}
