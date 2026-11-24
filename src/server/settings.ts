import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const HELP = `vitest-evals-dashboard [options] [-- vitest args]

Runs the Vitest evals of the project in the current folder, compares runs with a baseline and re-runs cases.

Options:
  --port <port>         Port to listen on (default: 4320)
  --host <host>         Host to listen on (default: 127.0.0.1)
  --project <name>      Only run this Vitest project
  --models <a,b>        Models the new-run form offers; each picked model runs the evals once
  --models-env <NAME>   Environment variable that carries the picked model to the evals
  --judges <a,b>        Judge models the new-run form offers
  --judge-env <NAME>    Environment variable that carries the picked judge to the evals
  --import <file>       Vitest JSON report to load as a run (repeatable)
  --label <name>        Name for each imported run, in --import order (repeatable)
  --baseline            Mark the first imported run as the baseline
  --allowed-hosts <a,b> Extra host names allowed to reach it, such as my-box.local or .ts.net for every Tailscale name
  --data <dir>          Where runs are kept (default: ~/.cache/vitest-evals-dashboard/<repo>)
  -h, --help            Show this help

Anything after -- is passed to every vitest run and vitest list.`;

const list = (value: string | undefined) => (value ?? '').split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const git = (root: string, args: string[]) => {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return undefined;
  }
};

// The project's own Vitest: the nearest node_modules/.bin/vitest above the folder, else npx.
function vitestCommand(root: string): { command: string; args: string[] } {
  const bin = process.platform === 'win32' ? 'vitest.cmd' : 'vitest';

  for (let dir = root; ; dir = dirname(dir)) {
    const file = join(dir, 'node_modules', '.bin', bin);

    if (existsSync(file)) {
      return { command: file, args: [] };
    }

    if (dirname(dir) === dir) {
      return { command: process.platform === 'win32' ? 'npx.cmd' : 'npx', args: ['vitest'] };
    }
  }
}

export function readSettings(argv = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      port: { type: 'string', default: '4320' },
      host: { type: 'string', default: '127.0.0.1' },
      project: { type: 'string' },
      models: { type: 'string' },
      'models-env': { type: 'string' },
      judges: { type: 'string' },
      'judge-env': { type: 'string' },
      import: { type: 'string', multiple: true },
      label: { type: 'string', multiple: true },
      baseline: { type: 'boolean', default: false },
      'allowed-hosts': { type: 'string' },
      data: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    process.stdout.write(`${HELP}\n`);
    process.exit(0);
  }

  const models = list(values.models);
  const judges = list(values.judges);

  if (models.length && !values['models-env']) {
    throw new Error('--models needs --models-env: the environment variable your evals read the model from.');
  }

  if (judges.length && !values['judge-env']) {
    throw new Error('--judges needs --judge-env: the environment variable your evals read the judge from.');
  }

  const root = process.cwd();
  const gitRoot = git(root, ['rev-parse', '--show-toplevel']);
  const commonDir = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  // Every branch and worktree of a repo shares its runs.
  const repoName = commonDir ? basename(dirname(commonDir)) : basename(root);
  // origin's default branch when it is known, else git's default for new repos, else main.
  const defaultBranch = git(root, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'])?.replace(/^origin\//, '')
    ?? git(root, ['config', 'init.defaultBranch'])
    ?? 'main';

  return {
    port: Number(values.port),
    host: values.host,
    root,
    gitRoot,
    defaultBranch,
    allowedHosts: list(values['allowed-hosts']),
    dataDir: resolve(values.data ?? join(homedir(), '.cache', 'vitest-evals-dashboard', repoName)),
    vitest: vitestCommand(root),
    project: values.project,
    vitestArgs: positionals,
    models,
    modelsEnv: values['models-env'],
    judges,
    judgeEnv: values['judge-env'],
    imports: (values.import ?? []).map((file, index) => ({
      file: resolve(file),
      label: values.label?.[index] ?? basename(file),
      baseline: values.baseline && index === 0,
    })),
  };
}

export type Settings = ReturnType<typeof readSettings>;

// The arguments every vitest command shares: the project and whatever came after --.
export const vitestArgs = (settings: Settings, command: string[]) => [
  ...settings.vitest.args,
  ...command,
  ...(settings.project ? ['--project', settings.project] : []),
  ...settings.vitestArgs,
];
