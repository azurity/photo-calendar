import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  captionSchema,
  isSafeRepoRelativePath,
  parseManifestLenient,
  validateManifest,
} from './schema';

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));
}

describe('manifest schema', () => {
  it('accepts the empty and one-entry fixtures', () => {
    expect(validateManifest(fixture('valid-empty.json')).ok).toBe(true);
    expect(validateManifest(fixture('valid-one.json')).ok).toBe(true);
  });

  it('ignores unknown entry fields', () => {
    const result = validateManifest(fixture('valid-unknown-field.json'));
    expect(result.ok).toBe(true);
  });

  it('rejects duplicate dates', () => {
    const result = validateManifest(fixture('invalid-duplicate-date.json'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain('日期重复');
  });

  it('rejects invalid dates, paths and empty captions', () => {
    for (const name of ['invalid-date.json', 'invalid-path.json', 'invalid-caption-empty.json']) {
      const result = validateManifest(fixture(name));
      expect(result.ok, name).toBe(false);
    }
  });

  it('rejects future schema versions', () => {
    const result = validateManifest(fixture('future-version.json'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.futureVersion).toBe(true);
      expect(result.errors.join(' ')).toContain('更新客户端');
    }
  });

  it('keeps the last duplicate and warns in lenient mode', () => {
    const result = parseManifestLenient(fixture('invalid-duplicate-date.json'));
    expect(result.manifest.entries).toHaveLength(1);
    expect(result.manifest.entries[0]?.caption).toBe('第二条文案。');
    expect(result.warnings.join(' ')).toContain('重复');
  });

  it('drops invalid entries in lenient mode', () => {
    const result = parseManifestLenient(fixture('invalid-date.json'));
    expect(result.manifest.entries).toHaveLength(0);
    expect(result.warnings).not.toHaveLength(0);
  });

  it('checks paths and captions directly', () => {
    expect(isSafeRepoRelativePath('data/photos/2026-11-08-a1b2c3d4.webp')).toBe(true);
    expect(isSafeRepoRelativePath('../secret.png')).toBe(false);
    expect(isSafeRepoRelativePath('C:\\photo.jpg')).toBe(false);
    expect(captionSchema.safeParse('普通的一句话。').success).toBe(true);
    expect(captionSchema.safeParse('<script>alert(1)</script>').success).toBe(false);
    expect(captionSchema.safeParse('字'.repeat(121)).success).toBe(false);
    expect(captionSchema.safeParse('第一行\n第二行').success).toBe(false);
  });

  it('keeps the documented example valid and identical to its fixture', () => {
    const markdown = readFileSync(
      new URL('../../../docs/data-contract.md', import.meta.url),
      'utf8',
    );
    const match = /```json\n([\s\S]*?)```/.exec(markdown);
    expect(match).not.toBeNull();
    const documented = JSON.parse(match?.[1] ?? '{}');
    expect(documented).toEqual(fixture('valid-doc-example.json'));
    expect(validateManifest(documented).ok).toBe(true);
  });
});
