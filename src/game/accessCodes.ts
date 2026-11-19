import type { AccessCodeRecord } from './types';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeAccessCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function validateAccessCodeFormat(raw: string): { valid: boolean; normalized: string; errorKu?: string } {
  const normalized = normalizeAccessCode(raw);
  if (normalized.length < 4 || normalized.length > 20) {
    return {
      valid: false,
      normalized,
      errorKu: 'کۆدەکە دەبێت لە نێوان ٤ بۆ ٢٠ پیت یان ژمارە بێت.',
    };
  }
  if (!/^[A-Z0-9-]+$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      errorKu: 'کۆدەکە تەنها دەتوانێت پیتی ئینگلیزی، ژمارە و هێڵ (-) لەخۆبگرێت.',
    };
  }
  return { valid: true, normalized };
}

export function generateAccessCode(prefix = 'FLOW'): string {
  const cleanPrefix = normalizeAccessCode(prefix).replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'FLOW';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `${cleanPrefix}-${suffix}`;
}

export function validatePlayerDisplayName(raw: string): { valid: boolean; name: string; errorKu?: string } {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 24) {
    return {
      valid: false,
      name,
      errorKu: 'ناوی یاریزان دەبێت لە نێوان ٢ بۆ ٢٤ پیت بێت.',
    };
  }
  if (name.toLowerCase() === 'admin' || name === 'ئەدمین') {
    return {
      valid: false,
      name,
      errorKu: 'ئەم ناوە تایبەتە بە ئەدمین؛ تکایە ناوێکی تر هەڵبژێرە.',
    };
  }
  return { valid: true, name };
}

export function findMatchingActiveCode(
  codes: AccessCodeRecord[],
  rawInput: string
): AccessCodeRecord | null {
  const normalized = normalizeAccessCode(rawInput);
  if (!normalized) return null;
  return codes.find((c) => c.isActive && normalizeAccessCode(c.code) === normalized) ?? null;
}
