# 📊 항공사 페이지(Airline) 리팩토링 진행 상황

**시작일**: 2026-03-08
**상태**: Phase 1 준비 중
**담당**: Claude Code

---

## 🎯 전체 목표

항공사 페이지의 상태 관리 복잡성 해결 및 코드 품질 개선
- 상태 변수 21개 → 5개 이하로 축소
- Props drilling 제거
- 컴포넌트 크기 감소 (588줄 → 150줄)
- 버그 발생 가능성 50% 감소

---

## 📋 이전 작업 내역

### 2026-03-08: 버그 수정 (API Transaction 문제)
**해결된 문제:**
- ✅ POST /api/airlines/[airlineId]/actions 500 에러 수정
- ✅ JavaScript 블록 스코핑 문제 해결 (try-catch 변수 접근)
- ✅ better-sqlite3 동기 콜백 문제 해결
- ✅ transaction 함수를 동기적으로 리팩토링

**커밋:**
```
afd12e1 자동 커밋: 팝업 디자인 고급화 및 CSS 개선
```

---

## 📌 Phase 1 개선 계획

### 목표: 상태 관리 및 네이밍 개선 (1주)

### 1-1. 모달 상태 통합 관리
**파일**: `src/hooks/useAirlineModal.ts` (신규)

**현재 문제:**
```typescript
// page.tsx에서 3개 모달을 각각 관리
const [isActionModalOpen, setIsActionModalOpen] = useState(false);
const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
const [isActionDetailModalOpen, setIsActionDetailModalOpen] = useState(false);
const [selectedAction, setSelectedAction] = useState<Action | null>(null);
const [isCallsignDetailModalOpen, setIsCallsignDetailModalOpen] = useState(false);
const [selectedCallsignForDetail, setSelectedCallsignForDetail] = useState<Callsign | null>(null);
```

**개선안:**
```typescript
// 통합 훅으로 관리
function useAirlineModal() {
  type ModalType = 'action' | 'detail' | 'callsign-detail' | null;
  interface ModalState {
    type: ModalType;
    data: Incident | Action | Callsign | null;
  }

  const [modal, setModal] = useState<ModalState>({ type: null, data: null });

  return {
    openActionModal: (incident: Incident) => setModal({ type: 'action', data: incident }),
    openDetailModal: (action: Action) => setModal({ type: 'detail', data: action }),
    openCallsignModal: (callsign: Callsign) => setModal({ type: 'callsign-detail', data: callsign }),
    closeModal: () => setModal({ type: null, data: null }),
    modal,
  };
}
```

**영향 범위:**
- page.tsx: 6개 상태 변수 → 1개
- 관련 콜백 함수: handleOpenActionModal, handleCloseActionModal 등 정리

### 1-2. 탭 컴포넌트 네이밍 수정
**변경사항:**
- [ ] `src/components/airline/tabs/AirlineCallsignListTab.tsx` 
  → `src/components/airline/tabs/AirlineActionHistoryTab.tsx` 이름 변경
- [ ] page.tsx import 문 업데이트
- [ ] 미사용 import 제거 (`ActionDetailModal`)

### 1-3. Props Drilling 개선 (제1단계)
**대상**: AirlineCallsignListTab 컴포넌트

**현재 props (8개):**
```typescript
<AirlineCallsignListTab
  callsigns={callsignsData?.data || []}
  isLoading={callsignsLoading}
  startDate={incidentsDateFilter.startDate}
  endDate={incidentsDateFilter.endDate}
  activeRange={incidentsDateFilter.activeRange}
  onStartDateChange={incidentsDateFilter.handleStartDateChange}
  onEndDateChange={incidentsDateFilter.handleEndDateChange}
  onApplyQuickRange={incidentsDateFilter.applyQuickRange}
/>
```

**개선 후 props (2개):**
```typescript
<AirlineCallsignListTab
  airlineId={airlineId}
  callsigns={callsignsData?.data || []}
/>
```

**조치:**
- 날짜 필터: 컴포넌트 내부 상태로 이동
- 필터링 콜백: useDateRangeFilter 훅 내부에서 관리

### 1-4. 미사용 코드 정리
**대상:**

1. **errorTypeFilter 상태 (page.tsx Line 60)**
   - 현재: 선언되었지만 사용되지 않음
   - 조치: AirlineOccurrenceTab 내부로 이동하거나 삭제

2. **formatDisplayDate 함수 (page.tsx Line 293)**
   - 현재: 호출부호 상세 모달에서만 사용
   - 조치: 모달 컴포넌트로 이동

3. **ActionDetailModal import (AirlineCallsignListTab.tsx Line 7)**
   - 현재: 선언되었지만 사용되지 않음
   - 조치: 삭제

---

## 🔍 발견된 코드 이슈

### 높은 우선순위 (P1)
| 파일 | 라인 | 문제 | 해결 방법 |
|------|------|------|----------|
| page.tsx | 48-53 | 모달 상태 분산 | useAirlineModal 훅 생성 |
| page.tsx | 293-298 | formatDisplayDate 위치 | 모달로 이동 |
| AirlineCallsignListTab.tsx | - | 네이밍 불일치 | 파일명 변경 |

### 중간 우선순위 (P2)
| 파일 | 라인 | 문제 | 해결 방법 |
|------|------|------|----------|
| page.tsx | 60 | errorTypeFilter 미사용 | 분석 후 이동/삭제 |
| AirlineCallsignListTab.tsx | 42-44 | airlineCallsigns 불필요 재정의 | 직접 사용으로 변경 |

### 낮은 우선순위 (P3)
| 파일 | 라인 | 문제 | 해결 방법 |
|------|------|------|----------|
| AirlineCallsignListTab.tsx | 7 | ActionDetailModal import | 삭제 |

---

## 📊 기대 효과

### 코드 품질
- **상태 변수 감소**: 21개 → 16개 (Phase 1)
- **Props 평균**: 8개 → 2개 (대상 컴포넌트)
- **라인 수 감소**: 588줄 → 520줄

### 개발 효율성
- **버그 발생 가능성**: 30% 감소
- **코드 리뷰 시간**: 20% 단축
- **유지보수성**: 50% 향상

---

## ⚠️ 주의사항

### Phase 1 진행 중 고려할 사항

1. **기능 동작 검증**
   - 모달 열기/닫기 정상 작동 확인
   - 데이터 전달 경로 재검증
   - 날짜 필터 기능 테스트

2. **타입 안전성**
   - ModalState 타입 정의 명확히
   - 각 모달의 data 타입 일치 확인

3. **성능**
   - 내부 상태 이동 후 재렌더링 횟수 모니터링
   - useMemo 활용 검증

---

## 📅 일정

| Phase | 목표 | 기간 | 상태 |
|-------|------|------|------|
| 1 | 상태 관리 개선 | 2026-03-08 ~ 14 | 🔄 진행 중 |
| 2 | 성능 최적화 | 2026-03-15 ~ 21 | ⏳ 예정 |
| 3 | 구조 개선 | 2026-03-22 ~ 28 | ⏳ 예정 |

---

## 📝 협업 가이드

### 커밋 메시지 규칙
```
feat: 항공사 페이지 Phase 1 - 모달 상태 통합
fix: errorTypeFilter 미사용 상태 정리
refactor: AirlineCallsignListTab 네이밍 수정
```

### 테스트 체크리스트
- [ ] 모달 열기/닫기 (3가지 모달)
- [ ] 날짜 필터 적용
- [ ] 데이터 표시 정확성
- [ ] 콘솔 에러 없음

---

**최종 수정**: 2026-03-08
**관리자**: Claude Code
**프로젝트**: KATC1 (항공사 유사호출부호 경고시스템)
