/**
 * 설정 관련 타입 정의
 */

export interface ActionType {
  id: string;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateActionTypeRequest {
  name: string;
  description?: string;
  display_order?: number;
}

export interface UpdateActionTypeRequest {
  name?: string;
  description?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface ActionTypeListResponse {
  data: ActionType[];
  total: number;
}
