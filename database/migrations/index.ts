import { migration001 } from './001_initial';
import type { Migration } from './types';

/** Ordered list of migrations. Append new migrations here, never edit released ones. */
export const MIGRATIONS: readonly Migration[] = [migration001];

export type { Migration };
