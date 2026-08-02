import type { DataSourceOptions } from 'typeorm';
import { ContactMessage } from './entities/contact-message.entity';
import { SeatLock } from './entities/seat-lock.entity';
import { FareRule } from './entities/fare-rule.entity';
import { CareersSettings } from './entities/careers-settings.entity';

/**
 * Phase 0 spike only — entities list is intentionally the 4 proof-of-concept
 * tables, not the full 77-model schema. `synchronize` stays false forever:
 * schema changes only ever happen through hand-run migrations (mirrors
 * CLAUDE.md's TypeORM rule "never `db push`, never manual SQL").
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: false,
  entities: [ContactMessage, SeatLock, FareRule, CareersSettings],
  migrations: [],
};
