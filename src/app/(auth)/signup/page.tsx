import Link from 'next/link';
import { ROUTES } from '@/lib/constants';

export const metadata = {
  title: '회원가입 | 유사호출부호 공유시스템',
};

export default function SignupPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">회원가입 준비 중</h1>
        <p className="mt-1 text-sm text-gray-500">
          현재 회원가입은 준비 중입니다.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center space-y-4">
        <p className="text-sm text-gray-700">
          <strong>사용자 계정은 관리자를 통해 생성됩니다.</strong>
        </p>
        <p className="text-sm text-gray-600">
          항공사 담당자 또는 관리자에게 계정 생성을 요청해주세요.
        </p>
        <div>
          <Link
            href={ROUTES.LOGIN}
            className="inline-block px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
          >
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </>
  );
}
