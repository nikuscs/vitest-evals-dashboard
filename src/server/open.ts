import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { match } from 'ts-pattern';
import type { EvalCase, OpenApp } from '#/shared/report.types.ts';

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const onPath = (command: string) => {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

// Zed's macOS app ships its command line tool inside the bundle, so it works without `zed` on the PATH.
const ZED_APPS = ['/Applications/Zed.app/Contents/MacOS/cli', '/Applications/Zed Preview.app/Contents/MacOS/cli'];

// The line of a case's test in its file: `'ID: …'` or the exact title.
function lineOf(file: string, caseId: string): number {
  const pattern = new RegExp(`['"\`]${escape(caseId)}[:'"\`]`);
  const index = readFileSync(file, 'utf8')
    .split('\n')
    .findIndex((line) => pattern.test(line));

  return index + 1 || 1;
}

// Opens a case's test file on the machine running the dashboard, in the editors it has.
export function createOpener(cases: () => Promise<EvalCase[]>) {
  const zed = ZED_APPS.find((path) => existsSync(path)) ?? (onPath('zed') ? 'zed' : undefined);

  const editors: Partial<Record<OpenApp, string>> = {
    ...(onPath('cursor') ? { cursor: 'cursor' } : {}),
    ...(onPath('code') ? { code: 'code' } : {}),
    ...(zed ? { zed } : {}),
  };

  const apps: OpenApp[] = [...(Object.keys(editors) as OpenApp[]), 'folder'];

  const open = async (caseId: string, app: OpenApp): Promise<string> => {
    const found = (await cases()).find((item) => item.id === caseId);

    if (!found || !existsSync(found.file)) {
      throw new Error(`${caseId} is not in this project's tests.`);
    }

    const target = `${found.file}:${lineOf(found.file, caseId)}`;

    const { command, args } = match(app)
      .with('cursor', 'code', () => ({ command: editors[app], args: ['-g', target] }))
      .with('zed', () => ({ command: editors.zed, args: [target] }))
      .with('folder', () => match(process.platform)
        .with('darwin', () => ({ command: 'open', args: ['-R', found.file] }))
        .with('win32', () => ({ command: 'explorer', args: [`/select,${found.file}`] }))
        .otherwise(() => ({ command: 'xdg-open', args: [dirname(found.file)] })))
      .exhaustive();

    if (!command) {
      throw new Error(`${app} is not installed on this machine.`);
    }

    return new Promise((resolve, reject) => {
      execFile(command, args, { shell: process.platform === 'win32' && app !== 'folder' }, (error) => {
        // Explorer exits with 1 even when it opened the folder.
        if (error && !(app === 'folder' && process.platform === 'win32')) {
          reject(new Error(`Could not open ${app}: ${error.message}`));
          return;
        }
        resolve(target);
      });
    });
  };

  return { apps, open };
}
