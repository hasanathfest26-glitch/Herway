const PHONE_PATTERNS = [
  /(\+?\d[\d\s\-().]{7,}\d)/g,
];

/**
 * Masks phone numbers inside in-app Travel Buddy chat messages so personal phone numbers
 * are not shared directly within chat threads.
 */
export function sanitizeChatBody(body: string): { sanitized: string; masked: boolean } {
  let sanitized = body;
  let masked = false;

  for (const pattern of PHONE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      const digitsOnly = match.replace(/\D/g, '');
      if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
        masked = true;
        return '[phone number hidden for your safety]';
      }
      return match;
    });
  }

  return { sanitized, masked };
}

/**
 * Checks whether the user is at least 18 years old as of referenceDate.
 */
export function isAdult18Plus(dateOfBirth?: Date | string | null, referenceDate = new Date()): boolean {
  if (!dateOfBirth) return false;
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  if (Number.isNaN(dob.getTime())) return false;

  let age = referenceDate.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = referenceDate.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age >= 18;
}
