import { ActionTypesManager } from '@/components/admin/settings/ActionTypesManager';

export default function ActionTypesPage() {
  return (
    <main className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">설정</h1>
        <p className="text-sm text-gray-500 mt-1">시스템 공통 설정을 관리합니다.</p>
      </div>
      <div className="bg-white border border-gray-200 rounded-none p-6">
        <ActionTypesManager />
      </div>
    </main>
  );
}
