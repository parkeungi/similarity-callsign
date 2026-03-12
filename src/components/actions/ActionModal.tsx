// 조치 등록/수정 모달 - callsign_id·action_type·description·manager_name·responsible_staff·planned_due_date 입력, POST/PATCH API 호출, useActionTypes로 유형 목록 로드
'use client';

import { useState, useEffect } from 'react';
import { useCreateAction, useUpdateAction, useAction } from '@/hooks/useActions';
import { useActiveActionTypes } from '@/hooks/useActionTypes';
import { Callsign } from '@/types/action';

interface ActionModalProps {
  airlineId: string;
  callsigns: Callsign[];
  selectedCallsign?: Callsign;
  actionId?: string; // 수정 모드일 때
  initialData?: {
    callsignId?: string;
    callsign_id?: string;
    callsignLabel?: string;
    callsign_pair?: string;
    actionType?: string;
    action_type?: string;
    description?: string;
    plannedDueDate?: string;
    processedDate?: string;
    processed_at?: string;
    completedDate?: string;
    completed_at?: string;
    status?: 'in_progress' | 'completed';
  };
  onClose: () => void;
  onSuccess?: () => void;
}

export function ActionModal({
  airlineId,
  callsigns,
  selectedCallsign,
  actionId,
  initialData,
  onClose,
  onSuccess,
}: ActionModalProps) {
  const [callsignId, setCallsignId] = useState(
    selectedCallsign?.id ||
    initialData?.callsignId ||
    initialData?.callsign_id ||
    ''
  );
  const [actionType, setActionType] = useState(initialData?.actionType || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [processedDate, setProcessedDate] = useState<string>(
    initialData?.processedDate ||
    initialData?.processed_at ||
    initialData?.completedDate ||
    new Date().toISOString().split('T')[0]
  );
  const [status, setStatus] = useState<'in_progress' | 'completed'>(
    initialData?.status || 'in_progress'
  );
  const [error, setError] = useState<string | null>(null);

  const createMutation = useCreateAction();
  const updateMutation = useUpdateAction();
  const actionDetailQuery = useAction(actionId);
  const { data: activeActionTypes = [] } = useActiveActionTypes();

  const isLoading = createMutation.isPending || updateMutation.isPending || actionDetailQuery.isLoading;

  // actionId가 있으면 상세 정보로 폼 초기화
  useEffect(() => {
    if (actionId && actionDetailQuery.data) {
      setActionType(actionDetailQuery.data.action_type || '');
      setDescription(actionDetailQuery.data.description || '');
      setProcessedDate(
        actionDetailQuery.data.completed_at?.split('T')[0] ||
        new Date().toISOString().split('T')[0]
      );
      setStatus(actionDetailQuery.data.status as 'in_progress' | 'completed');
    }
  }, [actionId, actionDetailQuery.data]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // 유효성 검사
    if (!callsignId) {
      setError('유사호출부호를 선택하세요.');
      return;
    }
    if (!actionType) {
      setError('조치 유형을 선택하세요.');
      return;
    }

    try {
      if (actionId) {
        // 수정 모드
        await updateMutation.mutateAsync({
          id: actionId,
          action_type: actionType,
          description: description || undefined,
          status: status,
          completed_at: processedDate,
        });
      } else {
        // 신규 등록 모드: 항상 'completed' 상태로 자동 저장
        await createMutation.mutateAsync({
          airlineId,
          callsign_id: callsignId,
          action_type: actionType,
          description: description || undefined,
          status: 'completed', // 신규 등록은 항상 완료 상태
          completed_at: processedDate,
        });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.');
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-none shadow-2xl shadow-black/50 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/50">
          <h2 className="text-lg font-bold text-slate-100">
            {actionId ? '조치 수정' : '조치 등록'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className={`text-slate-400 hover:text-slate-200 hover:bg-slate-800 p-1.5 rounded-none transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-5">
          {/* 에러 메시지 */}
          {error && (
            <div className="bg-rose-900/20 border border-rose-900/50 rounded-none p-3 text-sm text-rose-400 font-medium">
              {error}
            </div>
          )}

          <form id="action-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* 유사호출부호 */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">
                유사호출부호 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={
                  initialData?.callsign_pair ||
                  callsigns.find((cs) => String(cs.id) === callsignId)
                    ?.callsign_pair ||
                  ''
                }
                disabled
                readOnly
                className="w-full px-3.5 py-2.5 rounded-none border border-slate-700 bg-slate-800/50 text-slate-500 text-sm font-semibold cursor-not-allowed focus:outline-none"
              />
            </div>

            {/* 조치 유형 */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">
                조치 유형 <span className="text-rose-500">*</span>
              </label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                disabled={isLoading}
                className={`w-full px-3.5 py-2.5 rounded-none border border-slate-700 bg-slate-800 text-slate-100 text-sm font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <option value="">선택하세요</option>
                {activeActionTypes.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* 처리일자 */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">
                처리일자
              </label>
              <input
                type="date"
                value={processedDate}
                onChange={(e) => setProcessedDate(e.target.value)}
                disabled={isLoading}
                className={`w-full px-3.5 py-2.5 rounded-none border border-slate-700 bg-slate-800 text-slate-100 [color-scheme:dark] text-sm font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>

            {/* 상세내용 */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">
                상세내용
              </label>
              <textarea
                rows={4}
                placeholder="조치 내용을 기술하세요."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isLoading}
                className={`w-full px-3.5 py-2.5 rounded-none border border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 text-sm font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-y ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>

            {/* 상태 (수정 모드에서만 표시) */}
            {actionId && (
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">
                  상태
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'in_progress' | 'completed')}
                  disabled={isLoading}
                  className={`w-full px-3.5 py-2.5 rounded-none border border-slate-700 bg-slate-800 text-slate-100 text-sm font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <option value="in_progress">진행중</option>
                  <option value="completed">완료</option>
                </select>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-800/50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-5 py-2 bg-slate-800 border border-slate-700 rounded-none text-sm font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors shadow-sm focus:outline-none disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="submit"
            form="action-form"
            disabled={isLoading}
            className="px-5 py-2 bg-blue-600 rounded-none border border-blue-500 text-sm font-bold text-white hover:bg-blue-700 transition-colors shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-700 disabled:border-slate-600 disabled:text-slate-500"
          >
            {isLoading ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
