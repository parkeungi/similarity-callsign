// 항공사 관리 섹션 - airlines CRUD UI, 생성·수정·삭제·display_order 변경, useAirlines 훅 사용
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  useAdminAirlines,
  useCreateAirline,
  useUpdateAirline,
  useDeleteAirline,
  Airline,
} from "@/hooks/useAirlines";

interface EditingAirline {
  id: string;
  code: string;
  name_ko: string;
  name_en: string;
  display_order: number;
}

interface NewAirlineForm {
  code: string;
  name_ko: string;
  name_en: string;
}

export function AirlinesAdminSection() {
  const [editingAirline, setEditingAirline] = useState<EditingAirline | null>(
    null,
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAirline, setNewAirline] = useState<NewAirlineForm>({
    code: "",
    name_ko: "",
    name_en: "",
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: airlines = [], isLoading } = useAdminAirlines();
  const createMutation = useCreateAirline();
  const updateMutation = useUpdateAirline();
  const deleteMutation = useDeleteAirline();

  async function handleMoveUp(airline: Airline) {
    const index = airlines.findIndex((a) => a.id === airline.id);
    if (index <= 0) return;

    const previousAirline = airlines[index - 1];
    try {
      await Promise.all([
        updateMutation.mutateAsync({
          id: airline.id,
          display_order: previousAirline.display_order,
        }),
        updateMutation.mutateAsync({
          id: previousAirline.id,
          display_order: airline.display_order,
        }),
      ]);
    } catch (err) {
      console.error("순서 변경 실패:", err);
    }
  }

  async function handleMoveDown(airline: Airline) {
    const index = airlines.findIndex((a) => a.id === airline.id);
    if (index >= airlines.length - 1) return;

    const nextAirline = airlines[index + 1];
    try {
      await Promise.all([
        updateMutation.mutateAsync({
          id: airline.id,
          display_order: nextAirline.display_order,
        }),
        updateMutation.mutateAsync({
          id: nextAirline.id,
          display_order: airline.display_order,
        }),
      ]);
    } catch (err) {
      console.error("순서 변경 실패:", err);
    }
  }

  function handleStartEdit(airline: Airline) {
    setEditingAirline({
      id: airline.id,
      code: airline.code,
      name_ko: airline.name_ko,
      name_en: airline.name_en,
      display_order: airline.display_order,
    });
  }

  function handleCancelEdit() {
    setEditingAirline(null);
  }

  async function handleSaveEdit() {
    if (!editingAirline) return;

    try {
      await updateMutation.mutateAsync({
        id: editingAirline.id,
        code: editingAirline.code,
        name_ko: editingAirline.name_ko,
        name_en: editingAirline.name_en,
        display_order: editingAirline.display_order,
      });
      setEditingAirline(null);
    } catch (err) {
      console.error("편집 실패:", err);
    }
  }

  async function handleCreateAirline() {
    if (!newAirline.code || !newAirline.name_ko) {
      alert("코드와 한글명은 필수입니다.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        code: newAirline.code,
        name_ko: newAirline.name_ko,
        name_en: newAirline.name_en,
      });
      setNewAirline({ code: "", name_ko: "", name_en: "" });
      setShowCreateForm(false);
    } catch (err) {
      console.error("생성 실패:", err);
    }
  }

  async function handleDeleteAirline(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      setDeleteConfirm(null);
    } catch (err) {
      console.error("삭제 실패:", err);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">항공사 관리</h2>
          <p className="mt-1 text-sm text-gray-500">항공사 목록 및 순서 관리</p>
        </div>
        <div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? "취소" : "+ 항공사 추가"}
          </Button>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-none border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">
            새 항공사 추가
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              id="new-code"
              type="text"
              label="코드"
              placeholder="예: KAL"
              value={newAirline.code}
              onChange={(e) =>
                setNewAirline({ ...newAirline, code: e.target.value })
              }
              disabled={createMutation.isPending}
            />
            <Input
              id="new-name-ko"
              type="text"
              label="한글명"
              placeholder="예: 대한항공"
              value={newAirline.name_ko}
              onChange={(e) =>
                setNewAirline({ ...newAirline, name_ko: e.target.value })
              }
              disabled={createMutation.isPending}
            />
            <Input
              id="new-name-en"
              type="text"
              label="영문명"
              placeholder="예: Korean Air"
              value={newAirline.name_en}
              onChange={(e) =>
                setNewAirline({ ...newAirline, name_en: e.target.value })
              }
              disabled={createMutation.isPending}
            />
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowCreateForm(false)}
              disabled={createMutation.isPending}
            >
              취소
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateAirline}
              isLoading={createMutation.isPending}
            >
              추가
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center">
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm text-gray-500">항공사 목록 로딩 중...</p>
        </div>
      ) : airlines.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-none border border-gray-200">
          <p className="text-sm text-gray-500">항공사가 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-none border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                  순서
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                  코드
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                  한글명
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide">
                  영문명
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wide">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {airlines.map((airline) => (
                <tr key={airline.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500">
                    {editingAirline?.id === airline.id ? (
                      <Input
                        id={`order-${airline.id}`}
                        type="number"
                        value={editingAirline.display_order}
                        onChange={(e) =>
                          setEditingAirline({
                            ...editingAirline,
                            display_order: Number(e.target.value) || 0,
                          })
                        }
                      />
                    ) : (
                      <div className="flex items-center gap-1 justify-between">
                        <span>{airline.display_order}</span>
                        <span className="inline-flex flex-col gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(airline)}
                            className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30"
                            disabled={updateMutation.isPending}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(airline)}
                            className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30"
                            disabled={updateMutation.isPending}
                          >
                            ▼
                          </button>
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-900">
                    {editingAirline?.id === airline.id ? (
                      <Input
                        id={`code-${airline.id}`}
                        type="text"
                        value={editingAirline.code}
                        onChange={(e) =>
                          setEditingAirline({
                            ...editingAirline,
                            code: e.target.value,
                          })
                        }
                      />
                    ) : (
                      airline.code
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {editingAirline?.id === airline.id ? (
                      <Input
                        id={`name-ko-${airline.id}`}
                        type="text"
                        value={editingAirline.name_ko}
                        onChange={(e) =>
                          setEditingAirline({
                            ...editingAirline,
                            name_ko: e.target.value,
                          })
                        }
                      />
                    ) : (
                      airline.name_ko
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {editingAirline?.id === airline.id ? (
                      <Input
                        id={`name-en-${airline.id}`}
                        type="text"
                        value={editingAirline.name_en}
                        onChange={(e) =>
                          setEditingAirline({
                            ...editingAirline,
                            name_en: e.target.value,
                          })
                        }
                      />
                    ) : (
                      airline.name_en
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      {editingAirline?.id === airline.id ? (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleCancelEdit}
                            disabled={updateMutation.isPending}
                          >
                            취소
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSaveEdit}
                            isLoading={updateMutation.isPending}
                          >
                            저장
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleStartEdit(airline)}
                            disabled={updateMutation.isPending}
                          >
                            편집
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setDeleteConfirm(airline.id)}
                            disabled={deleteMutation.isPending}
                          >
                            삭제
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white rounded-none shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">항공사 삭제</h3>
            <p className="text-sm text-gray-600">
              선택한 항공사를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteMutation.isPending}
              >
                취소
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDeleteAirline(deleteConfirm)}
                isLoading={deleteMutation.isPending}
              >
                삭제
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
