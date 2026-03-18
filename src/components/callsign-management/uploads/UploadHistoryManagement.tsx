// 업로드 이력 관리 - UploadHistory 확장, 삭제/강제삭제 버튼, DELETE API 호출
'use client';

import { useState } from 'react';
import { useFileUploads, useDeleteFileUpload, useForceDeleteAllData } from '@/hooks/useFileUploads';

export function UploadHistoryManagement() {
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'processing' | 'completed' | 'failed' | ''>('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmFileName, setDeleteConfirmFileName] = useState<string>('');
  const [deleteConfirmCallsignCount, setDeleteConfirmCallsignCount] = useState(0);

  // 전체 강제삭제 상태
  const [showForceDeleteAll, setShowForceDeleteAll] = useState(false);
  const [forceDeletePassword, setForceDeletePassword] = useState<string>('');
  const [forceDeleteStep, setForceDeleteStep] = useState<'password' | 'confirm'>('password');

  // 업로드 이력 조회
  const fileUploadsQuery = useFileUploads({
    status: selectedStatus as any,
    page,
    limit,
  });

  // 삭제 mutation
  const deleteFileMutation = useDeleteFileUpload();
  const forceDeleteAllMutation = useForceDeleteAllData();

  const statusColors: Record<string, string> = {
    pending: '#f59e0b',
    processing: '#3b82f6',
    completed: '#10b981',
    failed: '#ef4444',
  };

  const statusLabels: Record<string, string> = {
    pending: '대기중',
    processing: '처리중',
    completed: '완료',
    failed: '실패',
  };

  const handleDeleteClick = (fileUpload: any) => {
    setDeleteConfirmId(fileUpload.id);
    setDeleteConfirmFileName(fileUpload.fileName);
    setDeleteConfirmCallsignCount(fileUpload.totalRows - fileUpload.failedCount);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;

    try {
      await deleteFileMutation.mutateAsync(deleteConfirmId);
      setDeleteConfirmId(null);
      setPage(1);
    } catch (error) {
      console.error('삭제 실패:', error);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmId(null);
    setDeleteConfirmFileName('');
    setDeleteConfirmCallsignCount(0);
  };

  // 전체 강제삭제 클릭
  const handleForceDeleteAllClick = () => {
    setShowForceDeleteAll(true);
    setForceDeletePassword('');
    setForceDeleteStep('password');
  };

  // 강제삭제 비밀번호 확인
  const handleForceDeletePasswordSubmit = () => {
    if (!forceDeletePassword) {
      alert('비밀번호를 입력해주세요.');
      return;
    }
    setForceDeleteStep('confirm');
  };

  // 전체 강제삭제 최종 확인
  const handleForceDeleteAllConfirm = async () => {
    try {
      await forceDeleteAllMutation.mutateAsync(forceDeletePassword);
      setShowForceDeleteAll(false);
      setForceDeletePassword('');
      setPage(1);
    } catch (error) {
      console.error('전체 강제삭제 실패:', error);
    }
  };

  // 강제삭제 취소
  const handleForceDeleteCancel = () => {
    setShowForceDeleteAll(false);
    setForceDeletePassword('');
    setForceDeleteStep('password');
  };

  return (
    <div className="space-y-6">
      {/* 필터 */}
      <div className="bg-white rounded-none shadow-sm border border-gray-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {/* 상태 필터 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상태
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as any);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체</option>
              <option value="pending">대기중</option>
              <option value="processing">처리중</option>
              <option value="completed">완료</option>
              <option value="failed">실패</option>
            </select>
          </div>

          {/* 버튼 그룹 */}
          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                setSelectedStatus('');
                setPage(1);
              }}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
            >
              초기화
            </button>
            <button
              onClick={handleForceDeleteAllClick}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
            >
              전체 데이터 삭제
            </button>
          </div>
        </div>

        {/* 결과 요약 */}
        {fileUploadsQuery.data && (
          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              전체: <span className="font-semibold">{fileUploadsQuery.data.pagination.total}</span>개
            </p>
          </div>
        )}
      </div>

      {/* 업로드 이력 테이블 */}
      <div className="bg-white rounded-none shadow-sm border border-gray-100 overflow-hidden">
        {fileUploadsQuery.isLoading ? (
          <div className="p-8 text-center text-gray-600">로딩 중...</div>
        ) : fileUploadsQuery.error ? (
          <div className="p-8 text-center text-red-600">
            {fileUploadsQuery.error instanceof Error
              ? fileUploadsQuery.error.message
              : '업로드 이력 조회 실패'}
          </div>
        ) : (fileUploadsQuery.data?.data.length ?? 0) === 0 ? (
          <div className="p-8 text-center text-gray-600">업로드 이력이 없습니다.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  파일명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  업로더
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  업로드 일시
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  총건수
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  추가
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  실패
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {fileUploadsQuery.data?.data.map((fileUpload) => (
                <tr key={fileUpload.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                    {fileUpload.fileName}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {fileUpload.uploaderEmail || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(fileUpload.uploadedAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 font-semibold">
                    {fileUpload.totalRows}
                  </td>
                  <td className="px-6 py-4 text-sm text-green-700 font-semibold">
                    {fileUpload.successCount}
                  </td>
                  <td className="px-6 py-4 text-sm text-red-700 font-semibold">
                    {fileUpload.failedCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      style={{
                        backgroundColor: statusColors[fileUpload.status],
                        color: '#ffffff',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      {statusLabels[fileUpload.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => handleDeleteClick(fileUpload)}
                      disabled={fileUpload.failedCount > 0}
                      title={
                        fileUpload.failedCount > 0
                          ? '처리 실패 항목이 있어 삭제할 수 없습니다.'
                          : '삭제'
                      }
                      className={`px-3 py-1 rounded font-medium ${
                        fileUpload.failedCount > 0
                          ? 'bg-gray-300 text-gray-600 cursor-not-allowed opacity-50'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 페이지네이션 */}
        {fileUploadsQuery.data && fileUploadsQuery.data.pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              이전
            </button>
            <span className="text-sm text-gray-600">
              {page} / {fileUploadsQuery.data.pagination.totalPages}
            </span>
            <button
              onClick={() =>
                setPage(Math.min(fileUploadsQuery.data.pagination.totalPages, page + 1))
              }
              disabled={page === fileUploadsQuery.data.pagination.totalPages}
              className="px-3 py-1 rounded bg-gray-200 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              다음
            </button>
          </div>
        )}
      </div>

      {/* 기본 삭제 확인 모달 */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">업로드 이력 삭제</h2>
            <p className="text-gray-600 mb-4">
              <strong>{deleteConfirmFileName}</strong>을(를) 삭제하시겠습니까?
            </p>
            <p className="text-sm text-orange-600 mb-4 bg-orange-50 p-3 rounded">
              ⚠️ 이 업로드를 삭제하면 연결된 <strong>{deleteConfirmCallsignCount}</strong>개의
              호출부호 데이터도 함께 삭제됩니다.
            </p>
            {deleteFileMutation.error && (
              <p className="text-sm text-red-600 mb-4 bg-red-50 p-3 rounded">
                {deleteFileMutation.error instanceof Error
                  ? deleteFileMutation.error.message
                  : '오류가 발생했습니다.'}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelDelete}
                disabled={deleteFileMutation.isPending}
                className="px-4 py-2 rounded bg-gray-300 text-gray-700 hover:bg-gray-400 font-medium disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteFileMutation.isPending}
                className={`px-4 py-2 rounded text-white font-medium ${
                  deleteFileMutation.isPending
                    ? 'bg-red-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {deleteFileMutation.isPending ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 전체 데이터 삭제: 비밀번호 입력 모달 */}
      {showForceDeleteAll && forceDeleteStep === 'password' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">전체 데이터 삭제 - 관리자 인증</h2>
            <p className="text-gray-600 mb-4">
              모든 호출부호 데이터를 삭제하려면<br />
              관리자 비밀번호를 입력하세요.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                관리자 비밀번호
              </label>
              <input
                type="password"
                value={forceDeletePassword}
                onChange={(e) => setForceDeletePassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleForceDeletePasswordSubmit();
                  }
                }}
              />
            </div>
            {forceDeleteAllMutation.error && (
              <p className="text-sm text-red-600 mb-4 bg-red-50 p-3 rounded">
                {forceDeleteAllMutation.error instanceof Error
                  ? forceDeleteAllMutation.error.message
                  : '오류가 발생했습니다.'}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleForceDeleteCancel}
                disabled={forceDeleteAllMutation.isPending}
                className="px-4 py-2 rounded bg-gray-300 text-gray-700 hover:bg-gray-400 font-medium disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleForceDeletePasswordSubmit}
                disabled={forceDeleteAllMutation.isPending || !forceDeletePassword}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 전체 데이터 삭제: 최종 확인 모달 */}
      {showForceDeleteAll && forceDeleteStep === 'confirm' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold text-red-600 mb-4">전체 데이터 삭제 확인</h2>
            <div className="mb-4 bg-red-50 p-4 rounded border border-red-200">
              <p className="text-sm text-red-700 font-semibold mb-2">모든 데이터가 삭제됩니다!</p>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• 모든 호출부호 데이터</li>
                <li>• 모든 발생 이력</li>
                <li>• 모든 조치 기록</li>
                <li>• 모든 업로드 이력</li>
              </ul>
              <p className="text-sm text-red-700 font-bold mt-3">삭제 후 복구할 수 없습니다!</p>
            </div>
            {forceDeleteAllMutation.error && (
              <p className="text-sm text-red-600 mb-4 bg-red-50 p-3 rounded">
                {forceDeleteAllMutation.error instanceof Error
                  ? forceDeleteAllMutation.error.message
                  : '오류가 발생했습니다.'}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setForceDeleteStep('password')}
                disabled={forceDeleteAllMutation.isPending}
                className="px-4 py-2 rounded bg-gray-300 text-gray-700 hover:bg-gray-400 font-medium disabled:opacity-50"
              >
                이전
              </button>
              <button
                onClick={handleForceDeleteAllConfirm}
                disabled={forceDeleteAllMutation.isPending}
                className={`px-4 py-2 rounded text-white font-medium ${
                  forceDeleteAllMutation.isPending
                    ? 'bg-red-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {forceDeleteAllMutation.isPending ? '삭제 중...' : '전체 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
