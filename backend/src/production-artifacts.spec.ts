import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const backendRoot = process.cwd();
const packageJson = JSON.parse(
  readFileSync(join(backendRoot, 'package.json'), 'utf8'),
) as { scripts: Record<string, string> };
const dockerfile = readFileSync(join(backendRoot, 'Dockerfile'), 'utf8');
const entrypoint = readFileSync(
  join(backendRoot, 'docker-entrypoint.sh'),
  'utf8',
);
const compose = readFileSync(
  join(backendRoot, '..', 'docker-compose.prod.yml'),
  'utf8',
);
const seedSource = readFileSync(
  join(backendRoot, 'src', 'database', 'seed.ts'),
  'utf8',
);
const resetSource = readFileSync(
  join(backendRoot, 'src', 'database', 'production-data-reset.ts'),
  'utf8',
);

describe('production backend artifacts', () => {
  it('uses the JavaScript layout emitted by nest build', () => {
    expect(packageJson.scripts['migration:run:prod']).toContain(
      'dist/database/data-source.js',
    );
    expect(packageJson.scripts['seed:prod']).toContain('dist/database/seed.js');
    expect(dockerfile).toContain('CMD ["node", "dist/main.js"]');
  });

  it('does not reference the stale dist/src layout', () => {
    const productionCommands = [
      packageJson.scripts['migration:run:prod'],
      packageJson.scripts['seed:prod'],
      dockerfile,
    ].join('\n');

    expect(productionCommands).not.toContain('dist/src/');
  });

  it('fails closed instead of seeding or simulating payment in production', () => {
    expect(entrypoint).toContain(
      'SEED_ON_START=true is forbidden in production',
    );
    expect(entrypoint).not.toContain('npm run seed:prod || true');
    expect(seedSource).toContain("process.env.NODE_ENV === 'production'");
    expect(seedSource).toContain('Demo seed is forbidden');
    expect(compose).toContain('SMS_PROVIDER: kavenegar');
    expect(compose).toContain('PAYMENT_GATEWAY: ${PAYMENT_GATEWAY:-disabled}');
    expect(compose).not.toContain('PAYMENT_GATEWAY: sandbox');
    expect(packageJson.scripts['data:audit:prod']).toContain(
      'production-data-reset.js',
    );
    expect(resetSource).toContain('PRODUCTION_RESET_BACKUP_REF');
    expect(resetSource).toContain('PRODUCTION_RESET_CONFIRM');
    expect(resetSource).toContain('Dry run only');
  });
});
