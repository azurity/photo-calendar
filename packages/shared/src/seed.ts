export function hash32(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function deterministicIndex(date: string, domain: string, length: number): number {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('length must be a positive integer');
  }
  return hash32(`${date}|${domain}|v1`) % length;
}

export function deterministicSeed(date: string): number {
  return hash32(`${date}|seed|v1`) || 1;
}

export function deterministicPick<T>(date: string, domain: string, items: readonly T[]): T {
  if (items.length === 0) throw new Error('items must not be empty');
  return items[deterministicIndex(date, domain, items.length)] as T;
}
