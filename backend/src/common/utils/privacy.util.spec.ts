import { decryptSensitiveValue, encryptSensitiveValue } from './crypto.util';
import { coarsenCoordinate, haversineDistanceKm } from './geo.util';
import { isAdult18Plus, sanitizeChatBody } from './privacy.util';

describe('Privacy, Geo & Crypto Utilities', () => {
  it('masks personal phone numbers inside in-app chat messages', () => {
    const res = sanitizeChatBody('Call me on +91 98470 11223 near Fort Kochi beach');
    expect(res.masked).toBe(true);
    expect(res.sanitized).toContain('[phone number hidden for your safety]');
    expect(res.sanitized).not.toContain('98470');
  });

  it('keeps normal non-phone numbers intact in chat messages', () => {
    const res = sanitizeChatBody('Meet at Gate 2 at 10 AM with 3 friends');
    expect(res.masked).toBe(false);
    expect(res.sanitized).toBe('Meet at Gate 2 at 10 AM with 3 friends');
  });

  it('validates 18+ adult age accurately', () => {
    const ref = new Date('2026-11-10T00:00:00Z');
    expect(isAdult18Plus('2008-11-10', ref)).toBe(true);
    expect(isAdult18Plus('2008-11-11', ref)).toBe(false);
  });

  it('round-trips AES-256-GCM encrypted metadata cleanly', () => {
    const encrypted = encryptSensitiveValue('passport-dek-secret');
    const plain = decryptSensitiveValue(encrypted.cipherText, encrypted.iv);
    expect(plain).toBe('passport-dek-secret');
  });

  it('coarsens coordinates and calculates Kochi-Munnar haversine distance', () => {
    expect(coarsenCoordinate(9.9658123)).toBe(9.97);
    const km = haversineDistanceKm(9.9658, 76.2421, 10.0889, 77.0595);
    expect(km).toBeGreaterThan(80);
    expect(km).toBeLessThan(110);
  });
});
