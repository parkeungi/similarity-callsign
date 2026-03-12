// 발생 데이터 포맷팅 - formatOccurrenceDate·groupByDate·getLatestOccurrence 유틸리티, 날짜/시간 표시 정규화
const DATE_REGEX = /(19|20)\d{2}-\d{2}-\d{2}/;
const TIME_REGEX = /(\d{1,2}):([0-5]\d)/;

function sanitizeDate(input?: string | null): string | null {
  if (!input) return null;
  const match = input.match(DATE_REGEX);
  return match ? match[0] : null;
}

function sanitizeTime(input?: string | null): string | null {
  if (!input) return null;
  const normalized = input.replace('T', ' ').trim();
  const timePart = normalized.includes(' ')
    ? normalized.split(' ').pop() ?? normalized
    : normalized;
  const match = timePart.match(TIME_REGEX);
  if (!match) return null;
  const hour = match[1].padStart(2, '0');
  const minute = match[2];
  return `${hour}:${minute}`;
}

export function deriveOccurrenceDate(
  occurredDate?: string | null,
  occurredTime?: string | null
): string | null {
  return sanitizeDate(occurredDate) ?? sanitizeDate(occurredTime);
}

export function deriveOccurrenceTime(occurredTime?: string | null): string {
  return sanitizeTime(occurredTime) ?? '00:00';
}

export function formatOccurrenceBadge(
  occurredDate?: string | null,
  occurredTime?: string | null
): { monthDay: string; time: string } {
  const normalizedDate = deriveOccurrenceDate(occurredDate, occurredTime);
  const monthDay = normalizedDate ? normalizedDate.slice(5) : '--';
  const time = deriveOccurrenceTime(occurredTime);
  return { monthDay, time };
}

export function buildStorageTimestamp(
  occurredDate?: string | null,
  occurredTime?: string | null
): { date: string; timestamp: string } {
  const today = new Date().toISOString().split('T')[0];
  const normalizedDate = deriveOccurrenceDate(occurredDate, occurredTime) ?? today;
  const normalizedTime = deriveOccurrenceTime(occurredTime);
  return {
    date: normalizedDate,
    timestamp: `${normalizedDate} ${normalizedTime}`,
  };
}
