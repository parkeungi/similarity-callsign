// 중복 호출부호 차트 - recharts BarChart, GET /api/admin/duplicate-callsigns-stats 데이터 시각화
'use client';

import { useDuplicateCallsignsStats } from '@/hooks/useAdminStats';

/**
 * 중복 유사호출부호 현황 차트
 * - 같은 조치 유형으로 여러 건을 처리한 항공사 통계
 * - 비용 절감 및 프로세스 개선 기회 시각화
 */
export function DuplicateCallsignsChart() {
  const { data, isLoading, error } = useDuplicateCallsignsStats();

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

  if (error || !data) {
    return (
      <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg">
        <p className="text-gray-500">통계 데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const actionTypes = data.action_types || [];
  const summary = data.summary || [];

  return (
    <div className="space-y-6">
      {/* 항공사별 중복율 요약 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900">
            항공사별 중복 현황
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            같은 항공사가 처리한 조치 중 중복율 순서
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-bold text-gray-700">
                  항공사
                </th>
                <th className="px-4 py-3 text-center font-bold text-gray-700">
                  조치 유형 수
                </th>
                <th className="px-4 py-3 text-center font-bold text-gray-700">
                  총 조치 건수
                </th>
                <th className="px-4 py-3 text-center font-bold text-gray-700">
                  호출부호 쌍 수
                </th>
                <th className="px-4 py-3 text-right font-bold text-gray-700">
                  중복율
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.map((item) => (
                <tr
                  key={item.airline_code}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {item.airline_code} - {item.airline_name_ko}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {item.unique_action_types}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {item.total_actions}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {item.unique_callsigns}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-lg font-bold text-sm ${
                        item.duplicate_rate >= 150
                          ? 'bg-rose-50 text-rose-700'
                          : item.duplicate_rate >= 120
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {item.duplicate_rate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <span className="font-bold">📌 중복율이 높을수록:</span> 같은 조치
            유형을 반복 처리하는 항공사로, 프로세스 자동화나 시스템화 기회가
            높습니다.
          </p>
        </div>
      </div>

      {/* 조치 유형별 상세 분석 */}
      {actionTypes.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900">
              조치 유형별 중복 분석
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              같은 조치 유형을 3건 이상 처리한 항공사 (시스템화 기회)
            </p>
          </div>

          <div className="space-y-3">
            {actionTypes.map((item, index) => (
              <div
                key={`${item.airline_code}-${item.action_type}`}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900">
                      {item.airline_code} - {item.action_type}
                    </p>
                    <p className="text-sm text-gray-500">
                      {item.airline_name_ko}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">
                      {item.count}건/{item.total_actions}건
                    </p>
                    <p className="text-xs text-gray-500">
                      ({item.percentage.toFixed(1)}%)
                    </p>
                  </div>
                </div>

                {/* 진행 막대 */}
                <div className="mb-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        item.opportunity_score >= 150
                          ? 'bg-rose-600'
                          : item.opportunity_score >= 100
                            ? 'bg-amber-600'
                            : 'bg-emerald-600'
                      }`}
                      style={{
                        width: `${Math.min(item.opportunity_score, 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {/* 개선 기회 스코어 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500">
                    개선 기회:
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${
                      item.opportunity_score >= 150
                        ? 'bg-rose-100 text-rose-700'
                        : item.opportunity_score >= 100
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {item.opportunity_score >= 150
                      ? '🔴 매우 높음'
                      : item.opportunity_score >= 100
                        ? '🟡 높음'
                        : '🟢 보통'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-900">
              <span className="font-bold">💡 개선 아이디어:</span> 같은 조치
              유형을 반복 처리하는 경우, 표준 프로세스화, 자동화 시스템, 또는
              체크리스트화를 통해 효율성을 개선할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {actionTypes.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <p className="text-center text-gray-500">
            3건 이상의 중복 조치 유형이 없습니다.
          </p>
        </div>
      )}
    </div>
  );
}
