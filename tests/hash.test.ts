import { createHash, createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hmacSha256, sha256Hex, toHex } from '../src/domain/hash.js';

describe('eigenes SHA-256/HMAC entspricht node:crypto', () => {
  it('bekannte Werte und Grenzlängen (55/56/64 Byte)', () => {
    for (const s of ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'Übelkeit – Größe €', 'x'.repeat(1000)]) {
      expect(sha256Hex(s)).toBe(createHash('sha256').update(s).digest('hex'));
    }
  });
  it('zufällige Daten', () => {
    for (let i = 0; i < 20; i++) {
      const d = randomBytes(i * 37);
      expect(sha256Hex(d)).toBe(createHash('sha256').update(d).digest('hex'));
    }
  });
  it('HMAC mit kurzem und langem Schlüssel', () => {
    for (const key of [randomBytes(16), randomBytes(64), randomBytes(100)]) {
      expect(toHex(hmacSha256(key, '99001'))).toBe(createHmac('sha256', key).update('99001').digest('hex'));
    }
  });
});
