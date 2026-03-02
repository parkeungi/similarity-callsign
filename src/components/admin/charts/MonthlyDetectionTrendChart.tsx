'use client';

import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useMonthlyDetectionTrend } from '@/hooks/useMonthlyDetectionTrend';

interface MonthlyTrendData {
  month: string;
  newDetections: number;
  repeatDetections: number;
  totalDetections: number;
  newRate: number;
  repeatRate: number;
}

export function MonthlyDetectionTrendChart() {
  const { data, isLoading, error } = useMonthlyDetectionTrend();

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">월별 신규 vs 재검출</h3>
        <div className="h-96 flex items-center justify-center">
          <p className="text-gray-500">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">월별 신규 vs 재검출</h3>
        <div className="h-96 flex items-center justify-center">
          <p className="text-red-500">데이터 로딩 실패</p>
        </div>
      </div>
    );
  }

  // 데이터 역순 정렬 (최신 월부터 오래된 월)
  const chartData = [...(data || [])].reverse();

  // 신호등 색상 판정
  const getStatusColor = (repeatRate: number) => {
    if (repeatRate >= 30) return 'bg-red-50 border-red-200';
    if (repeatRate >= 15) return 'bg-yellow-50 border-yellow-200';
    return 'bg-green-50 border-green-200';
  };

  const getStatusLabel = (repeatRate: number) => {
    if (repeatRate >= 30) return '🔴 주의';
    if (repeatRate >= 15) return '🟡 양호';
    return '🟢 우수';
  };

  return (
    <div className="space-y-6">
      {/* 1. 라인 차트: 월별 신규 vs 재검출 추이 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">월별 신규 vs 재검출 추이</h3>
        <div className="text-sm text-gray-600 mb-4">
          재검출률이 낮을수록 조치 효과가 높습니다.
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
              formatter={(value) => [
                typeof value === 'number' ? `${value.toFixed(1)}%` : value,
                ''
              ]}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Line
              type="monotone"
              dataKey="newRate"
              stroke="#10b981"
              strokeWidth={2}
              name="신규율 (%)"
              dot={{ fill: '#10b981', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              type="monotone"
              dataKey="repeatRate"
              stroke="#ef4444"
              strokeWidth={2}
              name="재검출률 (%)"
              dot={{ fill: '#ef4444', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 2. 막대 차트: 월별 신규 vs 재검출 건수 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">월별 신규 vs 재검출 건수</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar dataKey="newDetections" fill="#10b981" name="신규 (건)" />
            <Bar dataKey="repeatDetections" fill="#ef4444" name="재검출 (건)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 3. 월별 상세 테이블 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">월별 상세 현황</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">월</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">신규</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">재검출</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">합계</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">신규율</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">재검출률</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">평가</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-100 ${
                    idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{row.month}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-semibold">
                    {row.newDetections}건
                  </td>
                  <td className="px-4 py-3 text-right text-red-600 font-semibold">
                    {row.repeatDetections}건
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {row.totalDetections}건
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                      {row.newRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold">
                      {row.repeatRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold border ${getStatusColor(row.repeatRate)}`}>
                      {getStatusLabel(row.repeatRate)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {chartData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            데이터가 없습니다.
          </div>
        )}
      </div>

      {/* 4. 해석 가이드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">📊 통계 해석</h4>
        <ul className="text-sm text-blue-900 space-y-1 ml-4 list-disc">
          <li><strong>신규율 ↑</strong> = 새로운 호출부호가 많이 발생 (예방이 필요)</li>
          <li><strong>재검출률 ↓</strong> = 조치 효과가 높음 (좋은 신호)</li>
          <li><strong>재검출률 ↑</strong> = 같은 호출부호가 반복됨 (조치 재검토 필요)</li>
          <li><strong>목표</strong>: 재검출률 &lt; 10% (조치 효과적)</li>
        </ul>
      </div>
    </div>
  );
}
