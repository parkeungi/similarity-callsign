// 비밀번호 강도 표시기 - 길이 규칙 기반 진행 바 렌더링
/**
 * 비밀번호 강도 표시 컴포넌트
 * - 4자 이상 (필수)
 * - 대문자, 숫자, 특수문자는 선택사항 (강도 표시용)
 */

interface PasswordStrengthProps {
  password: string;
}

interface Rule {
  label: string;
  test: (pw: string) => boolean;
}

const rules: Rule[] = [
  { label: '4자 이상', test: (pw) => pw.length >= 4 },
  { label: '8자 이상', test: (pw) => pw.length >= 8 },
  { label: '숫자 포함', test: (pw) => /\d/.test(pw) },
  { label: '대문자 포함', test: (pw) => /[A-Z]/.test(pw) },
  { label: '특수문자 포함', test: (pw) => /[!@#$%^&*(),.?":{}|<>]/.test(pw) },
];

function getStrength(password: string): number {
  return rules.filter((r) => r.test(password)).length;
}

const strengthConfig = [
  { label: '', color: 'bg-gray-200' },
  { label: '매우 약함', color: 'bg-red-500' },
  { label: '약함', color: 'bg-orange-400' },
  { label: '보통', color: 'bg-yellow-400' },
  { label: '강함', color: 'bg-green-500' },
  { label: '매우 강함', color: 'bg-green-600' },
];

export function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null;

  const strength = getStrength(password);
  const config = strengthConfig[strength];

  return (
    <div className="mt-2 space-y-2" aria-live="polite" aria-label="비밀번호 강도">
      {/* 강도 바 */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={[
              'h-1.5 flex-1 rounded-full transition-colors duration-300',
              strength >= level ? config.color : 'bg-gray-200',
            ].join(' ')}
          />
        ))}
      </div>

      {/* 강도 라벨 */}
      {config.label && (
        <p className={`text-xs font-medium ${strength <= 1 ? 'text-red-600' : strength === 2 ? 'text-orange-500' : strength === 3 ? 'text-yellow-600' : 'text-green-600'}`}>
          강도: {config.label}
        </p>
      )}

      {/* 규칙 체크리스트 */}
      <ul className="space-y-1">
        {rules.map((rule) => {
          const passed = rule.test(password);
          return (
            <li key={rule.label} className="flex items-center gap-1.5">
              <span
                className={`text-xs ${passed ? 'text-green-600' : 'text-gray-400'}`}
                aria-hidden="true"
              >
                {passed ? '✓' : '○'}
              </span>
              <span className={`text-xs ${passed ? 'text-green-700' : 'text-gray-500'}`}>
                {rule.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
