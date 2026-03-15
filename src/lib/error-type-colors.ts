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

const PILOT_ERROR: ErrorTypeColorSet = {
  bg: 'bg-rose-50', activeBg: 'bg-rose-100',
  border: 'border-rose-200', activeBorder: 'border-rose-400',
  label: 'text-rose-600', value: 'text-rose-700', pct: 'text-rose-500',
  hex: '#ef4444',
};

const ATC_ERROR: ErrorTypeColorSet = {
  bg: 'bg-blue-50', activeBg: 'bg-blue-100',
  border: 'border-blue-200', activeBorder: 'border-blue-400',
  label: 'text-blue-600', value: 'text-blue-700', pct: 'text-blue-500',
  hex: '#3b82f6',
};

const ERROR_TYPE_COLOR_MAP: Record<string, ErrorTypeColorSet> = {
  '조종사오류': PILOT_ERROR,
  '조종사': PILOT_ERROR,
  '관제사오류': ATC_ERROR,
  '관제사': ATC_ERROR,
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

// 다크 테마: Tailwind purge 문제 방지를 위해 인라인 style 값 사용
interface DarkStyleSet {
  bg: string;
  border: string;
  label: string;
  value: string;
}

const DARK_STYLE_MAP: Record<string, DarkStyleSet> = {
  '조종사오류': { border: '1px solid rgba(159,18,57,0.6)', bg: 'rgba(76,5,25,0.4)', label: '#fecdd3', value: '#fda4af' },
  '조종사': { border: '1px solid rgba(159,18,57,0.6)', bg: 'rgba(76,5,25,0.4)', label: '#fecdd3', value: '#fda4af' },
  '관제사오류': { border: '1px solid rgba(30,64,175,0.6)', bg: 'rgba(23,37,84,0.4)', label: '#bfdbfe', value: '#93c5fd' },
  '관제사': { border: '1px solid rgba(30,64,175,0.6)', bg: 'rgba(23,37,84,0.4)', label: '#bfdbfe', value: '#93c5fd' },
  '오류미발생': { border: '1px solid rgba(6,95,70,0.6)', bg: 'rgba(2,44,34,0.4)', label: '#a7f3d0', value: '#6ee7b7' },
  '시스템': { border: '1px solid rgba(91,33,182,0.6)', bg: 'rgba(46,16,101,0.4)', label: '#ddd6fe', value: '#c4b5fd' },
};

const DARK_STYLE_FALLBACK: DarkStyleSet = {
  border: '1px solid rgba(146,64,14,0.6)', bg: 'rgba(69,26,3,0.4)', label: '#fde68a', value: '#fcd34d',
};

export function getErrorTypeDarkStyle(errorType: string): DarkStyleSet {
  return DARK_STYLE_MAP[errorType] ?? DARK_STYLE_FALLBACK;
}

// 하위 호환용 (기존 클래스 기반)
export function getErrorTypeDarkColor(errorType: string): { bg: string; border: string; label: string; value: string } {
  const s = getErrorTypeDarkStyle(errorType);
  return { bg: '', border: '', label: '', value: '' };
}
