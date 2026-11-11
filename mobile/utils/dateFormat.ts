/**
 * Consistent date and time formatting utilities across Herway mobile/web views.
 * Never throws on malformed or missing dates.
 */

export function parseValidDate(iso?: string | Date | null): Date | null {
  if (!iso) return null;
  const date = iso instanceof Date ? iso : new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateShort(iso?: string | Date | null): string {
  const d = parseValidDate(iso);
  if (!d) return 'Date TBD';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTimeShort(iso?: string | Date | null): string {
  const d = parseValidDate(iso);
  if (!d) return '';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatBookingWindow(
  startIso?: string | Date | null,
  endIso?: string | Date | null,
): string {
  const start = parseValidDate(startIso);
  if (!start) return 'Schedule TBD';
  const dateStr = start.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const startTime = formatTimeShort(start);
  const end = parseValidDate(endIso);
  if (!end) {
    return `${dateStr} • ${startTime}`;
  }
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameDay) {
    return `${dateStr} • ${startTime} – ${formatTimeShort(end)}`;
  }
  const endDateStr = end.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
  return `${dateStr} ${startTime} → ${endDateStr} ${formatTimeShort(end)}`;
}

export function formatRelativeTime(iso?: string | Date | null): string {
  const d = parseValidDate(iso);
  if (!d) return '';
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDateShort(d);
}
