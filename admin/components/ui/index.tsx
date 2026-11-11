'use client';

import React, { useEffect } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Inbox,
  Info,
  Loader2,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/* Responsive Container                                                */
/* ------------------------------------------------------------------ */
export function ResponsiveContainer({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full max-w-[1400px] px-4 tablet:px-6 laptop:px-8 wide:px-12 ${className}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Typography Headers                                                  */
/* ------------------------------------------------------------------ */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  onBack,
  actions,
  className = '',
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-4 tablet:flex-row tablet:items-center tablet:justify-between ${className}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {onBack && (
          <IconButton
            icon={<ArrowLeft className="h-5 w-5" />}
            label="Go back"
            onClick={onBack}
          />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          {eyebrow && (
            <p className="text-[13px] font-bold uppercase tracking-wider text-[#0099A8]">
              {eyebrow}
            </p>
          )}
          <h1 className="text-[26px] font-extrabold leading-[32px] tracking-[-0.02em] text-[#131A20] tablet:text-[32px] tablet:leading-[40px]">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13px] font-medium leading-[19px] text-[#646F78] tablet:text-[14px] tablet:leading-[20px]">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  actions,
  className = '',
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between ${className}`}>
      <div className="min-w-0 flex-1">
        <h2 className="text-[20px] font-extrabold leading-[26px] tracking-[-0.015em] text-[#131A20] tablet:text-[22px] tablet:leading-[28px]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[13px] font-medium leading-[19px] text-[#646F78] tablet:text-[14px] tablet:leading-[20px]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons (48px Primary, 44px Secondary, 36px Small, 44px IconButton) */
/* ------------------------------------------------------------------ */
type ButtonTone = 'primary' | 'dark' | 'safe' | 'danger';

const PRIMARY_TONE: Record<ButtonTone, string> = {
  primary: 'bg-[#00B6C7] text-white hover:bg-[#0099A8] shadow-teal-glow border-transparent',
  dark: 'bg-[#131A20] text-white hover:bg-[#1E2933] border-transparent',
  safe: 'bg-[#059669] text-white hover:bg-[#047857] border-transparent',
  danger: 'bg-[#DC2626] text-white hover:bg-[#B91C1C] border-transparent',
};

export function PrimaryButton({
  children,
  tone = 'primary',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
  loading?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex h-12 min-h-[48px] items-center justify-center gap-2 rounded-[12px] border px-6 text-[15px] font-bold leading-5 transition disabled:cursor-not-allowed disabled:opacity-55 ${PRIMARY_TONE[tone]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  tone = 'default',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'default' | 'teal' | 'danger' | 'warn';
  loading?: boolean;
}) {
  const toneClasses =
    tone === 'danger'
      ? 'border-[#FECACA] bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA]/60'
      : tone === 'warn'
        ? 'border-[#FCD34D] bg-[#FEF3C7] text-[#92400E] hover:bg-[#FDE68A]/70'
        : tone === 'teal'
          ? 'border-[#C5EFF2] bg-[#E9F7F7] text-[#0099A8] hover:bg-[#C5EFF2]'
          : 'border-[#E2E6E9] bg-white text-[#131A20] hover:bg-[#F5F4EE]';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-[12px] border px-4 text-[14px] font-semibold leading-5 transition disabled:cursor-not-allowed disabled:opacity-55 ${toneClasses} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
      {children}
    </button>
  );
}

export function SmallButton({
  children,
  tone = 'default',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: 'default' | 'primary' | 'safe' | 'danger' | 'warn' | 'dark';
  loading?: boolean;
}) {
  const toneClasses =
    tone === 'primary'
      ? 'border-transparent bg-[#00B6C7] text-white hover:bg-[#0099A8]'
      : tone === 'safe'
        ? 'border-transparent bg-[#059669] text-white hover:bg-[#047857]'
        : tone === 'dark'
          ? 'border-transparent bg-[#131A20] text-white hover:bg-[#1E2933]'
          : tone === 'danger'
            ? 'border-[#FECACA] bg-[#FEE2E2] text-[#991B1B] hover:bg-[#FECACA]/60'
            : tone === 'warn'
              ? 'border-[#FCD34D] bg-[#FEF3C7] text-[#92400E] hover:bg-[#FDE68A]/70'
              : 'border-[#E2E6E9] bg-white text-[#131A20] hover:bg-[#F5F4EE]';

  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex h-9 min-h-[36px] items-center justify-center gap-1.5 rounded-[12px] border px-3 text-[13px] font-semibold leading-4 transition disabled:cursor-not-allowed disabled:opacity-55 ${toneClasses} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />}
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  className = '',
  type = 'button',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-[12px] border border-[#E2E6E9] bg-white text-[#131A20] transition hover:bg-[#F5F4EE] disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
      {...rest}
    >
      {icon}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Cards (20px radius, 1px border, consistent padding)                 */
/* ------------------------------------------------------------------ */
export function StandardCard({
  children,
  tone = 'default',
  className = '',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'subtle' | 'mint' | 'danger' | 'warn';
  className?: string;
}) {
  const toneClasses =
    tone === 'mint'
      ? 'border-[#C5EFF2] bg-[#E9F7F7]'
      : tone === 'subtle'
        ? 'border-[#E5E4DD] bg-[#F5F4EE]'
        : tone === 'danger'
          ? 'border-[#FECACA] bg-[#FEE2E2]/60'
          : tone === 'warn'
            ? 'border-[#FCD34D] bg-[#FEF3C7]/60'
            : 'border-[#E2E6E9] bg-white';

  return (
    <div
      className={`min-w-0 break-words rounded-[20px] border p-4 shadow-card tablet:p-6 ${toneClasses} ${className}`}
    >
      {children}
    </div>
  );
}

export function InteractiveCard({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      onClick={onClick}
      className={`herway-interactive min-w-0 break-words rounded-[20px] border border-[#E2E6E9] bg-white p-4 shadow-card hover:border-[#00B6C7] tablet:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs (48-50px height, 12px radius, 1px border)                    */
/* ------------------------------------------------------------------ */
export function StandardInput({
  label,
  error,
  className = '',
  id,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | null;
}) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-[13px] font-semibold text-[#131A20]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`h-[50px] w-full rounded-[12px] border bg-[#F5F4EE] px-4 text-[15px] font-medium text-[#131A20] placeholder:text-[#768089] transition focus:border-[#00B6C7] focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:bg-[#ECEEF0] disabled:opacity-55 ${
          error ? 'border-[#DC2626]' : 'border-[#E5E4DD]'
        } ${className}`}
        {...rest}
      />
      {error && <p className="text-[13px] font-semibold text-[#DC2626]">{error}</p>}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = 'Search...',
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-[#646F78]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-[12px] border border-[#E5E4DD] bg-[#F5F4EE] pl-10 pr-10 text-[14px] font-medium text-[#131A20] placeholder:text-[#768089] transition focus:border-[#00B6C7] focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:bg-[#ECEEF0] disabled:opacity-55"
      />
      {value && (
        <button
          type="button"
          onClick={() => (onClear ? onClear() : onChange(''))}
          aria-label="Clear search"
          className="absolute right-2 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#646F78] hover:bg-white hover:text-[#131A20]"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal & BottomSheet                                                 */
/* ------------------------------------------------------------------ */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'max-w-lg',
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#131A20]/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`flex max-h-[88vh] w-full flex-col overflow-hidden rounded-[20px] border border-[#E2E6E9] bg-white p-5 shadow-card tablet:p-6 ${maxWidthClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-[18px] font-bold text-[#131A20] break-words">{title}</h3>
              {subtitle && (
                <p className="mt-0.5 text-[13px] font-medium text-[#646F78] break-words">
                  {subtitle}
                </p>
              )}
            </div>
            <IconButton icon={<X className="h-4 w-4" />} label="Close modal" onClick={onClose} />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
        {footer && <div className="mt-5 shrink-0 border-t border-[#ECEEF0] pt-4">{footer}</div>}
      </div>
    </div>
  );
}

export function BottomSheet(props: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!props.open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#131A20]/50 tablet:items-center tablet:p-4"
      onClick={props.onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[20px] border border-[#E2E6E9] bg-white p-5 shadow-card tablet:max-w-lg tablet:rounded-[20px] tablet:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-[#CFD6DC] tablet:hidden" />
        {props.title && (
          <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-[18px] font-bold text-[#131A20] break-words">{props.title}</h3>
              {props.subtitle && (
                <p className="mt-0.5 text-[13px] font-medium text-[#646F78] break-words">
                  {props.subtitle}
                </p>
              )}
            </div>
            <IconButton
              icon={<X className="h-4 w-4" />}
              label="Close sheet"
              onClick={props.onClose}
            />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{props.children}</div>
        {props.footer && (
          <div className="mt-5 shrink-0 border-t border-[#ECEEF0] pt-4">{props.footer}</div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toast, Loading, Skeleton, Empty & Error States                      */
/* ------------------------------------------------------------------ */
export function Toast({
  tone = 'info',
  message,
  onDismiss,
}: {
  tone?: 'info' | 'success' | 'error';
  message: string;
  onDismiss?: () => void;
}) {
  const palette =
    tone === 'error'
      ? 'border-[#FECACA] bg-[#FEE2E2] text-[#991B1B]'
      : tone === 'success'
        ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]'
        : 'border-[#C5EFF2] bg-[#E9F7F7] text-[#0099A8]';
  const Icon =
    tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info;

  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-3 rounded-[12px] border px-4 py-3 text-[14px] font-medium ${palette}`}
    >
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="inline-flex h-10 w-10 min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-[12px] hover:bg-black/5 tablet:h-11 tablet:w-11 tablet:min-h-[44px] tablet:min-w-[44px]"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <StandardCard className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[#0099A8]" />
      <p className="text-[14px] font-medium text-[#646F78]">{label}</p>
    </StandardCard>
  );
}

export function SkeletonLoader({
  count = 3,
  heightClass = 'h-28',
}: {
  count?: number;
  heightClass?: string;
}) {
  return (
    <div className="grid gap-4 tablet:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${heightClass} w-full animate-pulse rounded-[20px] border border-[#E2E6E9] bg-[#F5F4EE]`}
        />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <StandardCard className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C5EFF2] text-[#0099A8]">
        <Inbox className="h-6 w-6" />
      </div>
      <h3 className="text-[18px] font-bold text-[#131A20]">{title}</h3>
      {description && (
        <p className="max-w-md text-[14px] font-medium text-[#646F78]">{description}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </StandardCard>
  );
}

export function ErrorState({
  title = 'Unable to load data',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <StandardCard tone="danger" className="flex flex-col items-center justify-center gap-3 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#DC2626]">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <h3 className="text-[18px] font-bold text-[#991B1B]">{title}</h3>
      <p className="max-w-md text-[14px] font-medium text-[#991B1B]">{message}</p>
      {onRetry && (
        <SecondaryButton tone="danger" onClick={onRetry}>
          Retry
        </SecondaryButton>
      )}
    </StandardCard>
  );
}

/* ------------------------------------------------------------------ */
/* Data Collections, Filtering & Responsive DataTable                  */
/* ------------------------------------------------------------------ */
export function FilterChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition ${
              active
                ? 'border-[#131A20] bg-[#131A20] text-white'
                : 'border-[#E2E6E9] bg-white text-[#525D66] hover:bg-[#F5F4EE]'
            }`}
          >
            <span>{opt.label}</span>
            {opt.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-[#F5F4EE] text-[#646F78]'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function PaginationControls({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  loading = false,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (nextPage: number) => void;
  onPageSizeChange?: (nextSize: number) => void;
  loading?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIdx = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#E2E6E9] bg-white px-4 py-3 text-[13px] font-medium text-[#525D66]">
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing <strong className="text-[#131A20]">{startIdx}</strong>–
          <strong className="text-[#131A20]">{endIdx}</strong> of{' '}
          <strong className="text-[#131A20]">{total}</strong> records
        </span>
        {onPageSizeChange && (
          <label className="inline-flex items-center gap-1.5 text-[12px]">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-[8px] border border-[#E2E6E9] bg-[#F5F4EE] px-2 font-semibold text-[#131A20]"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-2">
        <SmallButton
          disabled={loading || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </SmallButton>
        <span className="px-2 text-[12px] font-bold text-[#131A20]">
          Page {page} of {totalPages}
        </span>
        <SmallButton
          disabled={loading || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </SmallButton>
      </div>
    </div>
  );
}

export interface DataTableColumn<T> {
  key: string;
  header: string;
  minWidthClass?: string;
  align?: 'left' | 'right';
  render: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  error = null,
  onRetry,
  emptyTitle = 'No records found',
  emptyDescription,
}: {
  columns: ReadonlyArray<DataTableColumn<T>>;
  rows: ReadonlyArray<T>;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }
  if (loading && rows.length === 0) {
    return <LoadingState label="Loading records..." />;
  }
  if (!loading && rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <StandardCard className="overflow-hidden p-0 tablet:p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-[14px]">
          <thead className="sticky top-0 z-10 border-b border-[#E2E6E9] bg-[#F5F4EE] text-[12px] font-bold uppercase tracking-wide text-[#525D66]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3.5 whitespace-nowrap ${col.minWidthClass ?? 'min-w-[140px]'} ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ECEEF0] bg-white">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="align-top transition hover:bg-[#FAF9F5]">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3.5 ${col.minWidthClass ?? ''} ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </StandardCard>
  );
}

export { Clock };
