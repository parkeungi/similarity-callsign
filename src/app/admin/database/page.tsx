// DB 관리 페이지 - 테이블 목록 조회·데이터 브라우징·엑셀 내보내기/가져오기·테이블 비우기, 관리자 전용
'use client';

import { useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface TableInfo {
  name: string;
  rowCount: number;
}

interface TableData {
  data: Record<string, unknown>[];
  columns: string[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ImportResult {
  table: string;
  inserted: number;
  skipped: number;
  error?: string;
}

const TABLE_LABELS: Record<string, string> = {
  users: '사용자',
  airlines: '항공사',
  callsigns: '유사호출부호',
  callsign_occurrences: '발생이력',
  callsign_uploads: '업로드매핑',
  actions: '조치이력',
  action_history: '조치변경이력',
  action_types: '조치유형',
  announcements: '공지사항',
  announcement_views: '공지확인이력',
  file_uploads: '파일업로드',
  callsign_ai_analysis: 'AI 분석결과',
  ai_analysis_jobs: 'AI 분석작업',
  password_history: '비밀번호이력',
  audit_logs: '감사로그',
};

export default function AdminDatabasePage() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [checkedTables, setCheckedTables] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[] | null>(null);
  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);

  // 테이블 목록 조회
  const { data: tablesData, isLoading: tablesLoading } = useQuery<{ data: TableInfo[] }>({
    queryKey: ['admin', 'database', 'tables'],
    queryFn: async () => {
      const res = await fetch('/api/admin/database/tables', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('테이블 목록 조회 실패');
      return res.json();
    },
    staleTime: 30000,
  });

  // 선택된 테이블 데이터 조회
  const { data: tableData, isLoading: dataLoading, error: dataError } = useQuery<TableData>({
    queryKey: ['admin', 'database', 'table', selectedTable, page, limit],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/database/${selectedTable}?page=${page}&limit=${limit}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`${res.status}: ${errBody}`);
      }
      return res.json();
    },
    enabled: !!selectedTable && !!accessToken,
    staleTime: 10000,
    retry: 1,
  });

  const refreshData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'database'] });
  }, [queryClient]);

  const handleTableClick = useCallback((name: string) => {
    setSelectedTable(name);
    setPage(1);
  }, []);

  const toggleCheck = useCallback((name: string) => {
    setCheckedTables((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    const all = tablesData?.data.map((t) => t.name) ?? [];
    if (checkedTables.size === all.length) {
      setCheckedTables(new Set());
    } else {
      setCheckedTables(new Set(all));
    }
  }, [tablesData, checkedTables]);

  const handleExport = useCallback(
    async (exportTables: string[]) => {
      if (exportTables.length === 0) return;
      setIsExporting(true);
      try {
        const res = await fetch('/api/admin/database/export', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tables: exportTables }),
        });
        if (!res.ok) throw new Error('내보내기 실패');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const disposition = res.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="([^"]+)"/);
        a.download = match?.[1] ?? 'db_backup.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        alert('엑셀 내보내기에 실패했습니다.');
      } finally {
        setIsExporting(false);
      }
    },
    [accessToken]
  );

  // 테이블 데이터 삭제
  const handleDelete = useCallback(
    async (tableName: string) => {
      const label = TABLE_LABELS[tableName] ?? tableName;
      const confirmed = window.confirm(
        `"${label}" (${tableName}) 테이블의 모든 데이터를 삭제하시겠습니까?\n\n` +
        `* FK 관계가 있는 하위 테이블 데이터도 함께 삭제됩니다.\n` +
        `* 이 작업은 되돌릴 수 없습니다.`
      );
      if (!confirmed) return;

      // 2차 확인
      const doubleConfirm = window.confirm(
        `정말로 "${label}" 테이블을 비우시겠습니까?\n테이블명을 다시 확인하세요: ${tableName}`
      );
      if (!doubleConfirm) return;

      setIsDeleting(true);
      try {
        const res = await fetch(`/api/admin/database/${tableName}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result = await res.json();
        if (!res.ok) {
          alert(`삭제 실패: ${result.error || '알 수 없는 오류'}`);
          return;
        }
        alert(result.message || '삭제 완료');
        refreshData();
      } catch {
        alert('삭제 요청에 실패했습니다.');
      } finally {
        setIsDeleting(false);
      }
    },
    [accessToken, refreshData]
  );

  // 엑셀 임포트
  const handleImport = useCallback(
    async (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        alert('파일 크기가 10MB를 초과합니다.');
        return;
      }
      setIsImporting(true);
      setImportResults(null);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/admin/database/import-excel', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        });
        const result = await res.json();
        if (!res.ok) {
          alert(`임포트 실패: ${result.error || '알 수 없는 오류'}`);
          return;
        }
        setImportResults(result.results);
        refreshData();
      } catch {
        alert('엑셀 임포트에 실패했습니다.');
      } finally {
        setIsImporting(false);
        if (fileInputRef1.current) fileInputRef1.current.value = '';
        if (fileInputRef2.current) fileInputRef2.current.value = '';
      }
    },
    [accessToken, refreshData]
  );

  const tables = tablesData?.data ?? [];
  const allChecked = tables.length > 0 && checkedTables.size === tables.length;

  return (
    <div className="flex h-full">
      {/* 좌측: 테이블 목록 */}
      <aside className="w-72 border-r border-gray-200 bg-white flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.25em]">
            테이블 목록
          </h2>
        </div>

        {/* 일괄 선택 / 내보내기 / 임포트 */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-600">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              className="w-3.5 h-3.5 accent-[#0f1b40]"
            />
            전체 선택
          </label>
          <div className="flex-1" />
          <button
            type="button"
            disabled={checkedTables.size === 0 || isExporting}
            onClick={() => handleExport(Array.from(checkedTables))}
            className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition-colors ${
              checkedTables.size === 0 || isExporting
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isExporting ? '처리중...' : 'EXCEL'}
          </button>
        </div>

        {tablesLoading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
            로딩 중...
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto py-2">
            {tables.map((table) => {
              const isActive = selectedTable === table.name;
              const isChecked = checkedTables.has(table.name);
              return (
                <li key={table.name}>
                  <div
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-l-4 transition-all ${
                      isActive
                        ? 'bg-[#0f1b40] text-white border-[#0f1b40]'
                        : 'text-gray-700 hover:bg-gray-50 border-transparent'
                    }`}
                    onClick={() => handleTableClick(table.name)}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleCheck(table.name)}
                      className="w-3.5 h-3.5 accent-[#0f1b40] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${isActive ? 'text-white' : ''}`}>
                        {TABLE_LABELS[table.name] ?? table.name}
                      </p>
                      <p className={`text-[10px] font-mono ${isActive ? 'text-white/60' : 'text-gray-400'}`}>
                        {table.name}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-black tabular-nums shrink-0 ${
                        isActive ? 'text-white/80' : 'text-gray-400'
                      }`}
                    >
                      {table.rowCount.toLocaleString()}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* 우측: 테이블 데이터 */}
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        {!selectedTable ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            <p className="text-sm font-bold mb-6">왼쪽에서 테이블을 선택하세요</p>

            {/* 엑셀 임포트 영역 */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center max-w-md">
              <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm font-bold text-gray-500 mb-2">엑셀 파일 임포트</p>
              <p className="text-[11px] text-gray-400 mb-4">
                백업한 XLSX 파일을 업로드하면 시트명과 동일한 테이블에 데이터가 복원됩니다.
              </p>
              <input
                ref={fileInputRef1}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImport(file);
                }}
              />
              <button
                type="button"
                disabled={isImporting}
                onClick={() => fileInputRef1.current?.click()}
                className={`px-5 py-2.5 text-[12px] font-black uppercase tracking-wide transition-colors ${
                  isImporting
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isImporting ? '임포트 중...' : 'XLSX 파일 선택'}
              </button>
            </div>

            {/* 임포트 결과 표시 */}
            {importResults && (
              <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4 max-w-md w-full">
                <h4 className="text-xs font-black text-gray-700 mb-3 uppercase tracking-wide">임포트 결과</h4>
                <div className="space-y-2">
                  {importResults.map((r) => (
                    <div key={r.table} className="flex items-center gap-2 text-xs">
                      <span className={`w-4 h-4 flex items-center justify-center rounded-full text-white text-[10px] font-bold ${
                        r.error ? 'bg-red-500' : r.inserted > 0 ? 'bg-green-500' : 'bg-gray-400'
                      }`}>
                        {r.error ? '!' : r.inserted > 0 ? 'O' : '-'}
                      </span>
                      <span className="font-bold text-gray-700 min-w-[100px]">
                        {TABLE_LABELS[r.table] ?? r.table}
                      </span>
                      {r.error ? (
                        <span className="text-red-500">{r.error}</span>
                      ) : (
                        <span className="text-gray-500">
                          {r.inserted}건 삽입 / {r.skipped}건 건너뜀
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setImportResults(null)}
                  className="mt-3 text-[11px] text-gray-400 hover:text-gray-600 font-bold"
                >
                  닫기
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* 테이블 헤더 */}
            <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-3 shrink-0">
              <div>
                <h3 className="text-sm font-black text-gray-800">
                  {TABLE_LABELS[selectedTable] ?? selectedTable}
                  <span className="ml-2 text-xs font-mono text-gray-400">{selectedTable}</span>
                </h3>
                {tableData && (
                  <p className="text-xs text-gray-400 font-semibold mt-0.5">
                    총 {tableData.pagination.total.toLocaleString()}건
                    · {tableData.pagination.page}/{tableData.pagination.totalPages} 페이지
                  </p>
                )}
              </div>
              <div className="flex-1" />

              {/* 엑셀 임포트 버튼 */}
              <input
                ref={fileInputRef2}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImport(file);
                }}
              />
              <button
                type="button"
                disabled={isImporting}
                onClick={() => fileInputRef2.current?.click()}
                className={`px-4 py-2 text-[12px] font-black uppercase tracking-wide transition-colors ${
                  isImporting
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isImporting ? '임포트중...' : 'EXCEL 임포트'}
              </button>

              {/* 엑셀 백업 버튼 */}
              <button
                type="button"
                disabled={isExporting}
                onClick={() => handleExport([selectedTable])}
                className={`px-4 py-2 text-[12px] font-black uppercase tracking-wide transition-colors ${
                  isExporting
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isExporting ? '처리중...' : 'EXCEL 백업'}
              </button>

              {/* 테이블 비우기 버튼 */}
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDelete(selectedTable)}
                className={`px-4 py-2 text-[12px] font-black uppercase tracking-wide transition-colors ${
                  isDeleting
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {isDeleting ? '삭제중...' : '테이블 비우기'}
              </button>
            </div>

            {/* 임포트 결과 배너 */}
            {importResults && (
              <div className="px-6 py-3 bg-blue-50 border-b border-blue-200 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black text-blue-700 uppercase tracking-wide">임포트 결과</h4>
                  <button
                    type="button"
                    onClick={() => setImportResults(null)}
                    className="text-[11px] text-blue-400 hover:text-blue-600 font-bold"
                  >
                    닫기
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {importResults.map((r) => (
                    <span key={r.table} className={`text-[11px] font-bold px-2 py-1 rounded ${
                      r.error ? 'bg-red-100 text-red-700' : r.inserted > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {TABLE_LABELS[r.table] ?? r.table}: {r.error || `${r.inserted}건 삽입`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 테이블 데이터 */}
            <div className="flex-1 overflow-auto">
              {dataLoading ? (
                <div className="flex items-center justify-center h-40 text-xs text-gray-400">
                  로딩 중...
                </div>
              ) : dataError ? (
                <div className="flex flex-col items-center justify-center h-40 text-xs text-red-500">
                  <p className="font-bold mb-1">데이터 조회 실패</p>
                  <p className="text-red-400">{dataError.message}</p>
                </div>
              ) : tableData && tableData.data.length > 0 ? (
                <table className="w-full text-xs border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#0f1b40] text-white">
                      {tableData.columns.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2.5 text-left font-black uppercase tracking-wide whitespace-nowrap border-r border-white/10 last:border-r-0"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.data.map((row, rowIdx) => (
                      <tr
                        key={rowIdx}
                        className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        {tableData.columns.map((col) => {
                          const val = row[col];
                          const display =
                            val === null || val === undefined
                              ? ''
                              : typeof val === 'object'
                              ? JSON.stringify(val)
                              : String(val);
                          return (
                            <td
                              key={col}
                              className="px-3 py-2 border-b border-gray-100 border-r border-gray-100 last:border-r-0 font-mono text-gray-700 max-w-[200px] truncate"
                              title={display}
                            >
                              {display || <span className="text-gray-300 italic">NULL</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex items-center justify-center h-40 text-xs text-gray-400">
                  데이터가 없습니다.
                </div>
              )}
            </div>

            {/* 페이지네이션 */}
            {tableData && tableData.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 py-3 bg-white border-t border-gray-200 shrink-0">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                  className="px-2.5 py-1.5 text-[11px] font-bold border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  &laquo;
                </button>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-2.5 py-1.5 text-[11px] font-bold border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  &lsaquo;
                </button>

                {(() => {
                  const total = tableData.pagination.totalPages;
                  const start = Math.max(1, page - 2);
                  const end = Math.min(total, start + 4);
                  return Array.from({ length: end - start + 1 }, (_, i) => start + i).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`px-2.5 py-1.5 text-[11px] font-bold border ${
                        p === page
                          ? 'bg-[#0f1b40] text-white border-[#0f1b40]'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  ));
                })()}

                <button
                  type="button"
                  disabled={page >= tableData.pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2.5 py-1.5 text-[11px] font-bold border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  &rsaquo;
                </button>
                <button
                  type="button"
                  disabled={page >= tableData.pagination.totalPages}
                  onClick={() => setPage(tableData.pagination.totalPages)}
                  className="px-2.5 py-1.5 text-[11px] font-bold border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  &raquo;
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
