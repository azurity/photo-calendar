import { deterministicIndex, deterministicSeed } from '@photo-calendar/shared';
import { FALLBACK_CONTENT_VERSION, PHRASES } from './phrases';
import { PATTERNS, type FallbackPattern } from './patterns';

export interface FallbackContent {
  phrase: string;
  pattern: FallbackPattern;
  seed: number;
  contentVersion: number;
}

export { FALLBACK_CONTENT_VERSION, PHRASES, PATTERNS };
export type { FallbackPattern };

/**
 * 只依赖日期字符串与固定内容库。同一部署版本内，同一天永远得到同样的结果。
 */
export function fallbackFor(date: string): FallbackContent {
  const phraseIndex = deterministicIndex(date, 'phrase', PHRASES.length);
  const patternIndex = deterministicIndex(date, 'pattern', PATTERNS.length);
  return {
    phrase: PHRASES[phraseIndex] as string,
    pattern: PATTERNS[patternIndex] as FallbackPattern,
    seed: deterministicSeed(date),
    contentVersion: FALLBACK_CONTENT_VERSION,
  };
}
