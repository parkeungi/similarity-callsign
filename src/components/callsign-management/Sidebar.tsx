// 발생현황 사이드바 - 탭 메뉴(발생현황·조치현황·통계·엑셀입력), activeTab 상태 관리, onTabChange 콜백
'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileUploadZone } from './uploads/FileUploadZone';
import { UploadResult } from './uploads/UploadResult';
import { UploadHistory } from './uploads/UploadHistory';
import { UploadHistoryManagement } from './uploads/UploadHistoryManagement';
import { AiAnalysisTab } from './uploads/AiAnalysisTab';
import { useFileUploads } from '@/hooks/useFileUploads';

interface UploadResultData {
  success: boolean;
  total: number;
  inserted: number;
  updated: number;
  failed: number;
  errors?: string[];
}

export function Sidebar() {
  const queryClient = useQueryClient();
  const [uploadResult, setUploadResult] = useState<UploadResultData | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'upload' | 'history' | 'ai'>('upload');

  // 서버에 저장된 파일 업로드 이력 조회 (완료 상태 기준, 최근 5개)
  const {
    data: fileUploads,
    refetch: refetchFileUploads,
  } = useFileUploads({ status: 'completed', page: 1, limit: 5 });

  const history = useMemo(
    () =>
      (fileUploads?.data || []).map((item) => ({
        id: item.id,
        fileName: item.fileName || item.file_name,
        uploadedAt: item.uploadedAt || item.uploaded_at,
        totalRows: item.totalRows ?? item.total_rows,
        successCount: item.successCount ?? item.success_count,
        failedCount: item.failedCount ?? item.failed_count,
      })),
    [fileUploads]
  );

  const handleUploadComplete = (result: UploadResultData) => {
    setUploadResult(result);
    // 업로드 완료 후 서버 이력 재조회
    refetchFileUploads();
    // 모든 관련 쿼리 캐시 무효화 → 발생현황·조치현황 즉시 반영
    queryClient.invalidateQueries({ queryKey: ['airline-callsigns'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['callsigns-with-actions'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['callsigns'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['callsigns-stats'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['airline-action-stats'], exact: false });
    queryClient.invalidateQueries({ queryKey: ['admin-all-occurrences-v2'], exact: false });
  };

  return (
    <div className="space-y-6">
      {/* 업로드 / 이력 관리 탭 */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveSubTab('upload')}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeSubTab === 'upload'
              ? 'text-primary border-b-2 border-primary -mb-[2px]'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📁 업로드
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeSubTab === 'history'
              ? 'text-primary border-b-2 border-primary -mb-[2px]'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          📋 이력 관리
        </button>
        <button
          onClick={() => setActiveSubTab('ai')}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeSubTab === 'ai'
              ? 'text-primary border-b-2 border-primary -mb-[2px]'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          🤖 AI 분석
        </button>
      </div>

      {/* 업로드 탭 */}
      {activeSubTab === 'upload' && (
        <div className="space-y-6">
          <FileUploadZone onUploadComplete={handleUploadComplete} />
          {uploadResult && <UploadResult result={uploadResult} />}
          <UploadHistory history={history} />
        </div>
      )}

      {/* 이력 관리 탭 */}
      {activeSubTab === 'history' && (
        <UploadHistoryManagement />
      )}

      {/* AI 분석 탭 */}
      {activeSubTab === 'ai' && (
        <AiAnalysisTab />
      )}
    </div>
  );
}
