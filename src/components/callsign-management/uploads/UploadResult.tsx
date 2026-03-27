// 업로드 결과 요약 - 신규쌍·기존쌍·필터제외·실패 건수 표시, 에러 상세 목록 펼침
interface UploadResultProps {
  result: {
    success: boolean;
    total: number;
    inserted: number;
    updated: number;
    skipped?: number;
    reDetected?: number;
    failed: number;
    errors?: string[];
  };
}

export function UploadResult({ result }: UploadResultProps) {
  return (
    <div className="bg-white rounded-none shadow-sm border border-gray-100 p-8">
      <div className="flex items-center gap-3 mb-4">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50">
          <svg
            className="w-5 h-5 text-emerald-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </span>
        <h3 className="text-lg font-black text-gray-900">업로드 완료</h3>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-none border border-emerald-100">
          <span className="text-sm font-bold text-gray-700">신규 쌍</span>
          <span className="text-lg font-black text-emerald-600">{result.inserted}개</span>
        </div>
        <div className="flex justify-between items-start p-3 bg-blue-50 rounded-none border border-blue-100">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-gray-700">기존 쌍</span>
            {(result.reDetected ?? 0) > 0 && (
              <span className="text-xs text-blue-500 mt-0.5">
                이 중 조치완료 후 재검출 {result.reDetected}건
              </span>
            )}
          </div>
          <span className="text-lg font-black text-blue-600">{result.updated}개</span>
        </div>
        {(result.skipped ?? 0) > 0 && (
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-none border border-gray-200">
            <span className="text-sm font-bold text-gray-700">필터 제외</span>
            <span className="text-lg font-black text-gray-500">{result.skipped}개</span>
          </div>
        )}
        <div className="flex justify-between items-center p-3 bg-red-50 rounded-none border border-red-100">
          <span className="text-sm font-bold text-gray-700">실패</span>
          <span className="text-lg font-black text-red-600">{result.failed}개</span>
        </div>
      </div>

      {result.errors && result.errors.length > 0 && (
        <details className="mt-4 border-t border-gray-100 pt-4">
          <summary className="text-sm font-bold text-gray-700 cursor-pointer">
            오류 상세보기 ({result.errors.length}개)
          </summary>
          <div className="mt-3 space-y-2 bg-red-50 p-3 rounded-none max-h-48 overflow-y-auto">
            {result.errors.slice(0, 10).map((err, idx) => (
              <p key={idx} className="text-xs text-red-700">
                {err}
              </p>
            ))}
            {result.errors.length > 10 && (
              <p className="text-xs text-red-700 font-bold">... 외 {result.errors.length - 10}개</p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
