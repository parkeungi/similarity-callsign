'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ADMIN_DASHBOARD_CARDS } from '@/lib/admin-navigation';
import { useAuthStore } from '@/store/authStore';

/**
 * /admin 페이지 - 관리자 대시보드
 *
 * 관리자 권한 체크는 admin 레이아웃에서 처리하므로
 * 이 페이지는 현재 로그인한 관리자의 정보를 표시하는 역할만 담당합니다.
 * 기본적으로 발생현황 페이지(callsign-management)로 리다이렉트합니다.
 */
export default function AdminPage() {
  const router = useRouter();

  // 관리자 페이지 진입 시 발생현황 페이지로 자동 이동
  useEffect(() => {
    router.replace('/admin/callsign-management');
  }, [router]);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  // 데이터 초기화 모달 상태
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // 데이터 초기화 API 호출
  const handleResetData = async () => {
    if (resetConfirmText !== 'RESET') {
      setResetMessage({
        type: 'error',
        text: '"RESET"을 정확히 입력해주세요.',
      });
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch('/api/admin/reset-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ confirmText: 'RESET' }),
      });

      const data = await response.json();

      if (response.ok) {
        setResetMessage({
          type: 'success',
          text: '데이터 초기화가 완료되었습니다.',
        });
        setResetConfirmText('');
        setTimeout(() => {
          setShowResetModal(false);
          setResetMessage(null);
        }, 2000);
      } else {
        setResetMessage({
          type: 'error',
          text: data.error || '데이터 초기화 중 오류가 발생했습니다.',
        });
      }
    } catch (error) {
      setResetMessage({
        type: 'error',
        text: '데이터 초기화 중 오류가 발생했습니다.',
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">관리자 대시보드</h1>
          <p className="text-gray-600">KATC 유사호출부호 경고시스템 관리</p>
        </div>

        {/* 관리 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ADMIN_DASHBOARD_CARDS.map((card) => (
            <Link
              key={card.id}
              href={card.href}
              className="bg-white rounded-lg shadow hover:shadow-lg transition p-6"
            >
              <div className="text-3xl mb-3">{card.emoji}</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">{card.title}</h2>
              <p className="text-gray-600 text-sm mb-4">{card.description}</p>
              <span className="text-blue-600 hover:text-blue-700 font-semibold">관리하기 →</span>
            </Link>
          ))}
        </div>

        {/* 빠른 통계 */}
        <div className="mt-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">시스템 정보</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-gray-600 text-sm mb-1">로그인한 관리자</p>
              <p className="text-2xl font-bold text-gray-900">{user?.email}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm mb-1">소속 항공사</p>
              <p className="text-2xl font-bold text-gray-900">{user?.airline?.code}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm mb-1">시스템 상태</p>
              <p className="text-2xl font-bold text-green-600">정상</p>
            </div>
          </div>
        </div>

        {/* 데이터 관리 */}
        <div className="mt-12 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">데이터 관리</h2>
          <p className="text-gray-600 text-sm mb-4">
            시스템의 모든 데이터를 초기화할 수 있습니다.
            <br />
            <span className="font-semibold text-red-600">
              ⚠️ users와 airlines 테이블을 제외한 모든 데이터가 삭제됩니다.
            </span>
          </p>
          <button
            onClick={() => setShowResetModal(true)}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition"
          >
            데이터 초기화
          </button>
        </div>
      </div>

      {/* 데이터 초기화 확인 모달 */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              ⚠️ 데이터 초기화 확인
            </h3>

            <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
              <p className="text-sm text-red-800 font-semibold mb-2">
                다음 데이터가 모두 삭제됩니다:
              </p>
              <ul className="text-sm text-red-700 space-y-1 ml-4">
                <li>• 유사호출부호 (callsigns)</li>
                <li>• 호출부호 발생 기록 (callsign_occurrences)</li>
                <li>• 조치사항 (actions)</li>
                <li>• 조치 이력 (action_history)</li>
                <li>• 공지사항 (announcements)</li>
                <li>• 공지사항 조회 기록 (announcement_views)</li>
                <li>• 파일 업로드 (file_uploads)</li>
                <li>• 비밀번호 이력 (password_history)</li>
              </ul>
              <p className="text-sm text-gray-700 mt-2 ml-4">
                ✓ 감사 로그 (audit_logs)는 <span className="font-semibold">보존됩니다</span> (초기화 기록 추적용)
              </p>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              정말 초기화하시겠습니까?
              <br />
              아래에 <span className="font-bold">RESET</span>을 입력하여 확인하세요.
            </p>

            <input
              type="text"
              placeholder='RESET 입력'
              value={resetConfirmText}
              onChange={(e) => {
                setResetConfirmText(e.target.value);
                setResetMessage(null);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            />

            {resetMessage && (
              <div
                className={`text-sm p-3 rounded-lg mb-4 ${
                  resetMessage.type === 'success'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {resetMessage.text}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirmText('');
                  setResetMessage(null);
                }}
                disabled={isResetting}
                className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 font-semibold rounded-lg transition disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleResetData}
                disabled={
                  isResetting || resetConfirmText !== 'RESET'
                }
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                {isResetting ? '처리 중...' : '초기화'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
