/** Helpers to convert between SQLite rows and domain values. */

export const toBool = (value: number | null | undefined): boolean => value === 1;
export const fromBool = (value: boolean): number => (value ? 1 : 0);

/** Converts SQL NULL to `undefined` (for optional model fields). */
export function optional<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined ? undefined : value;
}

/** Builds "?, ?, ?" for IN clauses. */
export function placeholders(count: number): string {
  return new Array(count).fill('?').join(', ');
}
