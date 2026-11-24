import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { vitestArgs } from '#/server/settings.ts';
import { splitTitle, suiteOf } from '#/shared/report.ts';
import type { Settings } from '#/server/settings.ts';
import type { EvalCase } from '#/shared/report.types.ts';

// Every test case Vitest finds in the project. `vitest list` only collects the files, so no model is called.
export function createCases(settings: Settings) {
  let pending: Promise<EvalCase[]> | undefined;

  const load = async () => {
    const dir = await mkdtemp(join(tmpdir(), 'evals-dashboard-'));
    const file = join(dir, 'list.json');

    try {
      await promisify(execFile)(settings.vitest.command, vitestArgs(settings, ['list', `--json=${file}`]), {
        cwd: settings.root,
        maxBuffer: 32 * 1024 * 1024,
        shell: process.platform === 'win32',
      });
      const listed = JSON.parse(await readFile(file, 'utf8')) as { name: string; file: string }[];
      const cases = new Map<string, EvalCase>();

      for (const test of listed) {
        const { caseId, title } = splitTitle(test.name.split(' > ').at(-1) ?? test.name);

        if (!cases.has(caseId)) {
          cases.set(caseId, { id: caseId, title, suite: suiteOf(test.file), file: test.file });
        }
      }

      return [...cases.values()];
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };

  return {
    get(refresh = false) {
      if (refresh || !pending) {
        pending = load().catch((error: unknown) => {
          pending = undefined;
          throw error;
        });
      }
      return pending;
    },
  };
}
