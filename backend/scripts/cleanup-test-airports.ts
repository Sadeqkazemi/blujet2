/**
 * Removes e2e/dev fixture airports (شهر آزمایش / شهر تست) from the DB and
 * clears the public airports search cache.
 *
 * Run: cd backend && npx tsx scripts/cleanup-test-airports.ts
 */
import 'dotenv/config';
import Redis from 'ioredis';
import { TypeORMPg } from '@typeorm/adapter-pg';
import { TypeORMClient } from '../generated/typeorm/client';
import { cleanupTestAirports } from '../src/common/cleanup-test-airports';

const typeorm = new TypeORMClient({
  adapter: new TypeORMPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const removed = await cleanupTestAirports(typeorm);
  console.log(`Removed ${removed} test airport(s).`);

  if (process.env.REDIS_URL) {
    const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
    try {
      await redis.del('search:airports');
      console.log('Cleared search:airports cache.');
    } finally {
      redis.disconnect();
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => typeorm.$disconnect());
