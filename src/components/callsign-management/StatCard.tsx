// 통계 카드 - title·value·icon·color props, 대시보드 상단 요약 수치 표시
interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

export function StatCard({ label, value, color }: StatCardProps) {
  const getBgColor = (c: string) => {
    if (c.includes('red')) return 'bg-rose-500';
    if (c.includes('amber')) return 'bg-amber-500';
    if (c.includes('emerald')) return 'bg-emerald-500';
    return 'bg-indigo-500';
  };

  const getTextColor = (c: string) => {
    if (c.includes('red')) return 'text-rose-600';
    if (c.includes('amber')) return 'text-amber-600';
    if (c.includes('emerald')) return 'text-emerald-600';
    if (c.includes('gray')) return 'text-slate-800';
    return 'text-indigo-600';
  };

  const getLightBgColor = (c: string) => {
    if (c.includes('red')) return 'bg-rose-50';
    if (c.includes('amber')) return 'bg-amber-50';
    if (c.includes('emerald')) return 'bg-emerald-50';
    if (c.includes('gray')) return 'bg-slate-50';
    return 'bg-indigo-50';
  };

  return (
    <div className="group relative bg-white rounded-3xl p-7 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 border border-slate-100 overflow-hidden group">
      {/* 액센트 데코레이션 */}
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity -mr-10 -mt-10 ${getBgColor(color)}`} />

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4">
          <p className="text-sm font-bold text-slate-500 tracking-tight">
            {label}
          </p>
          <div className={`p-2 rounded-xl flex items-center justify-center ${getLightBgColor(color)}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${getBgColor(color)} `} />
          </div>
        </div>

        <div className="flex items-baseline gap-1.5 mt-2">
          <p className={`text-4xl font-black ${getTextColor(color)} tracking-tight font-sans`}>
            {value.toLocaleString()}
          </p>
          <span className="text-sm font-semibold text-slate-400">건</span>
        </div>
      </div>
    </div>
  );
}
