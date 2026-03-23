// 파일 업로드 드래그앤드롭 - xlsx 파일 선택/드롭, POST /api/admin/upload-callsigns 호출, 실시간 진행률 폴링
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api/client';
import { NanoIcon } from '@/components/ui/NanoIcon';
import { FileSpreadsheet, UploadCloud } from 'lucide-react';

interface FileUploadZoneProps {
  onUploadComplete: (result: any) => void;
}

interface UploadProgress {
  totalRows: number;
  successCount: number;
  failedCount: number;
  status: string;
}

export function FileUploadZone({ onUploadComplete }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 업로드 중 페이지 이탈 경고
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading) {
        e.preventDefault();
        e.returnValue = '엑셀 업로드가 진행 중입니다. 페이지를 떠나면 업로드가 중단될 수 있습니다.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isUploading]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // 진행 상황 폴링
  const startPolling = useCallback(() => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await apiFetch('/api/admin/upload-progress');
        if (res.ok) {
          const data = await res.json();
          if (data.status !== 'not_found') {
            setUploadProgress({
              totalRows: data.totalRows,
              successCount: data.successCount,
              failedCount: data.failedCount,
              status: data.status,
            });
          }
        }
      } catch {
        // 폴링 실패 무시
      }
    }, 1500);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    if (!allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
      setError('.xlsx, .xls, .csv 파일만 지원합니다.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('업로드할 파일을 선택해주세요.');
      return;
    }

    setIsUploading(true);
    setElapsedSec(0);
    setUploadProgress(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 경과 시간 타이머
    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    // 진행 상황 폴링 시작 (1.5초 후부터)
    setTimeout(() => startPolling(), 1500);

    try {
      const res = await apiFetch('/api/admin/upload-callsigns', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const errMsg = errData?.error || `업로드 실패 (${res.status})`;
        throw new Error(errMsg);
      }

      const data = await res.json();
      setUploadProgress({
        totalRows: data.total,
        successCount: data.inserted + data.updated,
        failedCount: data.failed,
        status: 'completed',
      });
      onUploadComplete(data);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('업로드가 중단되었습니다.');
      } else {
        setError(err instanceof Error ? err.message : '업로드 실패');
      }
    } finally {
      abortControllerRef.current = null;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      stopPolling();
      setIsUploading(false);
      setTimeout(() => { setUploadProgress(null); setElapsedSec(0); }, 3000);
    }
  };

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
  };

  const progressPct = uploadProgress && uploadProgress.totalRows > 0
    ? Math.min(Math.round(((uploadProgress.successCount + uploadProgress.failedCount) / uploadProgress.totalRows) * 100), 100)
    : 0;

  return (
    <div className="bg-white rounded-none shadow-sm border border-gray-100 p-8">
      <div className="flex items-center gap-3 mb-6">
        <NanoIcon icon={FileSpreadsheet} color="orange" size="sm" />
        <h3 className="text-lg font-black text-gray-900">엑셀 업로드</h3>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-none p-8 text-center transition-all cursor-pointer ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary hover:bg-primary/5'
          }`}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <div className="mb-4 flex justify-center">
          <NanoIcon icon={UploadCloud} color="primary" size="lg" />
        </div>
        <div className="text-sm font-bold text-gray-600 mb-2">
          {selectedFile ? selectedFile.name : '파일을 드래그하거나 클릭해서 선택'}
        </div>
        <p className="text-xs text-gray-400">
          {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : '.xlsx, .xls, .csv 파일만 지원 (최대 10MB)'}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
          className="hidden"
        />
      </div>

      <button
        onClick={handleUpload}
        disabled={!selectedFile || isUploading}
        className="w-full mt-6 px-6 py-3 bg-primary text-white font-bold rounded-none shadow-sm hover:bg-navy disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
      >
        {isUploading ? '업로드 중...' : '업로드'}
      </button>

      {/* 실시간 진행 상황 */}
      {isUploading && (
        <div className="mt-4 bg-gray-50 border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-bold text-gray-800">처리 중...</span>
            </div>
            <span className="text-xs font-mono text-gray-500">경과: {formatElapsed(elapsedSec)}</span>
          </div>

          {/* 진행률 바 */}
          <div className="w-full bg-gray-200 h-2 overflow-hidden mb-3">
            <div
              className="h-full bg-primary transition-all duration-700"
              style={{ width: uploadProgress ? `${Math.max(progressPct, 5)}%` : '5%' }}
            />
          </div>

          {/* 처리 건수 실시간 표시 */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white border border-gray-200 p-2">
              <div className="text-lg font-black text-gray-900">
                {uploadProgress ? uploadProgress.totalRows.toLocaleString() : '-'}
              </div>
              <div className="text-[10px] font-bold text-gray-500 uppercase">전체 행</div>
            </div>
            <div className="bg-white border border-blue-200 p-2">
              <div className="text-lg font-black text-blue-600">
                {uploadProgress ? uploadProgress.successCount.toLocaleString() : '-'}
              </div>
              <div className="text-[10px] font-bold text-gray-500 uppercase">처리 완료</div>
            </div>
            <div className="bg-white border border-red-200 p-2">
              <div className="text-lg font-black text-red-600">
                {uploadProgress ? uploadProgress.failedCount.toLocaleString() : '-'}
              </div>
              <div className="text-[10px] font-bold text-gray-500 uppercase">실패</div>
            </div>
          </div>

          {uploadProgress && uploadProgress.totalRows > 0 && (
            <div className="mt-2 text-right text-xs font-bold text-gray-500">
              {progressPct}% ({(uploadProgress.successCount + uploadProgress.failedCount).toLocaleString()} / {uploadProgress.totalRows.toLocaleString()})
            </div>
          )}
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="mt-4 px-4 py-3 bg-red-50 border border-red-100 rounded-none text-sm text-red-700 font-bold">
          {error}
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-gray-100">
        <h4 className="text-sm font-black text-gray-700 mb-3">Excel 형식 안내</h4>
        <ul className="text-xs text-gray-500 space-y-2 text-left">
          <li>- 국내 항공사 데이터만 자동으로 필터링됩니다.</li>
          <li>- 편명1 또는 편명2에서 국내 항공사 코드를 추출합니다.</li>
          <li>- 유사도 및 오류발생가능성 정보가 자동 매핑됩니다.</li>
          <li>- 중복된 유사호출부호 쌍은 자동 업데이트됩니다.</li>
          <li>- 유사도 높음/매우높음, 공존시간 3분 이상만 등록됩니다.</li>
          <li className="pt-2 border-t border-dashed border-gray-200">
            <strong>필수 컬럼:</strong> 편명1, 편명2 (나머지는 선택사항)
          </li>
        </ul>
      </div>
    </div>
  );
}
