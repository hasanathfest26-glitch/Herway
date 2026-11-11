import React from 'react';
import { StatusBadge, StatusTone } from '@/components/ui/StatusBadge';

export function StatusPill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: StatusTone;
}) {
  return <StatusBadge label={label} tone={tone} />;
}
