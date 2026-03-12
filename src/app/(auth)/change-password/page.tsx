// 비밀번호 변경 페이지 - 현재·새 비밀번호 입력 폼, POST /api/auth/change-password 호출
'use client';

import { useSearchParams } from 'next/navigation';
import { ChangePasswordForm } from '@/components/forms/ChangePasswordForm';

export default function ChangePasswordPage() {
  const searchParams = useSearchParams();
  const isForced = searchParams.get('forced') === 'true';

  return (
    <>
      {isForced && (
        <div className="mb-4 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
          <div className="flex gap-3">
            <div className="text-yellow-600 text-lg">⚠️</div>
            <div>
              <h3 className="font-semibold text-yellow-900">보안을 위해 비밀번호를 변경해야 합니다</h3>
              <p className="text-sm text-yellow-700 mt-1">
                처음 로그인하시거나 관리자가 비밀번호를 초기화했습니다.
                비밀번호 변경을 완료한 후 서비스에 접근할 수 있습니다.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">비밀번호 변경</h1>
        <p className="mt-1 text-sm text-gray-500">
          현재 비밀번호를 확인 후 새 비밀번호로 변경합니다.
        </p>
      </div>
      <ChangePasswordForm forced={isForced} />
    </>
  );
}
