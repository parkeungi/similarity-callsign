// 시간대별 충돌 패턴 분류 공유 유틸리티 - classifyPattern(occurrences) → pattern_type, primary_hours, time_concentration

export interface OccurrenceTime {
  date: string;
  time: string;
  error_type: string | null;
}

export function classifyPattern(occurrences: OccurrenceTime[]): {
  pattern_type: 'fixed' | 'roundtrip' | 'scattered';
  primary_hours: number[];
  time_concentration: number;
} {
  const withTime = occurrences.filter((o) => o.time);
  if (withTime.length === 0) {
    return { pattern_type: 'scattered', primary_hours: [], time_concentration: 0 };
  }

  // 시간대별 발생 횟수 집계
  const hourCounts: Record<number, number> = {};
  withTime.forEach((occ) => {
    const hour = parseInt(occ.time.split(':')[0], 10);
    if (!isNaN(hour)) {
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
  });

  // 인접 시간대 그룹핑 (+-1시간 허용)
  const hours = Object.keys(hourCounts).map(Number).sort((a, b) => a - b);
  const groups: { hours: number[]; count: number }[] = [];

  for (const h of hours) {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && (h - lastGroup.hours[lastGroup.hours.length - 1] <= 1)) {
      lastGroup.hours.push(h);
      lastGroup.count += hourCounts[h];
    } else {
      groups.push({ hours: [h], count: hourCounts[h] });
    }
  }

  groups.sort((a, b) => b.count - a.count);

  if (groups.length === 0) {
    return { pattern_type: 'scattered', primary_hours: [], time_concentration: 0 };
  }

  const topGroup = groups[0];
  const topConcentration = topGroup.count / withTime.length;

  if (groups.length >= 2) {
    const secondGroup = groups[1];
    const twoGroupConcentration = (topGroup.count + secondGroup.count) / withTime.length;

    if (topConcentration >= 0.7) {
      return {
        pattern_type: 'fixed',
        primary_hours: topGroup.hours,
        time_concentration: Math.round(topConcentration * 100),
      };
    } else if (twoGroupConcentration >= 0.7) {
      const hourDiff = Math.abs(topGroup.hours[0] - secondGroup.hours[0]);
      if (hourDiff >= 6) {
        return {
          pattern_type: 'roundtrip',
          primary_hours: [...topGroup.hours, ...secondGroup.hours].sort((a, b) => a - b),
          time_concentration: Math.round(twoGroupConcentration * 100),
        };
      }
      return {
        pattern_type: 'fixed',
        primary_hours: [...topGroup.hours, ...secondGroup.hours].sort((a, b) => a - b),
        time_concentration: Math.round(twoGroupConcentration * 100),
      };
    }
  } else if (topConcentration >= 0.7) {
    return {
      pattern_type: 'fixed',
      primary_hours: topGroup.hours,
      time_concentration: Math.round(topConcentration * 100),
    };
  }

  return {
    pattern_type: 'scattered',
    primary_hours: topGroup.hours,
    time_concentration: Math.round(topConcentration * 100),
  };
}
