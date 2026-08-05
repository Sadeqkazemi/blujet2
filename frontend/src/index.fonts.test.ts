import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');

describe('self-hosted panel fonts', () => {
  it('ships Vazirmatn + Roboto Mono files under public/fonts', () => {
    const required = [
      'vazirmatn-arabic-wght-normal.woff2',
      'vazirmatn-latin-wght-normal.woff2',
      'vazirmatn-latin-ext-wght-normal.woff2',
      'roboto-mono-latin-400-normal.woff2',
      'roboto-mono-latin-500-normal.woff2',
      'roboto-mono-latin-700-normal.woff2',
    ];
    for (const name of required) {
      expect(existsSync(resolve(ROOT, 'public/fonts', name)), name).toBe(true);
    }
  });

  it('loads fonts from /fonts and maps .font-num to Vazirmatn (not Roboto Mono alone)', () => {
    const css = readFileSync(resolve(ROOT, 'src/index.css'), 'utf8');
    expect(css).toContain("url('/fonts/vazirmatn-arabic-wght-normal.woff2')");
    expect(css).toContain("url('/fonts/roboto-mono-latin-700-normal.woff2')");
    expect(css).toMatch(/\.font-num\s*\{[^}]*font-family:\s*var\(--font-sans\)/s);
    expect(css).toMatch(/\.ltr\.font-num\s*\{[^}]*font-family:\s*var\(--font-mono\)/s);
  });
});
