// 항공사 모달 상태 훅 - isOpen·selectedAirline·openModal·closeModal 상태 관리
'use client';

import { useState } from 'react';
import { Callsign, Action } from '@/types/action';
import { Incident } from '@/types/airline';

/**
 * 항공사 페이지의 모달 상태를 통합 관리하는 훅
 *
 * 기존 6개의 분산된 상태를 1개의 통합 상태로 관리:
 * - isActionModalOpen + selectedIncident
 * - isActionDetailModalOpen + selectedAction
 * - isCallsignDetailModalOpen + selectedCallsignForDetail
 *
 * @example
 * const { modal, openActionModal, openDetailModal, openCallsignModal, closeModal } = useAirlineModal();
 *
 * // 모달 표시 여부 확인
 * {modal.type === 'action' && <ActionModal data={modal.data as Incident} />}
 * {modal.type === 'detail' && <ActionDetailModal data={modal.data as Action} />}
 * {modal.type === 'callsign-detail' && <CallsignDetailModal data={modal.data as Callsign} />}
 */

export type ModalType = 'action' | 'detail' | 'callsign-detail' | null;

export interface AirlineModalState {
  type: ModalType;
  data: Incident | Action | Callsign | null;
}

interface UseAirlineModalReturn {
  type: ModalType;
  data: Incident | Action | Callsign | null;
  openActionModal: (incident: Incident) => void;
  openDetailModal: (action: Action) => void;
  openCallsignModal: (callsign: Callsign) => void;
  closeModal: () => void;
  isOpen: boolean;
}

export function useAirlineModal(): UseAirlineModalReturn {
  const [modal, setModal] = useState<AirlineModalState>({
    type: null,
    data: null,
  });

  const openActionModal = (incident: Incident) => {
    setModal({
      type: 'action',
      data: incident,
    });
  };

  const openDetailModal = (action: Action) => {
    setModal({
      type: 'detail',
      data: action,
    });
  };

  const openCallsignModal = (callsign: Callsign) => {
    setModal({
      type: 'callsign-detail',
      data: callsign,
    });
  };

  const closeModal = () => {
    setModal({
      type: null,
      data: null,
    });
  };

  return {
    type: modal.type,
    data: modal.data,
    openActionModal,
    openDetailModal,
    openCallsignModal,
    closeModal,
    isOpen: modal.type !== null,
  };
}
