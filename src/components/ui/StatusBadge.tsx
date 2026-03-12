// 상태 배지 컴포넌트 - status 값(pending/in_progress/completed/no_action)별 색상·텍스트 자동 매핑
/**
 * StatusBadge 컴포넌트
 * 사용자 상태(active/suspended) 표시
 */

type UserStatus = 'active' | 'suspended';

interface StatusBadgeProps {
  status: UserStatus;
}

const statusConfig: Record<
  UserStatus,
  { label: string; classes: string }
> = {
  active: {
    label: '활성',
    classes: 'bg-green-50 text-green-700 border border-green-200',
  },
  suspended: {
    label: '정지',
    classes: 'bg-red-50 text-red-700 border border-red-200',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={[
        'inline-flex items-center px-2.5 py-0.5 rounded-none text-xs font-semibold',
        config.classes,
      ].join(' ')}
    >
      {config.label}
    </span>
  );
}
