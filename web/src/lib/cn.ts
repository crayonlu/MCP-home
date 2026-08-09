export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter((value): value is string => typeof value === 'string').join(' ');
}
