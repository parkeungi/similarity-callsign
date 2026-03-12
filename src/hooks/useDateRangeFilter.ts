// 날짜 범위 필터 훅 - dateFrom·dateTo·preset(7d/30d/90d/all) 상태, onChange 콜백 반환
/**
 * 날짜 범위 필터 커스텀 훅
 * incidents와 statistics 탭에서 공통으로 사용
 */

import { useState, useCallback, useMemo } from 'react';
import { DateRangeType } from '@/types/airline';

/**
 * 날짜를 YYYY-MM-DD 형식으로 변환
 */
export function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * ISO 날짜 문자열을 input date 형식으로 변환
 */
export function toInputDate(dateString?: string | null): string {
  if (!dateString) return '';
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().split('T')[0];
}

/**
 * 날짜를 한국어 형식으로 표시
 */
export function formatDisplayDate(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 공지사항 기간 포맷팅
 */
export function formatAnnouncementPeriod(start?: string | null, end?: string | null): string {
  const format = (value?: string | null) =>
    value
      ? new Date(value).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
      : '-';

  if (!start && !end) {
    return '-';
  }

  if (!start || !end) {
    return format(start || end);
  }

  return `${format(start)} ~ ${format(end)}`;
}

/**
 * 텍스트 자르기 유틸리티
 */
export function truncateText(value?: string | null, limit = 120): string {
  if (!value) return '';
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

interface UseDateRangeFilterOptions {
  defaultRange?: DateRangeType;
}

interface UseDateRangeFilterReturn {
  startDate: string;
  endDate: string;
  activeRange: DateRangeType;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  handleStartDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleEndDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  applyQuickRange: (type: 'today' | '1w' | '2w' | '1m') => void;
  startDateObj: Date | null;
  endDateObj: Date | null;
}

/**
 * 날짜 범위 필터 훅
 */
export function useDateRangeFilter(
  options: UseDateRangeFilterOptions = {}
): UseDateRangeFilterReturn {
  const { defaultRange = '1m' } = options;

  // 초기 날짜 계산
  const getInitialDates = useCallback(() => {
    const now = new Date();
    let start = new Date(now);
    const end = new Date(now);

    if (defaultRange === 'today') {
      // 오늘만
    } else if (defaultRange === '1w') {
      start.setDate(now.getDate() - 6);
    } else if (defaultRange === '2w') {
      start.setDate(now.getDate() - 13);
    } else if (defaultRange === '1m') {
      start.setDate(now.getDate() - 29);
    } else {
      // custom: 이번 달 1일부터
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return {
      start: formatDateInput(start),
      end: formatDateInput(end),
    };
  }, [defaultRange]);

  const initialDates = getInitialDates();

  const [startDate, setStartDate] = useState<string>(initialDates.start);
  const [endDate, setEndDate] = useState<string>(initialDates.end);
  const [activeRange, setActiveRange] = useState<DateRangeType>(defaultRange);

  const handleStartDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setStartDate(value);
      setActiveRange('custom');
      if (endDate && value && value > endDate) {
        setEndDate(value);
      }
    },
    [endDate]
  );

  const handleEndDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setEndDate(value);
      setActiveRange('custom');
      if (startDate && value && value < startDate) {
        setStartDate(value);
      }
    },
    [startDate]
  );

  const applyQuickRange = useCallback((type: 'today' | '1w' | '2w' | '1m') => {
    const now = new Date();
    let start = new Date(now);
    const end = new Date(now);

    if (type === 'today') {
      // 오늘만
    } else if (type === '1w') {
      start.setDate(now.getDate() - 6);
    } else if (type === '2w') {
      start.setDate(now.getDate() - 13);
    } else if (type === '1m') {
      start.setDate(now.getDate() - 29);
    }

    setStartDate(formatDateInput(start));
    setEndDate(formatDateInput(end));
    setActiveRange(type);
  }, []);

  const startDateObj = useMemo(
    () => (startDate ? new Date(startDate) : null),
    [startDate]
  );

  const endDateObj = useMemo(
    () => (endDate ? new Date(endDate) : null),
    [endDate]
  );

  return {
    startDate,
    endDate,
    activeRange,
    setStartDate,
    setEndDate,
    handleStartDateChange,
    handleEndDateChange,
    applyQuickRange,
    startDateObj,
    endDateObj,
  };
}
