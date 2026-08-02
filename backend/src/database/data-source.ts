import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source.options';

/** Entry point for the `typeorm` CLI (unused in Phase 0 — no migrations
 * exist yet; `dataSourceOptions.migrations` is empty and `synchronize` is
 * always false). Kept here now so later phases don't need to introduce a
 * new file/import path. */
export default new DataSource(dataSourceOptions);
