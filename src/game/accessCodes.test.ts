import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findMatchingActiveCode,
  generateAccessCode,
  normalizeAccessCode,
  validateAccessCodeFormat,
  validatePlayerDisplayName,
} from './accessCodes';
import type { AccessCodeRecord } from './types';

test('normalizeAccessCode uppercases and strips spaces', () => {
  assert.equal(normalizeAccessCode('  flow-2026  '), 'FLOW-2026');
  assert.equal(normalizeAccessCode('ab 12'), 'AB12');
});

test('validateAccessCodeFormat accepts valid codes and rejects invalid ones', () => {
  assert.equal(validateAccessCodeFormat('FLOW-2026').valid, true);
  assert.equal(validateAccessCodeFormat('ab').valid, false);
  assert.equal(validateAccessCodeFormat('کۆد123').valid, false);
});

test('generateAccessCode creates valid formatted codes', () => {
  const code = generateAccessCode('KURD');
  assert.ok(code.startsWith('KURD-'));
  assert.equal(validateAccessCodeFormat(code).valid, true);
});

test('validatePlayerDisplayName validates length and blocks reserved admin names', () => {
  assert.equal(validatePlayerDisplayName('سارا').valid, true);
  assert.equal(validatePlayerDisplayName('ئ').valid, false);
  assert.equal(validatePlayerDisplayName('admin').valid, false);
  assert.equal(validatePlayerDisplayName('ئەدمین').valid, false);
});

test('findMatchingActiveCode matches active codes case-insensitively and ignores disabled codes', () => {
  const list: AccessCodeRecord[] = [
    { id: '1', code: 'FLOW-2026', label: 'Active', isActive: true, usageCount: 2, createdAt: '' },
    { id: '2', code: 'OLD-9999', label: 'Disabled', isActive: false, usageCount: 5, createdAt: '' },
  ];
  assert.equal(findMatchingActiveCode(list, ' flow-2026 ')?.id, '1');
  assert.equal(findMatchingActiveCode(list, 'OLD-9999'), null);
  assert.equal(findMatchingActiveCode(list, 'UNKNOWN'), null);
});
