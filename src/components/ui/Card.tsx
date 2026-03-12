// 범용 Card 컴포넌트 - children 래핑, padding·shadow·rounded 스타일, className 커스텀 가능
/**
 * Card 컴포넌트
 * - 기본 컨테이너 역할
 * - header, body, footer 슬롯 지원
 */

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={[
        'bg-white rounded-none border border-gray-200 shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
      <div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-gray-500">{description}</p>
        )}
      </div>
      {action && <div className="ml-4 flex-shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={['px-6 py-5', className].filter(Boolean).join(' ')}>{children}</div>;
}

export function CardFooter({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        'px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}
