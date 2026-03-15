// 오류유형별 고정 색상 매핑 - 모든 컴포넌트에서 동일한 색상 사용

interface ErrorTypeColorSet {
  bg: string;
  activeBg: string;
  border: string;
  activeBorder: string;
  label: string;
  value: string;
  pct: string;
  hex: string;
}

const ERROR_TYPE_COLOR_MAP: Record<string, ErrorTypeColorSet> = {
  '조종사': {
    bg: 'bg-rose-50', activeBg: 'bg-rose-100',
    border: 'border-rose-200', activeBorder: 'border-rose-400',
    label: 'text-rose-600', value: 'text-rose-700', pct: 'text-rose-500',
    hex: '#ef4444',
  },
  '관제사': {
    bg: 'bg-blue-50', activeBg: 'bg-blue-100',
    border: 'border-blue-200', activeBorder: 'border-blue-400',
    label: 'text-blue-600', value: 'text-blue-700', pct: 'text-blue-500',
    hex: '#3b82f6',
  },
  '오류미발생': {
    bg: 'bg-emerald-50', activeBg: 'bg-emerald-100',
    border: 'border-emerald-200', activeBorder: 'border-emerald-400',
    label: 'text-emerald-600', value: 'text-emerald-700', pct: 'text-emerald-500',
    hex: '#10b981',
  },
  '시스템': {
    bg: 'bg-violet-50', activeBg: 'bg-violet-100',
    border: 'border-violet-200', activeBorder: 'border-violet-400',
    label: 'text-violet-600', value: 'text-violet-700', pct: 'text-violet-500',
    hex: '#8b5cf6',
  },
};

const FALLBACK: ErrorTypeColorSet = {
  bg: 'bg-orange-50', activeBg: 'bg-orange-100',
  border: 'border-orange-200', activeBorder: 'border-orange-400',
  label: 'text-orange-600', value: 'text-orange-700', pct: 'text-orange-500',
  hex: '#f97316',
};

export function getErrorTypeColor(errorType: string): ErrorTypeColorSet {
  return ERROR_TYPE_COLOR_MAP[errorType] ?? FALLBACK;
}

// 다크 테마용 (모달 등)
interface DarkColorSet {
  bg: string;
  border: string;
  label: string;
  value: string;
}

const DARK_COLOR_MAP: Record<string, DarkColorSet> = {
  '조종사': { border: 'border-rose-900/50', bg: 'bg-rose-900/20', label: 'text-rose-300/70', value: 'text-rose-400' },
  '관제사': { border: 'border-blue-900/50', bg: 'bg-blue-900/20', label: 'text-blue-300/70', value: 'text-blue-400' },
  '오류미발생': { border: 'border-emerald-900/50', bg: 'bg-emerald-900/20', label: 'text-emerald-300/70', value: 'text-emerald-400' },
  '시스템': { border: 'border-violet-900/50', bg: 'bg-violet-900/20', label: 'text-violet-300/70', value: 'text-violet-400' },
};

const DARK_FALLBACK: DarkColorSet = {
  border: 'border-amber-900/50', bg: 'bg-amber-900/20', label: 'text-amber-300/70', value: 'text-amber-400',
};

export function getErrorTypeDarkColor(errorType: string): DarkColorSet {
  return DARK_COLOR_MAP[errorType] ?? DARK_FALLBACK;
}
