import type { ValueTransformer } from 'typeorm';

/**
 * TypeORM returns `bigint` columns as `string` by default (unlike TypeORM,
 * which returns native JS `bigint`). `src/common/money.ts` is built
 * entirely on `bigint` (`export type Irr = bigint`), so every money column
 * needs this transformer to keep that contract unchanged across the
 * TypeORM/TypeORM coexistence period.
 */
export const bigintTransformer: ValueTransformer = {
  to: (value?: bigint | null) => value ?? null,
  from: (value?: string | null) => (value == null ? null : BigInt(value)),
};
