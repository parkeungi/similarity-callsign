// 조치유형 분포 차트 - recharts PieChart, GET /api/admin/action-type-stats 데이터 시각화
'use client';

import { useActionTypeStats } from '@/hooks/useAdminStats';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface ActionTypeDistributionChartProps {
  dateRange?: {
    dateFrom: string;
    dateTo: string;
  };
}

/**
 * 조치 유형별 분포 차트
 * - 각 조치 유형별 상태 분포 (완료, 진행중, 미조치)
 * - 완료율 표시
 * - 날짜 범위 필터 지원
 */
export function ActionTypeDistributionChart({ dateRange }: ActionTypeDistributionChartProps) {
  const { data: statsData, isLoading, error } = useActionTypeStats(dateRange);

  if (isLoading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="mt-2 text-sm text-gray-500">통계 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error || !statsData || statsData.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg">
        <p className="text-gray-500">통계 데이터가 없습니다.</p>
      </div>
    );
  }

  const chartData = statsData.map((stat) => ({
    name: stat.action_type,
    완료: stat.completed_count,
    진행중: stat.in_progress_count,
    미조치: stat.pending_count,
    완료율: Math.round(stat.completion_rate * 10) / 10, // 소수점 1자리
  }));

  const colors = {
    완료: '#10b981', // emerald-600
    진행중: '#3b82f6', // blue-600
    미조치: '#f59e0b', // amber-600
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900">조치 유형별 분포</h2>
        <p className="text-sm text-gray-500 mt-1">
          조치 유형별 상태 분포 및 완료율
        </p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={100}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            label={{ value: '건수', angle: -90, position: 'insideLeft' }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
            formatter={(value: any, name: string) => {
              if (name === '완료율') {
                return `${value}%`;
              }
              return value;
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="square"
          />
          <Bar dataKey="완료" stackId="status" fill={colors.완료} />
          <Bar dataKey="진행중" stackId="status" fill={colors.진행중} />
          <Bar dataKey="미조치" stackId="status" fill={colors.미조치} />
        </BarChart>
      </ResponsiveContainer>

      {/* 통계 테이블 */}
      <div className="mt-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left font-bold text-gray-700">
                조치 유형
              </th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">
                총 건수
              </th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">
                완료
              </th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">
                진행중
              </th>
              <th className="px-4 py-3 text-center font-bold text-gray-700">
                미조치
              </th>
              <th className="px-4 py-3 text-right font-bold text-gray-700">
                완료율
              </th>
            </tr>
          </thead>
          <tbody>
            {statsData.map((stat) => (
              <tr
                key={stat.action_type}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  {stat.action_type}
                </td>
                <td className="px-4 py-3 text-center text-gray-600">
                  {stat.total_count}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                    {stat.completed_count}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                    {stat.in_progress_count}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700">
                    {stat.pending_count}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-lg font-bold text-sm ${
                      stat.completion_rate >= 80
                        ? 'bg-emerald-50 text-emerald-700'
                        : stat.completion_rate >= 50
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {stat.completion_rate.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
