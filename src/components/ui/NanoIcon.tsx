// 아이콘 래퍼 - lucide-react 아이콘을 name 문자열로 동적 렌더링
'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface NanoIconProps {
    icon: LucideIcon;
    color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'orange' | 'navy';
    size?: 'sm' | 'md' | 'lg';
    isActive?: boolean;
}

export function NanoIcon({
    icon: Icon,
    color = 'primary',
    size = 'md',
    isActive = false
}: NanoIconProps) {
    const sizeClasses = {
        sm: 'w-8 h-8 p-1.5',
        md: 'w-10 h-10 p-2',
        lg: 'w-12 h-12 p-2.5',
    };

    const colorMaps = {
        primary: 'from-blue-500 to-indigo-600 shadow-blue-500/20',
        success: 'from-emerald-400 to-green-600 shadow-emerald-500/20',
        warning: 'from-amber-400 to-orange-500 shadow-amber-500/20',
        danger: 'from-rose-500 to-red-700 shadow-rose-500/20',
        info: 'from-cyan-400 to-blue-500 shadow-cyan-500/20',
        purple: 'from-violet-500 to-purple-700 shadow-violet-500/20',
        orange: 'from-orange-400 to-red-500 shadow-orange-500/20',
        navy: 'from-slate-700 to-navy-dark shadow-slate-900/20',
    };

    return (
        <div className={`relative group flex items-center justify-center transition-all duration-300 ${isActive ? 'scale-110' : 'hover:scale-110 hover:-translate-y-0.5'}`}>
            {/* Glassmorphism Background with Gradient Accent */}
            <div className={`
        absolute inset-0 bg-gradient-to-br ${colorMaps[color]} 
        rounded-xl opacity-20 group-hover:opacity-30 blur-[2px] transition-opacity
      `} />

            {/* The Icon Container */}
            <div className={`
        relative flex items-center justify-center
        bg-gradient-to-br ${colorMaps[color]}
        ${sizeClasses[size]}
        rounded-xl shadow-lg border border-white/40 backdrop-blur-sm
      `}>
                <Icon className={`
          w-full h-full text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]
          transition-transform duration-500 group-hover:rotate-[5deg]
        `} strokeWidth={2.5} />
            </div>

            {/* Gloss Effect */}
            <div className="absolute top-1 left-2 w-1/2 h-1/3 bg-white/30 rounded-full blur-[1px] transform -rotate-15 pointer-events-none" />
        </div>
    );
}
