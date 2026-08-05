import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const backendRoot = process.cwd();
const packageJson = JSON.parse(
  readFileSync(join(backendRoot, 'package.json'), 'utf8'),
) as { scripts: Record<string, string> };
const dockerfile = readFileSync(join(backendRoot, 'Dockerfile'), 'utf8');

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
});
