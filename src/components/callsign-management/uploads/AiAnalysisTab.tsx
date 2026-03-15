// AI 분석 탭 - 자동 분석(API) + 수동 분석(JSON 다운로드/임포트) 통합 UI
'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';

interface PendingPair {
  pair: string;
  count: number;
  category: 'new' | 'stale';
  previousScore: number | null;
  coexistenceMinutes: number | null;
  totalOccurrences: number;
}

interface PendingResponse {
  success: boolean;
  totalCount: number;
  newCount: number;
  staleCount: number;
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

interface ProviderConfig {
  configured: boolean;
  defaultModel: string;
}

interface AiConfig {
  providers: {
    anthropic: ProviderConfig;
    openai: ProviderConfig;
  };
}

interface AutoAnalysisResult {
  success: boolean;
  provider?: string;
  model?: string;
  tokenUsage?: { input: number; output: number };
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
  message?: string;
}

export function AiAnalysisTab() {
  const queryClient = useQueryClient();
  const [isExporting, setIsExporting] = useState(false);

  // 자동 분석 상태
  const [selectedProvider, setSelectedProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [isAutoAnalyzing, setIsAutoAnalyzing] = useState(false);
  const [autoResult, setAutoResult] = useState<AutoAnalysisResult | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // 임포트 관련 상태
  const [importJson, setImportJson] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const validateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // 언마운트 시 진행 중인 요청 및 타이머 정리
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      clearTimeout(validateTimeoutRef.current);
    };
  }, []);

  // 미분석 pair 조회
  const { data, isLoading, error } = useQuery<PendingResponse>({
    queryKey: ['admin', 'ai-analysis', 'pending'],
    queryFn: async () => {
      const res = await apiFetch('/api/admin/ai-analysis/pending');
      if (!res.ok) throw new Error('미분석 데이터 조회 실패');
      return res.json();
    },
    staleTime: 30000,
  });

  // AI Provider 설정 조회
  const { data: configData, error: configError } = useQuery<AiConfig>({
    queryKey: ['admin', 'ai-analysis', 'config'],
    queryFn: async () => {
      const res = await apiFetch('/api/admin/ai-analysis/config');
      if (!res.ok) throw new Error('설정 조회 실패');
      return res.json();
    },
    staleTime: 60000,
  });

  // 분석 중 경과시간 타이머 (완료 후에도 값 유지, 새 분석 시작 시 리셋)
  useEffect(() => {
    if (!isAutoAnalyzing) return;
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isAutoAnalyzing]);

  // Provider 기본값 설정
  useEffect(() => {
    if (configData) {
      if (configData.providers.anthropic.configured) {
        setSelectedProvider('anthropic');
      } else if (configData.providers.openai.configured) {
        setSelectedProvider('openai');
      }
    }
  }, [configData]);

  const hasAnyProvider = configData?.providers.anthropic.configured || configData?.providers.openai.configured;

  // 자동 분석 실행
  const handleAutoAnalysis = async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setElapsedTime(0);
    setIsAutoAnalyzing(true);
    setAutoResult(null);
    try {
      const res = await apiFetch('/api/admin/ai-analysis/auto', {
        method: 'POST',
        body: JSON.stringify({ provider: selectedProvider, overwrite: true }),
        signal: controller.signal,
      });
      const resData: AutoAnalysisResult = await res.json();
      setAutoResult(resData);

      if (resData.success) {
        queryClient.invalidateQueries({ queryKey: ['admin', 'ai-analysis', 'pending'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'database'] });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setAutoResult({ success: false, error: '분석이 취소되었습니다.' });
      } else {
        setAutoResult({ success: false, error: 'AI 분석 요청 실패' });
      }
    } finally {
      abortControllerRef.current = null;
      setIsAutoAnalyzing(false);
    }
  };

  // 자동 분석 취소
  const handleCancelAnalysis = () => {
    abortControllerRef.current?.abort();
  };

  // 분석요청 파일 다운로드
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await apiFetch('/api/admin/ai-analysis/export');
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
      const res = await apiFetch('/api/admin/database/import', {
        method: 'PUT',
        body: JSON.stringify({ results }),
      });

      const resData = await res.json();
      if (resData.preview) {
        setImportPreview(resData.preview);
      }
      if (resData.validationErrors && resData.validationErrors.length > 0) {
        setImportErrors(resData.validationErrors.slice(0, 10));
      }
    } catch {
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
      const res = await apiFetch('/api/admin/database/import', {
        method: 'POST',
        body: JSON.stringify({ results, overwrite }),
      });

      const resData: ImportResult = await res.json();
      setImportResult(resData);

      if (resData.success) {
        queryClient.invalidateQueries({ queryKey: ['admin', 'ai-analysis', 'pending'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'database'] });
      }
    } catch {
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
  const newCount = data?.newCount ?? 0;
  const staleCount = data?.staleCount ?? 0;
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
          <div className="flex items-center gap-2">
            {newCount > 0 && (
              <span className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-bold rounded">
                신규 {newCount}건
              </span>
            )}
            {staleCount > 0 && (
              <span className="px-3 py-1.5 bg-amber-50 text-amber-700 text-sm font-bold rounded">
                데이터변경 {staleCount}건
              </span>
            )}
            {pendingCount === 0 && (
              <span className="px-3 py-1.5 bg-green-50 text-green-700 text-sm font-bold rounded">
                분석 완료
              </span>
            )}
          </div>
        </div>

        {/* 자동 분석 섹션 */}
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 rounded-lg p-5 border border-violet-200 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-900">자동 분석 (API)</h4>
              {hasAnyProvider ? (
                <>
                  <p className="text-sm text-gray-600 mt-1">
                    AI API를 직접 호출하여 분석 결과를 자동으로 저장합니다. (약 30~120초 소요)
                  </p>
                  <div className="flex items-center gap-3 mt-3">
                    <select
                      value={selectedProvider}
                      onChange={(e) => setSelectedProvider(e.target.value as 'anthropic' | 'openai')}
                      disabled={isAutoAnalyzing}
                      className="px-3 py-2 text-sm border border-gray-200 rounded bg-white font-medium focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      {configData?.providers.anthropic.configured && (
                        <option value="anthropic">Anthropic Claude</option>
                      )}
                      {configData?.providers.openai.configured && (
                        <option value="openai">OpenAI GPT</option>
                      )}
                    </select>
                    <button
                      onClick={handleAutoAnalysis}
                      disabled={isAutoAnalyzing || pendingCount === 0}
                      className={`px-5 py-2 text-sm font-bold rounded transition-colors ${
                        isAutoAnalyzing || pendingCount === 0
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-violet-600 text-white hover:bg-violet-700'
                      }`}
                    >
                      {isAutoAnalyzing
                        ? `분석 중... (${elapsedTime}초)`
                        : `자동 분석 시작 (${pendingCount}건)`}
                    </button>
                  </div>

                  {/* 분석 진행 중 */}
                  {isAutoAnalyzing && (
                    <div className="mt-4 flex items-center gap-3 text-sm text-violet-700">
                      <div className="w-5 h-5 border-2 border-violet-300 border-t-violet-600 rounded-full animate-spin" />
                      <span>AI가 {pendingCount}건의 콜사인 쌍을 분석하고 있습니다...</span>
                      <button
                        onClick={handleCancelAnalysis}
                        className="ml-auto px-3 py-1 text-xs font-bold text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  )}

                  {/* 자동 분석 결과 */}
                  {autoResult && !isAutoAnalyzing && (
                    <div className={`mt-4 rounded-lg p-4 ${autoResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      {autoResult.success ? (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-bold text-green-800">자동 분석 완료 ({elapsedTime}초)</span>
                          </div>
                          {autoResult.summary && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-600">신규 저장:</span>
                                <span className="font-bold text-green-600">{autoResult.summary.inserted}건</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">업데이트:</span>
                                <span className="font-bold text-blue-600">{autoResult.summary.updated}건</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">스킵:</span>
                                <span className="font-bold text-gray-500">{autoResult.summary.skipped}건</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">오류:</span>
                                <span className="font-bold text-red-600">{autoResult.summary.errors}건</span>
                              </div>
                            </div>
                          )}
                          {autoResult.tokenUsage && (
                            <p className="text-xs text-gray-500 mt-2">
                              토큰: 입력 {autoResult.tokenUsage.input.toLocaleString()} / 출력 {autoResult.tokenUsage.output.toLocaleString()}
                              {autoResult.provider && autoResult.model && ` (${autoResult.provider}:${autoResult.model})`}
                            </p>
                          )}
                          {autoResult.validationErrors && autoResult.validationErrors.length > 0 && (
                            <details className="mt-2">
                              <summary className="text-xs text-amber-600 cursor-pointer hover:text-amber-700 font-medium">
                                검증 오류 {autoResult.validationErrors.length}건 보기
                              </summary>
                              <ul className="mt-1 text-xs text-amber-700 space-y-0.5 pl-3">
                                {autoResult.validationErrors.map((err, idx) => (
                                  <li key={idx}>• {err}</li>
                                ))}
                              </ul>
                            </details>
                          )}
                          {autoResult.message && (
                            <p className="text-sm text-green-700 mt-1">{autoResult.message}</p>
                          )}
                        </>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-bold text-red-800">분석 실패</span>
                          </div>
                          <p className="text-sm text-red-700">{autoResult.error}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : configError ? (
                <div className="mt-2 text-sm">
                  <p className="text-red-600 font-medium">Provider 설정 조회에 실패했습니다.</p>
                  <p className="mt-1 text-xs text-gray-400">
                    네트워크 연결을 확인하고 페이지를 새로고침해 주세요.
                  </p>
                </div>
              ) : (
                <div className="mt-2 text-sm text-gray-500">
                  <p className="text-amber-700 font-medium">API 키가 설정되지 않았습니다.</p>
                  <p className="mt-1 text-xs text-gray-400">
                    .env.local에 <code className="bg-gray-100 px-1 rounded">ANTHROPIC_API_KEY</code> 또는{' '}
                    <code className="bg-gray-100 px-1 rounded">OPENAI_API_KEY</code>를 추가하면 자동 분석을 사용할 수 있습니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 구분선 */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
              또는 수동 분석
            </span>
          </div>
        </div>

        {/* 수동 다운로드 버튼 */}
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
                  const value = e.target.value;
                  setImportJson(value);
                  clearTimeout(validateTimeoutRef.current);
                  if (value.trim()) {
                    validateTimeoutRef.current = setTimeout(() => {
                      validateJson(value);
                    }, 500);
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
        <div className="space-y-4">
          <div>
            <h5 className="text-sm font-bold text-violet-700 mb-2">자동 분석 (API 키 설정 시)</h5>
            <p className="text-sm text-gray-600">
              &quot;자동 분석 시작&quot; 버튼을 클릭하면 AI API를 호출하여 분석 결과가 자동으로 DB에 저장됩니다.
            </p>
          </div>
          <div>
            <h5 className="text-sm font-bold text-blue-700 mb-2">수동 분석</h5>
            <ol className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-3">
                <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold shrink-0 text-xs">1</span>
                <span><strong>&quot;JSON 다운로드&quot;</strong> 클릭하여 분석요청 파일 다운로드</span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold shrink-0 text-xs">2</span>
                <span>Claude, ChatGPT, Gemini 등 AI 대화창에 파일 업로드</span>
              </li>
              <li className="flex gap-3">
                <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold shrink-0 text-xs">3</span>
                <span>AI 생성 결과를 <strong>&quot;AI 분석 결과 임포트&quot;</strong>에 붙여넣기</span>
              </li>
            </ol>
          </div>
        </div>
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
                  <th className="px-3 py-2 text-left font-bold text-gray-600">구분</th>
                  <th className="px-3 py-2 text-left font-bold text-gray-600">콜사인 쌍</th>
                  <th className="px-3 py-2 text-right font-bold text-gray-600">공존시간</th>
                  <th className="px-3 py-2 text-right font-bold text-gray-600">검출건수</th>
                  <th className="px-3 py-2 text-right font-bold text-gray-600">이전 점수</th>
                </tr>
              </thead>
              <tbody>
                {pairs.slice(0, 20).map((item, idx) => (
                  <tr key={item.pair} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                    <td className="px-3 py-2">
                      {item.category === 'new' ? (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded">신규</span>
                      ) : (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded">데이터변경</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-900">{item.pair}</td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {item.coexistenceMinutes != null ? (
                        <span className={item.coexistenceMinutes >= 5 ? 'text-red-600 font-semibold' : ''}>
                          {item.coexistenceMinutes}분
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-700">{item.totalOccurrences}</td>
                    <td className="px-3 py-2 text-right">
                      {item.previousScore != null ? (
                        <span className={`font-bold ${
                          item.previousScore >= 80 ? 'text-red-600' :
                          item.previousScore >= 60 ? 'text-orange-600' :
                          item.previousScore >= 40 ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {item.previousScore}점
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
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
