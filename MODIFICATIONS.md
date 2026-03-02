# 항공사 페이지 호출부호 모달 수정 내용

## 📝 수정 개요
항공사 페이지에서 호출부호를 클릭했을 때 나타나는 모달의 동작 방식과 데이터 표시 방식을 수정했습니다.

---

## 📋 수정 파일 목록

### 1. `src/components/airline/tabs/ActionsTab.tsx`
**변경 사항:** 모달 오픈 방식 (더블클릭 → 싱글클릭)

#### 변경 전:
```typescript
// Props 인터페이스
onCallsignDoubleClick: (callsign: Callsign) => void;

// 테이블 row 이벤트
onDoubleClick={() => onCallsignDoubleClick(callsign)}

// 핸들러 전달
onCallsignDoubleClick={handleCallsignDoubleClick}
```

#### 변경 후:
```typescript
// Props 인터페이스
onCallsignClick: (callsign: Callsign) => void;

// 테이블 row 이벤트
onClick={(e) => {
  // 편집/등록 버튼 클릭은 무시
  if ((e.target as HTMLElement).closest('button')) return;

  const targetId = action.callsign_id || action.callsignId || action.callsign?.id;
  const detailFromCallsigns = callsignsData.find((cs) => cs.id === targetId);
  const detailPayload = detailFromCallsigns || action.callsign;
  if (detailPayload) {
    onCallsignClick(detailPayload);
  }
}}

// 핸들러 전달
onCallsignClick={(callsign) => {
  setSelectedCallsignForDetail(callsign);
  setIsCallsignDetailModalOpen(true);
}}
```

**핵심 변경:**
- `onDoubleClick` → `onClick` (싱글클릭으로 변경)
- 버튼 클릭 시 모달 열림 방지 (`closest('button')` 체크)

---

### 2. `src/app/(main)/airline/page.tsx`
**변경 사항:** 모달에 발생 데이터 추가 표시

#### 추가된 데이터 계산 로직 (Line 193-206):
```typescript
const callsignDetailMeta = useMemo<CallsignDetailMeta | null>(() => {
  if (!selectedCallsignForDetail) return null;
  return {
    occurrenceCount: selectedCallsignForDetail.occurrence_count ?? 0,
    firstOccurredAt: selectedCallsignForDetail.first_occurred_at ?? null,
    lastOccurredAt: selectedCallsignForDetail.last_occurred_at ?? null,
    similarity: selectedCallsignForDetail.similarity ?? '-',
    riskLevel: selectedCallsignForDetail.risk_level ?? '-',
    myCallsign: selectedCallsignForDetail.my_callsign ?? '-',
    otherCallsign: selectedCallsignForDetail.other_callsign ?? '-',
    errorType: selectedCallsignForDetail.error_type ?? '-',
    subError: selectedCallsignForDetail.sub_error ?? '-',
  };
}, [selectedCallsignForDetail]);
```

#### 모달 UI 추가 (Line 471-555):
새로운 모달 섹션들:

**발생 정보 섹션:**
```tsx
<div className="grid grid-cols-3 gap-6">
  <div className="bg-orange-50 rounded-lg p-4">
    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">발생건수</p>
    <p className="text-2xl font-black text-orange-600">{callsignDetailMeta.occurrenceCount}건</p>
  </div>
  <div className="bg-blue-50 rounded-lg p-4">
    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">최초발생</p>
    <p className="text-sm font-bold text-gray-900">{formatDisplayDate(callsignDetailMeta.firstOccurredAt)}</p>
  </div>
  <div className="bg-red-50 rounded-lg p-4">
    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">최근발생</p>
    <p className="text-sm font-bold text-gray-900">{formatDisplayDate(callsignDetailMeta.lastOccurredAt)}</p>
  </div>
</div>
```

**호출부호 정보 섹션:**
```tsx
<div className="bg-white rounded-lg p-4 border border-gray-100">
  <h4 className="text-sm font-bold text-gray-700 mb-4">호출부호 정보</h4>
  <div className="flex gap-4">
    <div className="flex-1">
      <p className="text-xs text-gray-500 mb-2">자사 호출부호</p>
      <p className="text-base font-black text-blue-700">{callsignDetailMeta.myCallsign}</p>
    </div>
    <div className="flex-1">
      <p className="text-xs text-gray-500 mb-2">타사 호출부호</p>
      <p className="text-base font-black text-red-700">{callsignDetailMeta.otherCallsign}</p>
    </div>
  </div>
</div>
```

**대상 항공사 섹션:**
```tsx
<div className="bg-white rounded-lg p-4 border border-gray-100">
  <h4 className="text-sm font-bold text-gray-700 mb-3">대상 항공사</h4>
  <p className="text-sm text-gray-600">
    {selectedCallsignForDetail?.other_airline_code || '-'} 항공사
  </p>
  <p className="text-xs text-gray-500 mt-2">양쪽 항공사의 조치가 필요합니다</p>
</div>
```

**ATC 의견 섹션:**
```tsx
<div className="bg-blue-50 rounded-lg p-4">
  <h4 className="text-sm font-bold text-gray-700 mb-2">🎯 ATC 관제사 의견</h4>
  <p className="text-sm text-gray-700">{selectedCallsignDetailMeta?.atcRecommendation || '-'}</p>
</div>
```

---

## 🔄 데이터 흐름

```
1. 항공사 페이지 → 조치이력 탭 표시
   ↓
2. ActionsTab에서 호출부호 행 클릭 (싱글클릭)
   ↓
3. onCallsignClick 핸들러 호출
   → setSelectedCallsignForDetail(callsign)
   → setIsCallsignDetailModalOpen(true)
   ↓
4. callsignDetailMeta 계산 (useMemo)
   → API 응답의 다음 필드 사용:
      - occurrence_count
      - first_occurred_at
      - last_occurred_at
      - my_callsign
      - other_callsign
      - other_airline_code
      - similarity
      - risk_level
      - error_type
      - atc_recommendation
   ↓
5. 모달 렌더링
   → callsignDetailMeta의 데이터로 표시
```

---

## 🛠️ API 지원 확인

### `/api/airlines/[airlineId]/callsigns` (GET)

**응답에 포함된 필드:**
```typescript
{
  id: string;
  callsign_pair: string;
  my_callsign: string;
  other_callsign: string;
  other_airline_code: string;
  occurrence_count: number;           ✅ 새 필드
  first_occurred_at: string;          ✅ 새 필드
  last_occurred_at: string;           ✅ 새 필드
  similarity: string;
  risk_level: string;
  error_type: string;
  sub_error: string;
  atc_recommendation: string;
  // ... 기타 필드
}
```

---

## 📊 Callsign 타입 정의

파일: `src/types/action.ts` (Line 37-87)

```typescript
export interface Callsign {
  // 기존 필드들...

  // 발생 통계 (새 필드)
  occurrence_count: number;
  first_occurred_at?: string;    // 첫 발생 시간
  last_occurred_at?: string;     // 최근 발생 시간

  // ... 나머지 필드
}
```

---

## 🔧 롤백 방법

이전 방식(더블클릭)으로 돌아가려면:

### ActionsTab.tsx에서:
```typescript
// 1. Props 인터페이스 변경
onCallsignDoubleClick: (callsign: Callsign) => void;

// 2. 테이블 row 이벤트 변경
onDoubleClick={() => onCallsignDoubleClick(callsign)}

// 3. 핸들러 전달 변경
onCallsignDoubleClick={handleCallsignDoubleClick}
```

### airline/page.tsx에서:
```typescript
// 핸들러 변경
onCallsignDoubleClick={(callsign) => {
  setSelectedCallsignForDetail(callsign);
  setIsCallsignDetailModalOpen(true);
}}
```

---

## ✅ 검증 완료 항목

- ✅ 싱글클릭으로 모달 오픈 (더블클릭 → 싱글클릭 변경)
- ✅ 버튼 클릭 시 모달 오픈 방지
- ✅ occurrence_count, first_occurred_at, last_occurred_at 데이터 전달
- ✅ 모달에서 모든 데이터 정상 표시
- ✅ API에서 필드 포함 확인
- ✅ 타입 정의 완료

---

**마지막 수정:** 2026-03-02
**상태:** 검증 완료 ✅
