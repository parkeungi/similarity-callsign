// 업로드 이력 목록 - FileUpload[] 렌더링, 파일명·날짜·처리결과(성공/실패 건수) 표시, 다운로드 기능
'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api/client';

interface UploadHistoryItem {
  id: string;
  fileName: string;
  uploadedAt: string;
  totalRows: number;
  successCount: number;
  failedCount: number;
}

interface UploadHistoryProps {
  history: UploadHistoryItem[];
}

export function UploadHistory({ history }: UploadHistoryProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (item: UploadHistoryItem) => {
    try {
      setDownloadingId(item.id);
      const response = await apiFetch(`/api/admin/file-uploads/${item.id}/download`);

      if (!response.ok) {
        throw new Error('다운로드 실패');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.fileName.replace(/\.[^.]+$/, '') + '_다운로드.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      alert('다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="bg-white rounded-none shadow-sm border border-gray-100 p-8">
      <h3 className="text-lg font-black text-gray-900 mb-4">📋 업로드 이력</h3>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {history.map((item, idx) => (
          <div
            key={item.id || idx}
            className="p-4 bg-gray-50 rounded-none border border-gray-100 hover:bg-gray-100 transition-colors cursor-pointer group"
            onClick={() => handleDownload(item)}
            title="클릭하여 엑셀 다운로드"
          >
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm text-gray-900 group-hover:text-primary">
                    {item.fileName}
                  </p>
                  {downloadingId === item.id ? (
                    <span className="text-[10px] text-blue-500 animate-pulse">다운로드 중...</span>
                  ) : (
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(item.uploadedAt).toLocaleString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <span
                className={`text-[10px] font-black px-2.5 py-1 rounded-none border ${item.failedCount === 0
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    : 'bg-red-50 text-red-600 border-red-100'
                  }`}
              >
                {item.totalRows}건
              </span>
            </div>
            <div className="mt-2 flex gap-2 text-[10px] font-bold text-gray-500">
              <span className="text-emerald-600">성공: {item.successCount}</span>
              {item.failedCount > 0 && (
                <span className="text-red-600">실패: {item.failedCount}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {history.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-6">업로드 이력이 없습니다</p>
      )}
    </div>
  );
}
