// 조치유형 관리 - CRUD UI(생성·수정·삭제·순서변경), useActionTypes 훅, action_types 테이블 연동
'use client';

import { useState } from 'react';
import {
  useActionTypes,
  useCreateActionType,
  useUpdateActionType,
  useDeactivateActionType,
  useReactivateActionType,
} from '@/hooks/useActionTypes';
import type { ActionType } from '@/types/settings';

export function ActionTypesManager() {
  const { data: actionTypes = [], isLoading } = useActionTypes(false);
  const createMutation = useCreateActionType();
  const updateMutation = useUpdateActionType();
  const deactivateMutation = useDeactivateActionType();
  const reactivateMutation = useReactivateActionType();

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [addError, setAddError] = useState('');

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editError, setEditError] = useState('');

  async function handleAdd() {
    setAddError('');
    if (!newName.trim()) { setAddError('이름을 입력하세요.'); return; }
    try {
      await createMutation.mutateAsync({ name: newName.trim(), description: newDescription.trim() || undefined });
      setNewName('');
      setNewDescription('');
      setIsAdding(false);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : '생성 실패');
    }
  }

  function startEdit(item: ActionType) {
    setEditId(item.id);
    setEditName(item.name);
    setEditDescription(item.description || '');
    setEditError('');
  }

  async function handleEdit() {
    if (!editId) return;
    setEditError('');
    if (!editName.trim()) { setEditError('이름을 입력하세요.'); return; }
    try {
      await updateMutation.mutateAsync({
        id: editId,
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      setEditId(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : '수정 실패');
    }
  }

  async function handleDeactivate(id: string, name: string) {
    if (!confirm(`"${name}" 조치유형을 비활성화하시겠습니까?\n기존 조치 기록은 그대로 유지됩니다.`)) return;
    try {
      await deactivateMutation.mutateAsync(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : '비활성화 실패');
    }
  }

  async function handleReactivate(id: string) {
    try {
      await reactivateMutation.mutateAsync(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : '재활성화 실패');
    }
  }

  const active = actionTypes.filter((t) => t.is_active);
  const inactive = actionTypes.filter((t) => !t.is_active);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">조치유형 관리</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            항공사가 조치 등록 시 선택할 수 있는 유형을 관리합니다.
            비활성화된 유형은 드롭다운에서 숨겨지지만 기존 데이터는 보존됩니다.
          </p>
        </div>
        {!isAdding && (
          <button
            onClick={() => { setIsAdding(true); setAddError(''); }}
            className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-bold rounded-none shadow hover:bg-navy/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            유형 추가
          </button>
        )}
      </div>

      {/* 추가 폼 */}
      {isAdding && (
        <div className="border border-blue-200 bg-blue-50/40 rounded-none p-4 space-y-3">
          <p className="text-sm font-bold text-blue-700">새 조치유형 추가</p>
          {addError && (
            <p className="text-xs text-rose-600 font-medium">{addError}</p>
          )}
          <div className="flex gap-3">
            <input
              autoFocus
              type="text"
              placeholder="유형 이름 (필수)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setIsAdding(false); }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="설명 (선택)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setIsAdding(false); }}
              className="flex-[2] px-3 py-2 border border-gray-300 rounded-none text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setIsAdding(false); setNewName(''); setNewDescription(''); }}
              className="px-4 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-none hover:bg-gray-50"
            >
              취소
            </button>
            <button
              onClick={handleAdd}
              disabled={createMutation.isPending}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-none hover:bg-blue-700 disabled:opacity-60"
            >
              {createMutation.isPending ? '저장 중...' : '추가'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-sm text-gray-400">불러오는 중...</div>
      ) : (
        <>
          {/* 활성 목록 */}
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              활성 ({active.length})
            </p>
            <div className="border border-gray-200 rounded-none overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-2.5 font-bold text-gray-600 w-8">#</th>
                    <th className="text-left px-4 py-2.5 font-bold text-gray-600">이름</th>
                    <th className="text-left px-4 py-2.5 font-bold text-gray-600">설명</th>
                    <th className="text-right px-4 py-2.5 font-bold text-gray-600 w-32">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {active.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                        활성 조치유형이 없습니다.
                      </td>
                    </tr>
                  ) : active.map((item, idx) => (
                    <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                      {editId === item.id ? (
                        <>
                          <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                          <td className="px-4 py-2">
                            <input
                              autoFocus
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') setEditId(null); }}
                              className="w-full px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none"
                            />
                            {editError && <p className="text-xs text-rose-500 mt-0.5">{editError}</p>}
                          </td>
                          <td className="px-4 py-2">
                            <input
                              type="text"
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') setEditId(null); }}
                              className="w-full px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none"
                              placeholder="설명 (선택)"
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => setEditId(null)}
                                className="px-2 py-1 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50"
                              >
                                취소
                              </button>
                              <button
                                onClick={handleEdit}
                                disabled={updateMutation.isPending}
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-60"
                              >
                                저장
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-gray-400 font-medium">{idx + 1}</td>
                          <td className="px-4 py-3 font-semibold text-gray-800">{item.name}</td>
                          <td className="px-4 py-3 text-gray-500">{item.description || '-'}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => startEdit(item)}
                                className="px-2.5 py-1 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50"
                              >
                                수정
                              </button>
                              <button
                                onClick={() => handleDeactivate(item.id, item.name)}
                                disabled={deactivateMutation.isPending}
                                className="px-2.5 py-1 text-xs border border-rose-200 text-rose-600 rounded hover:bg-rose-50 disabled:opacity-50"
                              >
                                비활성화
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 비활성 목록 */}
          {inactive.length > 0 && (
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                비활성 ({inactive.length})
              </p>
              <div className="border border-dashed border-gray-200 rounded-none overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {inactive.map((item, idx) => (
                      <tr key={item.id} className="border-b border-gray-100 last:border-0 opacity-60">
                        <td className="px-4 py-3 text-gray-400 w-8">{idx + 1}</td>
                        <td className="px-4 py-3 text-gray-500 line-through">{item.name}</td>
                        <td className="px-4 py-3 text-gray-400">{item.description || '-'}</td>
                        <td className="px-4 py-3 text-right w-32">
                          <button
                            onClick={() => handleReactivate(item.id)}
                            disabled={reactivateMutation.isPending}
                            className="px-2.5 py-1 text-xs border border-green-200 text-green-700 rounded hover:bg-green-50 disabled:opacity-50"
                          >
                            재활성화
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
