'use client';

import { useState } from 'react';
import { useCreateAnnouncement, useUpdateAnnouncement } from '@/hooks/useAnnouncements';
import { useAdminAirlines } from '@/hooks/useAirlines';
import { ANNOUNCEMENT_LEVEL } from '@/lib/constants';
import { Announcement } from '@/types/announcement';

interface Props {
  announcement?: Announcement;
  onSuccess?: () => void;
}

/**
 * AnnouncementForm - 공지사항 생성/수정 폼
 *
 * 기능:
 * - 신규/수정 모드 지원
 * - 유효성 검사 (시간 범위 등)
 * - 항공사 선택 (전체 또는 특정)
 * - 로딩/에러 상태
 * - 기본값: 오늘부터 7일간
 */
function getDefaultDates() {
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // ISO 문자열에서 시간 부분 제거 (YYYY-MM-DDTHH:mm 형식)
  const startDate = today.toISOString().slice(0, 16);
  const endDate = nextWeek.toISOString().slice(0, 16);

  return { startDate, endDate };
}

export function AnnouncementForm({ announcement, onSuccess }: Props) {
  const isEdit = !!announcement;
  const defaultDates = getDefaultDates();
  const { data: airlines = [] } = useAdminAirlines();

  const [form, setForm] = useState({
    title: announcement?.title || '',
    content: announcement?.content || '',
    level: announcement?.level || 'info' as 'warning' | 'info' | 'success',
    startDate: announcement?.startDate
      ? new Date(announcement.startDate).toISOString().slice(0, 16)
      : defaultDates.startDate,
    endDate: announcement?.endDate
      ? new Date(announcement.endDate).toISOString().slice(0, 16)
      : defaultDates.endDate,
    targetAirlines: announcement?.targetAirlines
      ? announcement.targetAirlines.split(',')
      : [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // 폼 유효성 검사
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.title.trim()) {
      newErrors.title = '제목을 입력해주세요.';
    }

    if (!form.content.trim()) {
      newErrors.content = '내용을 입력해주세요.';
    }

    if (!form.startDate) {
      newErrors.startDate = '시작일을 선택해주세요.';
    }

    if (!form.endDate) {
      newErrors.endDate = '종료일을 선택해주세요.';
    }

    if (form.startDate && form.endDate) {
      const start = new Date(form.startDate);
      const end = new Date(form.endDate);

      if (start >= end) {
        newErrors.dateRange = '시작일은 종료일보다 전에 있어야 합니다.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: announcement!.id,
          title: form.title,
          content: form.content,
          level: form.level,
          startDate: form.startDate,
          endDate: form.endDate,
          targetAirlines:
            form.targetAirlines.length > 0 ? form.targetAirlines : undefined,
        });
      } else {
        await createMutation.mutateAsync({
          title: form.title,
          content: form.content,
          level: form.level,
          startDate: form.startDate,
          endDate: form.endDate,
          targetAirlines:
            form.targetAirlines.length > 0 ? form.targetAirlines : undefined,
        });
      }

      // 성공
      if (onSuccess) {
        onSuccess();
      } else {
        // 폼 초기화
        setForm({
          title: '',
          content: '',
          level: 'info',
          startDate: '',
          endDate: '',
          targetAirlines: [],
        });
      }
    } catch (error) {
      console.error('Form submit error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-slate-900 rounded-none border border-slate-800 p-6">
      {/* 제목 */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1">
          제목 *
        </label>
        <input
          type="text"
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
          placeholder="공지사항 제목 입력"
          className="w-full border border-slate-700 rounded-none px-3 py-2 bg-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          disabled={isLoading}
        />
        {errors.title && (
          <p className="text-xs text-rose-400 mt-1">{errors.title}</p>
        )}
      </div>

      {/* 내용 */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1">
          내용 *
        </label>
        <textarea
          value={form.content}
          onChange={e => setForm({ ...form, content: e.target.value })}
          placeholder="공지사항 내용 입력"
          rows={5}
          className="w-full border border-slate-700 rounded-none px-3 py-2 bg-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          disabled={isLoading}
        />
        {errors.content && (
          <p className="text-xs text-rose-400 mt-1">{errors.content}</p>
        )}
      </div>

      {/* 긴급도 */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1">
          긴급도
        </label>
        <select
          value={form.level}
          onChange={e =>
            setForm({
              ...form,
              level: e.target.value as 'warning' | 'info' | 'success',
            })
          }
          className="w-full border border-slate-700 rounded-none px-3 py-2 bg-slate-800 text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          disabled={isLoading}
        >
          <option value="info">📢 일반</option>
          <option value="warning">🚨 경고</option>
          <option value="success">✅ 완료</option>
        </select>
      </div>

      {/* 대상항공사 */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-2">
          대상항공사 (선택사항 - 공란 시 전체 항공사)
        </label>
        <div className="border border-slate-700 rounded-none p-3 bg-slate-800/50 space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
          {airlines.map((airline) => (
            <label key={airline.code} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.targetAirlines.includes(airline.code)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setForm({
                      ...form,
                      targetAirlines: [...form.targetAirlines, airline.code],
                    });
                  } else {
                    setForm({
                      ...form,
                      targetAirlines: form.targetAirlines.filter(
                        (code) => code !== airline.code
                      ),
                    });
                  }
                }}
                disabled={isLoading}
                className="rounded-none bg-slate-700 border-slate-600 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
              />
              <span className="text-sm text-slate-300">
                {airline.code} - {airline.name_ko} ({airline.name_en})
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {form.targetAirlines.length > 0
            ? `선택됨: ${form.targetAirlines.join(', ')}`
            : '항공사를 선택하지 않으면 모든 항공사에게 공지됩니다'}
        </p>
      </div>

      {/* 시작일 */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1">
          시작일 *
        </label>
        <input
          type="datetime-local"
          value={form.startDate}
          onChange={e => setForm({ ...form, startDate: e.target.value })}
          className="w-full border border-slate-700 rounded-none px-3 py-2 bg-slate-800 text-slate-100 [color-scheme:dark] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          disabled={isLoading}
        />
        {errors.startDate && (
          <p className="text-xs text-rose-400 mt-1">{errors.startDate}</p>
        )}
      </div>

      {/* 종료일 */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1">
          종료일 *
        </label>
        <input
          type="datetime-local"
          value={form.endDate}
          onChange={e => setForm({ ...form, endDate: e.target.value })}
          className="w-full border border-slate-700 rounded-none px-3 py-2 bg-slate-800 text-slate-100 [color-scheme:dark] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          disabled={isLoading}
        />
        {errors.endDate && (
          <p className="text-xs text-rose-400 mt-1">{errors.endDate}</p>
        )}
      </div>

      {/* 날짜 범위 에러 */}
      {errors.dateRange && (
        <div className="p-3 bg-rose-900/20 border border-rose-900/50 rounded-none text-sm text-rose-400">
          {errors.dateRange}
        </div>
      )}

      {/* 뮤테이션 에러 */}
      {(createMutation.error || updateMutation.error) && (
        <div className="p-3 bg-rose-900/20 border border-rose-900/50 rounded-none text-sm text-rose-400">
          {(createMutation.error || updateMutation.error)?.message ||
            '오류가 발생했습니다.'}
        </div>
      )}

      {/* 버튼 */}
      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium transition"
        >
          {isLoading
            ? '저장 중...'
            : isEdit
              ? '수정'
              : '생성'}
        </button>
      </div>
    </form>
  );
}
