import { createHash } from 'node:crypto';

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, normalize(item)]),
  );
}

export function stableJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function fingerprint(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}
