'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NanoIcon } from '@/components/ui/NanoIcon';
import { ADMIN_SIDEBAR_ITEMS } from '@/lib/admin-navigation';

export function AdminSidebar() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [activeMenu, setActiveMenu] = useState('dashboard');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (pathname === '/admin') {
            setActiveMenu('dashboard');
        } else if (pathname.startsWith('/admin/users')) {
            if (tab === 'airlines') {
                setActiveMenu('airlines');
            } else if (tab === 'password') {
                setActiveMenu('password');
            } else {
                setActiveMenu('users');
            }
        } else if (pathname.startsWith('/admin/airlines')) {
            setActiveMenu('airlines');
        } else if (pathname.startsWith('/admin/password-reset')) {
            setActiveMenu('password');
        } else if (pathname.startsWith('/admin/announcements')) {
            setActiveMenu('announcements');
        } else if (pathname.startsWith('/admin/settings')) {
            setActiveMenu('settings-action-types');
        } else if (pathname.startsWith('/admin/database')) {
            setActiveMenu('database');
        }
    }, [pathname, searchParams]);

    return (
        <aside className="w-[230px] bg-white border-r border-gray-200 flex flex-col pt-0 shrink-0 h-full overflow-y-auto">
            <div className="px-6 py-4 mb-0">
                <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">
                    Admin Terminal
                </h2>
            </div>
            <nav className="flex-1 px-4 space-y-1">
                {/* 메인 메뉴 */}
                {ADMIN_SIDEBAR_ITEMS.filter(i => i.group === 'main' || !i.group).map((item) => {
                    const isActive = activeMenu === item.id;
                    return (
                        <Link
                            key={item.id}
                            href={item.href}
                            className={`w-full group flex items-center gap-4 px-4 py-4 rounded-none text-sm font-bold tracking-tight transition-all text-left border-l-4 ${isActive
                                ? 'bg-navy text-white shadow-[0_10px_20px_rgba(30,58,95,0.2)] border-primary'
                                : 'text-gray-500 hover:bg-gray-50 border-transparent hover:border-gray-200'
                                }`}
                        >
                            <NanoIcon
                                icon={item.icon as any}
                                color={item.color as any}
                                size="sm"
                                isActive={isActive}
                            />
                            <span className={`transition-all duration-300 ${isActive ? 'translate-x-1' : 'group-hover:translate-x-1'}`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}

                {/* 설정 그룹 구분선 */}
                <div className="pt-4 pb-1">
                    <p className="px-4 text-[10px] font-black text-gray-300 uppercase tracking-[0.25em]">
                        설정
                    </p>
                </div>

                {/* 설정 메뉴 */}
                {ADMIN_SIDEBAR_ITEMS.filter(i => i.group === 'settings').map((item) => {
                    const isActive = activeMenu === item.id;
                    return (
                        <Link
                            key={item.id}
                            href={item.href}
                            className={`w-full group flex items-center gap-4 px-4 py-3.5 rounded-none text-sm font-bold tracking-tight transition-all text-left border-l-4 ${isActive
                                ? 'bg-navy text-white shadow-[0_10px_20px_rgba(30,58,95,0.2)] border-primary'
                                : 'text-gray-500 hover:bg-gray-50 border-transparent hover:border-gray-200'
                                }`}
                        >
                            <NanoIcon
                                icon={item.icon as any}
                                color={item.color as any}
                                size="sm"
                                isActive={isActive}
                            />
                            <span className={`transition-all duration-300 ${isActive ? 'translate-x-1' : 'group-hover:translate-x-1'}`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}

                {/* 데이터베이스 그룹 구분선 */}
                <div className="pt-4 pb-1">
                    <p className="px-4 text-[10px] font-black text-gray-300 uppercase tracking-[0.25em]">
                        데이터베이스
                    </p>
                </div>

                {/* 데이터베이스 메뉴 */}
                {ADMIN_SIDEBAR_ITEMS.filter(i => i.group === 'database').map((item) => {
                    const isActive = activeMenu === item.id;
                    return (
                        <Link
                            key={item.id}
                            href={item.href}
                            className={`w-full group flex items-center gap-4 px-4 py-3.5 rounded-none text-sm font-bold tracking-tight transition-all text-left border-l-4 ${isActive
                                ? 'bg-navy text-white shadow-[0_10px_20px_rgba(30,58,95,0.2)] border-primary'
                                : 'text-gray-500 hover:bg-gray-50 border-transparent hover:border-gray-200'
                                }`}
                        >
                            <NanoIcon
                                icon={item.icon as any}
                                color={item.color as any}
                                size="sm"
                                isActive={isActive}
                            />
                            <span className={`transition-all duration-300 ${isActive ? 'translate-x-1' : 'group-hover:translate-x-1'}`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-6 mt-auto border-t border-gray-100">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-none text-xs text-gray-500 font-medium">
                    이 페이지는 시스템 관리자 전용 메뉴입니다. 권한 부여 및 시스템 모니터링 시 각별히 주의하시기 바랍니다.
                </div>
            </div>
        </aside>
    );
}
