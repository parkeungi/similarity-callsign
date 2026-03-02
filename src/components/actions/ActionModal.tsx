'use client';

import { useState } from 'react';
import { useCreateAction, useUpdateAction } from '@/hooks/useActions';
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

  const isLoading = createMutation.isPending || updateMutation.isPending;

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
      // manager_name: 담당자 필드는 비즈니스 요구사항에 따라 제거됨
      // (관리자가 시스템에서 자동으로 할당하도록 변경)
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
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: '720px',
          maxWidth: '95vw',
          background: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(15,23,42,0.25)',
          padding: '24px 24px 20px',
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
            {actionId ? '조치 수정' : '조치 등록'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '20px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              lineHeight: 1,
              color: '#9ca3af',
              opacity: isLoading ? 0.5 : 1,
            }}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div
            style={{
              background: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
              fontSize: '14px',
              color: '#dc2626',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* 유사호출부호 */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#4b5563',
                marginBottom: '6px',
              }}
            >
              유사호출부호 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            {/* 항상 텍스트 박스 (읽기 전용) */}
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
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '14px',
                backgroundColor: '#f3f4f6',
                color: '#4b5563',
                cursor: 'not-allowed',
              }}
            />
          </div>

          {/* 조치 유형 */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#4b5563',
                marginBottom: '6px',
              }}
            >
              조치 유형 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '14px',
                opacity: isLoading ? 0.6 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              <option value="">선택하세요</option>
              <option value="편명 변경">편명 변경</option>
              <option value="브리핑 시행">브리핑 시행</option>
              <option value="모니터링 강화">모니터링 강화</option>
              <option value="절차 개선">절차 개선</option>
              <option value="시스템 개선">시스템 개선</option>
              <option value="기타">기타</option>
            </select>
          </div>

          {/* 처리일자 */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#4b5563',
                marginBottom: '6px',
              }}
            >
              처리일자
            </label>
            <input
              type="date"
              value={processedDate}
              onChange={(e) => setProcessedDate(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '14px',
                opacity: isLoading ? 0.6 : 1,
              }}
            />
          </div>

          {/* 상세내용 */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#4b5563',
                marginBottom: '6px',
              }}
            >
              상세내용
            </label>
            <textarea
              rows={4}
              placeholder="조치 내용을 기술하세요."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                fontSize: '14px',
                resize: 'vertical',
                opacity: isLoading ? 0.6 : 1,
              }}
            />
          </div>

          {/* 상태 (수정 모드에서만 표시) */}
          {actionId && (
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#4b5563',
                  marginBottom: '6px',
                }}
              >
                상태
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'in_progress' | 'completed')}
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: '14px',
                  opacity: isLoading ? 0.6 : 1,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                }}
              >
                <option value="in_progress">진행중</option>
                <option value="completed">완료</option>
              </select>
            </div>
          )}

          {/* 버튼 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
              marginTop: '8px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                background: '#ffffff',
                fontSize: '14px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1,
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
