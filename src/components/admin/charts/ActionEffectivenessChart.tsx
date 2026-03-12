// 조치 효과성 차트 - recharts 기반, GET /api/admin/action-effectiveness 데이터(평균처리일수·완료율) 시각화
'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useActionEffectiveness } from '@/hooks/useActionEffectiveness';

interface ActionEffectivenessData {
  actionType: string;
  totalActions: number;
  noRepeatCount: number;
  repeatCount: number;
  preventionRate: number;
  avgDaysUntilRepeat: number;
  effectivenessScore: number;
}

export function ActionEffectivenessChart() {
  const { data, isLoading, error } = useActionEffectiveness();

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">조치 효과성 분석</h3>
        <div className="h-96 flex items-center justify-center">
          <p className="text-gray-500">데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">조치 효과성 분석</h3>
        <div className="h-96 flex items-center justify-center">
          <p className="text-red-500">데이터 로딩 실패</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">조치 효과성 분석</h3>
        <div className="h-96 flex items-center justify-center">
          <p className="text-gray-500">데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 색상 판정 함수
  const getEffectivenessColor = (rate: number) => {
    if (rate >= 90) return '#10b981'; // 녹색 - 우수
    if (rate >= 75) return '#3b82f6'; // 파랑 - 좋음
    if (rate >= 50) return '#f59e0b'; // 주황 - 양호
    return '#ef4444'; // 빨강 - 부진
  };

  const getStatusLabel = (rate: number) => {
    if (rate >= 90) return '⭐⭐⭐⭐⭐';
    if (rate >= 75) return '⭐⭐⭐⭐';
    if (rate >= 50) return '⭐⭐⭐';
    return '⭐⭐';
  };

  const getStatusBg = (rate: number) => {
    if (rate >= 90) return 'bg-green-50 border-green-200';
    if (rate >= 75) return 'bg-blue-50 border-blue-200';
    if (rate >= 50) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className="space-y-6">
      {/* 1. 가로 막대 그래프: 조치 유형별 재검출 방지율 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">조치 유형별 재검출 방지율</h3>
        <div className="text-sm text-gray-600 mb-4">
          높을수록 효과적인 조치입니다. 목표: 80% 이상
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" stroke="#6b7280" domain={[0, 100]} />
            <YAxis dataKey="actionType" type="category" stroke="#6b7280" width={140} />
            <Tooltip
              formatter={(value) => [
                typeof value === 'number' ? `${value.toFixed(1)}%` : value,
                ''
              ]}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}
            />
            <Bar
              dataKey="preventionRate"
              fill="#10b981"
              radius={[0, 8, 8, 0]}
              name="방지율 (%)"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 2. 상세 테이블 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">조치 유형별 상세 분석</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700">조치 유형</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">총 조치</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">효과 ✅</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">재검출 ❌</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">방지율</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">평균 지속일</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">평가</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-100 ${
                    idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {row.actionType}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {row.totalActions}건
                  </td>
                  <td className="px-4 py-3 text-right text-green-600 font-semibold">
                    {row.noRepeatCount}건
                  </td>
                  <td className="px-4 py-3 text-right text-red-600 font-semibold">
                    {row.repeatCount}건
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-white"
                      style={{ backgroundColor: getEffectivenessColor(row.preventionRate) }}
                    >
                      {row.preventionRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-900">
                    {row.avgDaysUntilRepeat ? `${row.avgDaysUntilRepeat}일` : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-3 py-1 rounded-lg text-xs font-semibold border ${getStatusBg(row.preventionRate)}`}>
                      {getStatusLabel(row.preventionRate)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. 해석 가이드 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">📊 통계 해석</h4>
        <ul className="text-sm text-blue-900 space-y-1 ml-4 list-disc">
          <li><strong>방지율 ↑</strong> = 조치가 효과적 (재검출이 적음)</li>
          <li><strong>평균 지속일 ↑</strong> = 조치 효과가 오래 지속됨</li>
          <li><strong>90% 이상</strong> = 우수한 조치 (자동화/확대 권장)</li>
          <li><strong>50% 이하</strong> = 재검토 필요 (더 나은 대책 모색)</li>
        </ul>
      </div>

      {/* 4. 권장사항 */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="font-semibold text-purple-900 mb-2">💡 의사결정 가이드</h4>
        <ul className="text-sm text-purple-900 space-y-1 ml-4 list-disc">
          <li><strong>예산 배분:</strong> 방지율 90% 이상인 조치에 집중</li>
          <li><strong>프로세스:</strong> 방지율 90% 이상 조치는 자동화 검토</li>
          <li><strong>교육:</strong> 방지율 50% 이하 조치에 대한 담당자 교육 강화</li>
          <li><strong>모니터링:</strong> 월별로 추적하여 개선도 확인</li>
        </ul>
      </div>
    </div>
  );
}
