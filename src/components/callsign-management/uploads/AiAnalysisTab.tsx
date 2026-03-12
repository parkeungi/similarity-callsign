// AI 분석 탭 - 미분석 호출부호 목록 표시, GET /api/admin/ai-analysis/pending 호출, 분석 실행/내보내기 버튼
'use client';

import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';

interface PendingPair {
  pair: string;
  count: number;
}

interface PendingResponse {
  success: boolean;
  totalCount: number;
  pairs: PendingPair[];
}

interface ImportPreview {
  total: number;
  valid: number;
  invalid: number;
  newRecords: number;
  duplicates: number;
}

interface ImportResult {
  success: boolean;
  summary?: {
    total: number;
    valid: number;
    inserted: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  validationErrors?: string[];
  error?: string;
}

export function AiAnalysisTab() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);

  // 임포트 관련 상태
  const [importJson, setImportJson] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 미분석 pair 조회
  const { data, isLoading, error } = useQuery<PendingResponse>({
    queryKey: ['admin', 'ai-analysis', 'pending'],
    queryFn: async () => {
      const res = await fetch('/api/admin/ai-analysis/pending', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('미분석 데이터 조회 실패');
      return res.json();
    },
    staleTime: 30000,
  });

  // 분석요청 파일 다운로드
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/admin/ai-analysis/export', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('다운로드 실패');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? 'ai_analysis_request.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[AI Analysis Export]', err);
      alert('분석요청 파일 다운로드에 실패했습니다.');
    } finally {
      setIsExporting(false);
    }
  };

  // 파일 선택 처리
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJson(content);
      validateJson(content);
    };
    reader.readAsText(file);
  };

  // JSON 검증 및 미리보기
  const validateJson = async (jsonStr: string) => {
    setImportPreview(null);
    setImportErrors([]);
    setImportResult(null);

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      setImportErrors(['JSON 파싱 실패: 유효한 JSON 형식이 아닙니다.']);
      return;
    }

    const results = Array.isArray(parsed) ? parsed : parsed.results;
    if (!results || !Array.isArray(results)) {
      setImportErrors(['results 배열이 필요합니다.']);
      return;
    }

    try {
      const res = await fetch('/api/admin/database/import', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ results }),
      });

      const resData = await res.json();
      if (resData.preview) {
        setImportPreview(resData.preview);
      }
      if (resData.validationErrors && resData.validationErrors.length > 0) {
        setImportErrors(resData.validationErrors.slice(0, 10));
      }
    } catch (err) {
      console.error('[Import Preview]', err);
      setImportErrors(['서버 검증 실패']);
    }
  };

  // 실제 임포트 실행
  const executeImport = async () => {
    if (!importJson) return;

    let parsed;
    try {
      parsed = JSON.parse(importJson);
    } catch {
      return;
    }

    const results = Array.isArray(parsed) ? parsed : parsed.results;
    if (!results) return;

    setIsImporting(true);
    try {
      const res = await fetch('/api/admin/database/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ results, overwrite }),
      });

      const resData: ImportResult = await res.json();
      setImportResult(resData);

      if (resData.success) {
        queryClient.invalidateQueries({ queryKey: ['admin', 'ai-analysis', 'pending'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'database'] });
      }
    } catch (err) {
      console.error('[Import Execute]', err);
      setImportResult({ success: false, error: '임포트 실패' });
    } finally {
      setIsImporting(false);
    }
  };

  // 임포트 초기화
  const resetImport = () => {
    setImportJson('');
    setImportPreview(null);
    setImportErrors([]);
    setImportResult(null);
    setOverwrite(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const pendingCount = data?.totalCount ?? 0;
  const pairs = data?.pairs ?? [];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-black text-gray-900">AI 분석 요청</h3>
            <p className="text-sm text-gray-500 mt-1">
              미분석 콜사인 쌍을 AI에게 분석 요청할 수 있습니다
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 bg-amber-50 text-amber-700 text-sm font-bold rounded">
              미분석 {pendingCount}건
            </span>
          </div>
        </div>

        {/* 다운로드 버튼 */}
        <div className="bg-gray-50 rounded-lg p-5 border border-gray-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-900">분석요청 파일 다운로드</h4>
              <p className="text-sm text-gray-600 mt-1">
                미분석 콜사인 쌍 + AI 프롬프트가 포함된 JSON 파일입니다.
                <br />
                Claude, GPT, Gemini 등 어떤 AI에 업로드해도 동일한 형식의 결과가 나옵니다.
              </p>
              <button
                onClick={handleExport}
                disabled={isExporting || pendingCount === 0}
                className={`mt-3 px-4 py-2 text-sm font-bold rounded transition-colors ${
                  isExporting || pendingCount === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isExporting ? '다운로드 중...' : `JSON 다운로드 (${pendingCount}건)`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI 결과 임포트 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-black text-gray-900">AI 분석 결과 임포트</h3>
            <p className="text-sm text-gray-500 mt-1">
              AI가 생성한 분석 결과 JSON을 업로드하여 DB에 저장합니다
            </p>
          </div>
          {(importJson || importResult) && (
            <button
              onClick={resetImport}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              초기화
            </button>
          )}
        </div>

        {!importResult ? (
          <>
            {/* 파일 업로드 영역 */}
            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-colors"
              >
                <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm font-semibold text-gray-600">
                  클릭하여 JSON 파일 선택
                </p>
              </div>
            </div>

            {/* 또는 직접 붙여넣기 */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-600 mb-2">
                또는 JSON 직접 붙여넣기
              </label>
              <textarea
                value={importJson}
                onChange={(e) => {
                  setImportJson(e.target.value);
                  if (e.target.value.trim()) {
                    validateJson(e.target.value);
                  } else {
                    setImportPreview(null);
                    setImportErrors([]);
                  }
                }}
                placeholder='{"results": [{"callsign_pair": "ESR887 | KAL887", "ai_score": 88, ...}]}'
                className="w-full h-28 px-3 py-2 text-xs font-mono border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* 미리보기 결과 */}
            {importPreview && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-bold text-green-800 mb-2">검증 완료</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-600">총 데이터:</span>
                    <span className="font-bold">{importPreview.total}건</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">유효 데이터:</span>
                    <span className="font-bold text-green-600">{importPreview.valid}건</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">신규 INSERT:</span>
                    <span className="font-bold text-blue-600">{importPreview.newRecords}건</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">중복 (이미 존재):</span>
                    <span className="font-bold text-amber-600">{importPreview.duplicates}건</span>
                  </div>
                </div>

                {importPreview.duplicates > 0 && (
                  <div className="mt-3 pt-3 border-t border-green-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={overwrite}
                        onChange={(e) => setOverwrite(e.target.checked)}
                        className="w-4 h-4 accent-green-600"
                      />
                      <span className="text-xs font-semibold text-gray-700">
                        중복 데이터 덮어쓰기 ({importPreview.duplicates}건)
                      </span>
                    </label>
                  </div>
                )}

                <button
                  onClick={executeImport}
                  disabled={isImporting || importPreview.valid === 0}
                  className={`mt-4 w-full py-2.5 text-sm font-bold text-white rounded transition-colors ${
                    isImporting || importPreview.valid === 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isImporting ? '임포트 중...' : `${overwrite ? importPreview.valid : importPreview.newRecords}건 임포트`}
                </button>
              </div>
            )}

            {/* 검증 오류 */}
            {importErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="text-sm font-bold text-red-800 mb-2">검증 오류</h4>
                <ul className="text-xs text-red-700 space-y-1">
                  {importErrors.map((err, idx) => (
                    <li key={idx}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          /* 임포트 결과 */
          <div className={`rounded-lg p-6 ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {importResult.success ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 className="text-lg font-bold text-green-800">임포트 완료!</h4>
                </div>
                {importResult.summary && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">신규 INSERT:</span>
                      <span className="font-bold text-green-600">{importResult.summary.inserted}건</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">업데이트:</span>
                      <span className="font-bold text-blue-600">{importResult.summary.updated}건</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">스킵:</span>
                      <span className="font-bold text-gray-500">{importResult.summary.skipped}건</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">오류:</span>
                      <span className="font-bold text-red-600">{importResult.summary.errors}건</span>
                    </div>
                  </div>
                )}
                <button
                  onClick={resetImport}
                  className="mt-4 w-full py-2 text-sm font-bold text-green-700 border border-green-300 rounded hover:bg-green-100 transition-colors"
                >
                  추가 임포트하기
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 className="text-lg font-bold text-red-800">임포트 실패</h4>
                </div>
                <p className="text-sm text-red-700">{importResult.error}</p>
                <button
                  onClick={resetImport}
                  className="mt-4 w-full py-2 text-sm font-bold text-red-700 border border-red-300 rounded hover:bg-red-100 transition-colors"
                >
                  다시 시도
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 사용 가이드 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h4 className="font-bold text-gray-900 mb-4">사용 방법</h4>
        <ol className="space-y-3 text-sm text-gray-700">
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold shrink-0">1</span>
            <span>위의 <strong>&quot;JSON 다운로드&quot;</strong> 버튼을 클릭하여 분석요청 파일을 다운로드합니다.</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold shrink-0">2</span>
            <span>Claude, ChatGPT, Gemini 등 AI 대화창에 파일을 업로드하거나 내용을 붙여넣습니다.</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold shrink-0">3</span>
            <span>AI가 생성한 JSON 결과를 복사하여 위의 <strong>&quot;AI 분석 결과 임포트&quot;</strong> 영역에 붙여넣습니다.</span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold shrink-0">4</span>
            <span>검증 완료 후 <strong>&quot;임포트&quot;</strong> 버튼을 클릭하면 DB에 저장됩니다.</span>
          </li>
        </ol>
        <p className="text-xs text-gray-400 mt-4">
          * 저장된 데이터는 <strong>관리자 &gt; 데이터베이스 관리 &gt; AI 분석결과</strong>에서 확인할 수 있습니다.
        </p>
      </div>

      {/* 미분석 목록 미리보기 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <h4 className="font-bold text-gray-900 mb-4">미분석 콜사인 쌍 미리보기 (상위 20건)</h4>

        {isLoading ? (
          <div className="text-sm text-gray-500">로딩 중...</div>
        ) : error ? (
          <div className="text-sm text-red-500">데이터 조회 실패</div>
        ) : pairs.length === 0 ? (
          <div className="text-sm text-green-600 font-semibold">
            모든 콜사인 쌍이 분석 완료되었습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-bold text-gray-600">#</th>
                  <th className="px-3 py-2 text-left font-bold text-gray-600">콜사인 쌍</th>
                  <th className="px-3 py-2 text-right font-bold text-gray-600">발생건수</th>
                </tr>
              </thead>
              <tbody>
                {pairs.slice(0, 20).map((item, idx) => (
                  <tr key={item.pair} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2 font-mono text-gray-900">{item.pair}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-700">{item.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pairs.length > 20 && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                외 {pairs.length - 20}건 더 있음
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
