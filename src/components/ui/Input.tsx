// 범용 Input 컴포넌트 - label·error 메시지·helperText 지원, forwardRef 패턴
/**
 * Input 컴포넌트
 * - label, error, hint 지원
 * - react-hook-form과 함께 사용 (forwardRef)
 */

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  id: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = '', ...props }, ref) => {
    const hasError = Boolean(error);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={id}
            className="text-sm font-semibold text-gray-700"
          >
            {label}
            {props.required && (
              <span className="ml-1 text-red-500" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <input
          ref={ref}
          id={id}
          aria-invalid={hasError}
          aria-describedby={
            hasError ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          className={[
            'w-full px-3 py-2.5 text-sm rounded-none border transition-colors duration-150',
            'placeholder:text-gray-400',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed',
            hasError
              ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
              : 'border-gray-300 focus:border-primary focus:ring-primary/20',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />

        {hasError && (
          <p
            id={`${id}-error`}
            role="alert"
            className="text-xs text-red-600 font-medium"
          >
            {error}
          </p>
        )}

        {!hasError && hint && (
          <p id={`${id}-hint`} className="text-xs text-gray-500">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
