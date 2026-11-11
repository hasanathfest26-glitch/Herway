export interface DobValidationResult {
  valid: boolean;
  isoDate?: string;
  error?: string;
}

const MIN_YEAR = 1900;

export function getMaxDobIso(minAgeYears = 13): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - minAgeYears);
  return d.toISOString().slice(0, 10);
}

/**
 * Auto-formats raw numeric input into YYYY-MM-DD (or DD/MM/YYYY) while blocking non-date characters.
 */
export function formatDobTyping(raw: string, format: 'YYYY-MM-DD' | 'DD/MM/YYYY'): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (format === 'YYYY-MM-DD') {
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

export function formatIsoToDisplayDob(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  return trimmed;
}

/**
 * Strictly validates real calendar dates (leap years, days-in-month, no future/unreasonable dates).
 * Supports both YYYY-MM-DD and DD/MM/YYYY inputs.
 */
export function validateDob(
  rawInput: string,
  expectedFormat: 'YYYY-MM-DD' | 'DD/MM/YYYY' = 'YYYY-MM-DD',
  required = false,
): DobValidationResult {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return required
      ? { valid: false, error: 'Please enter your date of birth.' }
      : { valid: true };
  }

  let year: number;
  let month: number;
  let day: number;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else if (dmyMatch) {
    day = Number(dmyMatch[1]);
    month = Number(dmyMatch[2]);
    year = Number(dmyMatch[3]);
  } else {
    return {
      valid: false,
      error: `Enter a complete valid date as ${expectedFormat}.`,
    };
  }

  const maxYear = new Date().getFullYear();
  if (year < MIN_YEAR || year > maxYear) {
    return {
      valid: false,
      error: `Year must be between ${MIN_YEAR} and ${maxYear}.`,
    };
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return {
      valid: false,
      error: 'Enter a real calendar month (01-12) and day.',
    };
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return {
      valid: false,
      error: `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year} is not a valid calendar date.`,
    };
  }

  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (utcDate.getTime() > todayUtc) {
    return {
      valid: false,
      error: 'Date of birth cannot be in the future.',
    };
  }

  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { valid: true, isoDate };
}
