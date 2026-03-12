// DB 관리 페이지 - 테이블 목록 조회·데이터 브라우징·JSON 내보내기/가져오기, 관리자 전용
'use client';

import { useState, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useQuery } from '@tanstack/react-query';

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

const TABLE_LABELS: Record<string, string> = {
  users: '사용자',
  airlines: '항공사',
  callsigns: '유사호출부호',
  callsign_occurrences: '발생이력',
  actions: '조치이력',
  action_history: '조치변경이력',
  action_types: '조치유형',
  announcements: '공지사항',
  announcement_views: '공지확인이력',
  file_uploads: '파일업로드',
  callsign_ai_analysis: 'AI 분석결과',
  password_history: '비밀번호이력',
  audit_logs: '감사로그',
};

export default function AdminDatabasePage() {
  const { accessToken } = useAuthStore();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [checkedTables, setCheckedTables] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

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
  const { data: tableData, isLoading: dataLoading } = useQuery<TableData>({
    queryKey: ['admin', 'database', 'table', selectedTable, page, limit],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/database/${selectedTable}?page=${page}&limit=${limit}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) throw new Error('데이터 조회 실패');
      return res.json();
    },
    enabled: !!selectedTable,
    staleTime: 10000,
  });

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
      } catch (err) {
        console.error('[DB Export]', err);
        alert('엑셀 내보내기에 실패했습니다.');
      } finally {
        setIsExporting(false);
      }
    },
    [accessToken]
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

        {/* 일괄 선택 / 내보내기 */}
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
            <p className="text-sm font-bold">왼쪽에서 테이블을 선택하세요</p>
          </div>
        ) : (
          <>
            {/* 테이블 헤더 */}
            <div className="px-6 py-3 bg-white border-b border-gray-200 flex items-center gap-4 shrink-0">
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
            </div>

            {/* 테이블 데이터 */}
            <div className="flex-1 overflow-auto">
              {dataLoading ? (
                <div className="flex items-center justify-center h-40 text-xs text-gray-400">
                  로딩 중...
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
                  «
                </button>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-2.5 py-1.5 text-[11px] font-bold border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  ‹
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
                  ›
                </button>
                <button
                  type="button"
                  disabled={page >= tableData.pagination.totalPages}
                  onClick={() => setPage(tableData.pagination.totalPages)}
                  className="px-2.5 py-1.5 text-[11px] font-bold border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                >
                  »
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
