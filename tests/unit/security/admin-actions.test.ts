import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Every Server Action under app/actions/admin is a public POST endpoint — the
 * proxy does not cover it. Each exported action must therefore be built with
 * adminAction(), which checks a permission first, or call requirePermission()
 * / requireAdminActor() itself. This scan fails the build for one that does
 * neither, so a new action cannot ship unguarded by accident.
 */
const DIR = join(process.cwd(), 'app', 'actions', 'admin');

const files = readdirSync(DIR).filter((name) => name.endsWith('.ts'));

describe('admin server actions', () => {
  it.each(files)('%s guards every export', (name) => {
    const source = readFileSync(join(DIR, name), 'utf8').replace(/\r\n/g, '\n');

    for (const match of source.matchAll(/export const (\w+)\s*=\s*([\w.]+)\(/g)) {
      expect(match[2], `${match[1]} in ${name}`).toBe('adminAction');
    }

    for (const match of source.matchAll(/export async function (\w+)[\s\S]*?\n}\n/g)) {
      expect(match[0], `${match[1]} in ${name}`).toMatch(/require(Permission|AdminActor)\(/);
    }
  });
});
