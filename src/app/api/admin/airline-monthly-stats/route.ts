// GET /api/admin/airline-monthly-stats - 항공사별 월별 검출건수·조치건수 행렬
// 접근 정책: JWT 인증만 필요 (admin role 불필요) - 항공사 페이지 통계 탭에서 전체 비교용으로 공개
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface AirlineRow { id: string; code: string; name_ko: string; }

/**
 * GET /api/admin/airline-monthly-stats
 *
 * 항공사별 월별 검출건수 + 조치건수 행렬 조회
 * - 목적: 항공사별 시스템 활용도 비교 (통계 탭 > 항공사별 조치현황)
 * - 접근: JWT 인증 사용자라면 role 무관 접근 가능 (비교 데이터 공개 정책)
 *
 * 쿼리 파라미터:
 * - months: 최근 몇 개월 (기본: 6, 최대: 24)
 * - dateFrom: YYYY-MM-DD (months 무시, 직접 범위 지정)
 * - dateTo: YYYY-MM-DD
 *
 * 응답:
 * {
 *   airlines: [
 *     {
 *       airline_id, airline_code, airline_name_ko,
 *       monthly: [{ month, detection_count, action_count }],
 *       total_detection, total_action,
 *       action_rate  // Math.min(action/detection×100, 100)
 *     }
 *   ],
 *   months: string[]  // 오름차순 "YYYY-MM"
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // 1️⃣ 인증 체크
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    // 2️⃣ 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url);
    const rawMonths = parseInt(searchParams.get('months') ?? '6', 10);
    // M3: NaN 방어
    const months = Number.isFinite(rawMonths) ? Math.min(Math.max(rawMonths, 1), 24) : 6;
    let dateFrom = searchParams.get('dateFrom');
    let dateTo = searchParams.get('dateTo');

    // months 파라미터로 기본 범위 계산
    if (!dateFrom && !dateTo) {
      const now = new Date();
      const fromDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
      dateFrom = fromDate.toISOString().slice(0, 10);
      dateTo = now.toISOString().slice(0, 10);
    }

    // dateFrom > dateTo 입력 검증
    if (dateFrom && dateTo && dateFrom > dateTo) {
      return NextResponse.json(
        { error: 'dateFrom은 dateTo보다 이전이어야 합니다.' },
        { status: 400 }
      );
    }

    // 3️⃣ 전체 국내 항공사 목록 조회 (데이터 없는 항공사도 포함)
    // 국내항공사 판별: airlines 테이블에 등록되고 code != 'FOREIGN'인 행만 (CLAUDE.md 국내항공사 판별 규칙 준수)
    const airlinesResult = await query(
      `SELECT id, code, name_ko FROM airlines WHERE code != 'FOREIGN' ORDER BY name_ko`
    );

    // 4️⃣ 월별 검출건수 쿼리
    // C1 수정: 기간 필터를 ON 절에 배치해 LEFT JOIN 의미 보존 (WHERE에 두면 INNER JOIN과 동일)
    // M1 수정: dateTo를 < (dateTo + 1 day) 처리로 당일 데이터 포함
    const detectionParams: string[] = [];
    const detectionOnClauses: string[] = ['cs.airline_id = al.id'];
    if (dateFrom) {
      detectionParams.push(dateFrom);
      detectionOnClauses.push(`cs.uploaded_at >= $${detectionParams.length}::date`);
    }
    if (dateTo) {
      detectionParams.push(dateTo);
      detectionOnClauses.push(`cs.uploaded_at < ($${detectionParams.length}::date + interval '1 day')`);
    }

    const detectionResult = await query(
      `SELECT
        al.id AS airline_id,
        TO_CHAR(DATE_TRUNC('month', cs.uploaded_at), 'YYYY-MM') AS month,
        COUNT(DISTINCT cs.id) AS detection_count
      FROM airlines al
      LEFT JOIN callsigns cs ON ${detectionOnClauses.join(' AND ')}
      WHERE al.code != 'FOREIGN'
      GROUP BY al.id, DATE_TRUNC('month', cs.uploaded_at)
      ORDER BY al.id, month`,
      detectionParams
    );

    // 5️⃣ 월별 조치완료건수 쿼리 (action 기준 월별 집계)
    // H1 수정: detection과 독립적으로 action을 집계 — 검출/조치가 다른 달에 발생해도 각각 집계
    const actionParams: string[] = [];
    let actionWhere = "al.code != 'FOREIGN' AND COALESCE(ac.is_cancelled, false) = false";
    if (dateFrom) {
      actionParams.push(dateFrom);
      actionWhere += ` AND ac.registered_at >= $${actionParams.length}::date`;
    }
    if (dateTo) {
      actionParams.push(dateTo);
      actionWhere += ` AND ac.registered_at < ($${actionParams.length}::date + interval '1 day')`;
    }

    const actionResult = await query(
      `SELECT
        ac.airline_id,
        TO_CHAR(DATE_TRUNC('month', ac.registered_at), 'YYYY-MM') AS month,
        COUNT(*) FILTER (WHERE ac.status = 'completed') AS action_count
      FROM actions ac
      JOIN airlines al ON al.id = ac.airline_id
      WHERE ${actionWhere}
      GROUP BY ac.airline_id, DATE_TRUNC('month', ac.registered_at)
      ORDER BY ac.airline_id, month`,
      actionParams
    );

    // 6️⃣ 데이터 병합
    // H1 수정: detection 맵과 action 맵을 독립적으로 구축 후 항공사+월 합집합 기준으로 조합
    const detectionMap = new Map<string, number>(); // key: "airline_id__month"

    for (const row of detectionResult.rows) {
      if (!row.month) continue; // 해당 기간 검출이 없는 항공사는 NULL month → 건너뜀
      const key = `${row.airline_id}__${row.month}`;
      detectionMap.set(key, Number(row.detection_count));
    }

    const actionMap = new Map<string, number>(); // key: "airline_id__month"
    for (const row of actionResult.rows) {
      if (!row.month) continue;
      const key = `${row.airline_id}__${row.month}`;
      actionMap.set(key, Number(row.action_count));
    }

    // HIGH-1 수정: dateFrom/dateTo 범위 내 모든 월을 enumerate → 데이터 없는 달도 컬럼에 포함
    // (데이터가 있는 달만 포함하면 트렌드 비교 왜곡 발생)
    function enumerateMonths(from: string, to: string): string[] {
      const [fy, fm] = from.slice(0, 7).split('-').map(Number);
      const [ty, tm] = to.slice(0, 7).split('-').map(Number);
      const out: string[] = [];
      let y = fy, m = fm;
      while (y < ty || (y === ty && m <= tm)) {
        out.push(`${y}-${String(m).padStart(2, '0')}`);
        m++;
        if (m > 12) { m = 1; y++; }
      }
      return out;
    }

    const sortedMonths = (dateFrom && dateTo)
      ? enumerateMonths(dateFrom, dateTo)
      : [...new Set([...detectionMap.keys(), ...actionMap.keys()]
          .map(k => k.split('__')[1])
        )].sort((a, b) => a.localeCompare(b));

    // 7️⃣ 항공사별 결과 구성
    const airlines = (airlinesResult.rows as AirlineRow[]).map((al) => {
      let totalDetection = 0;
      let totalAction = 0;

      const monthly = sortedMonths.map(month => {
        const detKey = `${al.id}__${month}`;
        const detCount = detectionMap.get(detKey) ?? 0;
        const actCount = actionMap.get(detKey) ?? 0;
        totalDetection += detCount;
        totalAction += actCount;
        return { month, detection_count: detCount, action_count: actCount };
      });

      // M4 수정: action_rate 100% 상한 적용
      const actionRate = totalDetection > 0
        ? Math.min(Math.round((totalAction / totalDetection) * 100 * 10) / 10, 100)
        : 0;

      return {
        airline_id: al.id,
        airline_code: al.code,
        airline_name_ko: al.name_ko,
        monthly,
        total_detection: totalDetection,
        total_action: totalAction,
        action_rate: actionRate,
      };
    })
    // 총 검출건수 내림차순, 동률이면 항공사명 오름차순 (L2 수정)
    .sort((a, b) =>
      b.total_detection - a.total_detection ||
      a.airline_name_ko.localeCompare(b.airline_name_ko)
    );

    return NextResponse.json({ airlines, months: sortedMonths });
  } catch (error) {
    logger.error('항공사별 월별 통계 조회 실패', error, 'admin/airline-monthly-stats');
    return NextResponse.json({ error: '통계 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
