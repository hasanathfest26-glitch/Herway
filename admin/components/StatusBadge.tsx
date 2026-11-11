import { AlertCircle, CheckCircle2, Clock, Info, ShieldAlert } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
}

const STYLE_MAP: Record<string, { cls: string; tone: 'safe' | 'warn' | 'danger' | 'info' }> = {
  APPROVED: { cls: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]', tone: 'safe' },
  ACTIVE: { cls: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]', tone: 'safe' },
  LIVE_UPDATING: { cls: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]', tone: 'safe' },
  CONFIRMED: { cls: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]', tone: 'safe' },
  RESOLVED: { cls: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]', tone: 'safe' },
  COMPLETED: { cls: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]', tone: 'safe' },
  NOT_UPDATING: { cls: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]', tone: 'warn' },
  PENDING: { cls: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]', tone: 'warn' },
  UNDER_REVIEW: { cls: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]', tone: 'warn' },
  PAUSED: { cls: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]', tone: 'warn' },
  REQUESTED: { cls: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]', tone: 'warn' },
  ACCEPTED: { cls: 'bg-[#E9F7F7] text-[#0099A8] border-[#C5EFF2]', tone: 'info' },
  ACKNOWLEDGED: { cls: 'bg-[#E9F7F7] text-[#0099A8] border-[#C5EFF2]', tone: 'info' },
  REJECTED: { cls: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]', tone: 'danger' },
  SUSPENDED: { cls: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]', tone: 'danger' },
  REVOKED: { cls: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]', tone: 'danger' },
  CANCELLED: { cls: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]', tone: 'danger' },
  TRIGGERED: { cls: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]', tone: 'danger' },
  OPEN: { cls: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]', tone: 'danger' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const entry = STYLE_MAP[status];
  const classes = entry?.cls ?? 'bg-[#F5F4EE] text-[#525D66] border-[#E5E4DD]';
  const Icon =
    entry?.tone === 'safe'
      ? CheckCircle2
      : entry?.tone === 'warn'
        ? Clock
        : entry?.tone === 'danger'
          ? status === 'TRIGGERED'
            ? ShieldAlert
            : AlertCircle
          : Info;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-bold leading-4 ${classes}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{status.replace(/_/g, ' ')}</span>
    </span>
  );
}
