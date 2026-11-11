'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, RefreshCw } from 'lucide-react';

type WebButtonStatus = 'idle' | 'processing' | 'success' | 'failed';
export type AsyncButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'dark';

interface WebAsyncButtonProps {
  label: string;
  loadingLabel?: string;
  successLabel?: string;
  failedLabel?: string;
  onClick: () => Promise<unknown> | void;
  disabled?: boolean;
  variant?: AsyncButtonVariant;
  className?: string;
  resetSuccessMs?: number;
}

const IDLE_VARIANTS: Record<AsyncButtonVariant, string> = {
  primary: 'border-transparent bg-[#00B6C7] text-white shadow-teal-glow hover:bg-[#0099A8] h-12 min-h-[48px] text-[15px]',
  dark: 'border-transparent bg-[#131A20] text-white hover:bg-[#1E2933] h-12 min-h-[48px] text-[15px]',
  danger: 'border-transparent bg-[#DC2626] text-white hover:bg-[#B91C1C] h-12 min-h-[48px] text-[15px]',
  secondary: 'border-[#E2E6E9] bg-white text-[#131A20] hover:bg-[#F5F4EE] h-11 min-h-[44px] text-[14px]',
  outline: 'border-[#E2E6E9] bg-white text-[#131A20] hover:bg-[#F5F4EE] h-11 min-h-[44px] text-[14px]',
};

export function AsyncButton({
  label,
  loadingLabel = 'Processing...',
  successLabel = 'Saved ✓',
  failedLabel = 'Failed – Retry',
  onClick,
  disabled = false,
  variant = 'primary',
  className = '',
  resetSuccessMs = 1800,
}: WebAsyncButtonProps) {
  const [status, setStatus] = useState<WebButtonStatus>('idle');
  const lockRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function handleClick() {
    if (disabled || status === 'processing' || lockRef.current) return;
    lockRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus('processing');

    try {
      await onClick();
      setStatus('success');
      if (resetSuccessMs > 0) {
        timerRef.current = setTimeout(() => {
          setStatus((cur) => (cur === 'success' ? 'idle' : cur));
        }, resetSuccessMs);
      }
    } catch {
      setStatus('failed');
    } finally {
      lockRef.current = false;
    }
  }

  const isBusy = status === 'processing';
  const text = isBusy
    ? loadingLabel
    : status === 'success'
      ? successLabel
      : status === 'failed'
        ? failedLabel
        : label;

  const sizeClass =
    variant === 'outline' || variant === 'secondary'
      ? 'h-11 min-h-[44px] px-4 text-[14px] font-semibold'
      : 'h-12 min-h-[48px] px-5 text-[15px] font-bold';

  const toneClass =
    status === 'success'
      ? 'border-transparent bg-[#059669] text-white hover:bg-[#047857]'
      : status === 'failed'
        ? 'border-transparent bg-[#DC2626] text-white hover:bg-[#B91C1C]'
        : IDLE_VARIANTS[variant];

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isBusy}
      aria-busy={isBusy}
      aria-live="polite"
      className={`inline-flex items-center justify-center gap-2 rounded-[12px] border transition disabled:cursor-not-allowed disabled:opacity-55 ${sizeClass} ${toneClass} ${className}`}
    >
      {isBusy ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : status === 'success' ? (
        <Check className="h-4 w-4 shrink-0" />
      ) : status === 'failed' ? (
        <RefreshCw className="h-4 w-4 shrink-0" />
      ) : null}
      <span className="truncate">{text}</span>
    </button>
  );
}
