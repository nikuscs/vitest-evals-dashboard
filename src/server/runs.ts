import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { vitestArgs } from '#/server/settings.ts';
import { baselineDelta, caseFilterFor, caseFromRaw, casesFromVitestJson, modelFamily, pickedCases, totalCost, verdicts } from '#/shared/report.ts';
import type { Settings } from '#/server/settings.ts';
import type { RawCase } from '#/shared/report.ts';
import type * as ReportTypes from '#/shared/report.types.ts';

interface RunsOptions {
  settings: Settings;
  reporterPath: string;
  prices: () => ReportTypes.Prices;
  onEvent: (event: ReportTypes.ServerEvent) => void;
}

interface Job {
  // The model passed to the evals; none when the dashboard was started without --models.
  model?: string;
  caseFilter?: string;
  attempt: number;
  family?: string;
}

interface Worker {
  queue: Job[];
  stop?: () => void;
}

type ReporterEvent = (Omit<RawCase, 'state' | 'durationMs' | 'errors' | 'meta'> & { type: 'start' }) | (RawCase & { type: 'result' });

export function createRuns(options: RunsOptions) {
  const { settings } = options;
  const runs = new Map<string, ReportTypes.Run>();
  const workers = new Map<string, Worker>();
  mkdirSync(settings.dataDir, { recursive: true });

  const dirOf = (id: string) => join(settings.dataDir, id);

  const summarize = (run: ReportTypes.Run): ReportTypes.RunSummary => {
    const done = verdicts(run.cases).filter((result) => result.status === 'passed' || result.status === 'failed');
    const { cases: _cases, ...rest } = run;
    const baseline = [...runs.values()].find((item) => item.baseline);
    const delta = baseline && baseline.id !== run.id ? baselineDelta(baseline.cases, run.cases) : undefined;
    return {
      ...rest,
      baselineDelta: delta,
      cost: totalCost(run.cases, options.prices()),
      queued: workers.get(run.id)?.queue.length ?? 0,
      total: done.length,
      passed: done.filter((result) => result.status === 'passed').length,
      failed: done.filter((result) => result.status === 'failed').length,
    };
  };

  const save = (run: ReportTypes.Run) => {
    mkdirSync(dirOf(run.id), { recursive: true });
    const file = join(dirOf(run.id), 'run.json');
    writeFileSync(`${file}.tmp`, JSON.stringify({ ...summarize(run), cases: run.cases }));
    renameSync(`${file}.tmp`, file);
  };

  const publish = (run: ReportTypes.Run) => options.onEvent({ type: 'run', run: summarize(run) });

  const upsert = (run: ReportTypes.Run, result: ReportTypes.CaseResult) => {
    const index = run.cases.findIndex((existing) => existing.id === result.id);

    if (index === -1) {
      run.cases.push(result);
    } else {
      run.cases[index] = result;
    }
    options.onEvent({ type: 'case', runId: run.id, result });
  };

  const remove = (run: ReportTypes.Run, match: (result: ReportTypes.CaseResult) => boolean) => {
    const ids = run.cases
      .filter(match)
      .map((result) => result.id);

    if (!ids.length) {
      return;
    }
    run.cases = run.cases.filter((result) => !ids.includes(result.id));
    options.onEvent({ type: 'remove', runId: run.id, ids });
  };

  const markBaseline = (id: string) => {
    if (!runs.has(id)) {
      return;
    }

    for (const run of runs.values()) {
      const baseline = run.id === id;

      if (run.baseline !== baseline) {
        run.baseline = baseline;
        save(run);
      }
    }

    for (const run of runs.values()) {
      publish(run);
    }
  };

  for (const id of existsSync(settings.dataDir) ? readdirSync(settings.dataDir) : []) {
    const file = join(settings.dataDir, id, 'run.json');

    if (!existsSync(file)) {
      continue;
    }

    let run: ReportTypes.Run;

    try {
      run = JSON.parse(readFileSync(file, 'utf8')) as ReportTypes.Run;
    } catch {
      continue;
    }
    run.cases = run.cases
      .filter((result) => result.status !== 'running' && result.status !== 'queued');
    if (run.state === 'running') {
      run.state = run.cases.length ? 'finished' : 'failed';
    }
    runs.set(run.id, run);
  }

  const gitState = (): ReportTypes.GitState | undefined => {
    try {
      const git = (...args: string[]) => execFileSync('git', args, { cwd: settings.gitRoot ?? settings.root, encoding: 'utf8' }).trim();
      return {
        branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
        commit: git('rev-parse', '--short', 'HEAD'),
        dirty: git('status', '--porcelain').length > 0,
      };
    } catch {
      return undefined;
    }
  };

  // A timestamp, with a counter when two runs start in the same millisecond (such as two --import files).
  const newId = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    let id = stamp;

    for (let index = 1; runs.has(id); index += 1) {
      id = `${stamp}-${index}`;
    }
    return id;
  };

  const pump = async (run: ReportTypes.Run, file: string, attempt: number, offset: number, runModel: string) => {
    if (!existsSync(file)) {
      return offset;
    }

    const size = statSync(file).size;

    if (size <= offset) {
      return offset;
    }

    const handle = await open(file, 'r');
    const buffer = Buffer.alloc(size - offset);

    try {
      await handle.read(buffer, 0, buffer.length, offset);
    } finally {
      await handle.close();
    }

    const chunk = buffer.toString('utf8');
    const complete = chunk.slice(0, chunk.lastIndexOf('\n') + 1);

    for (const line of complete.split('\n').filter(Boolean)) {
      const event = JSON.parse(line) as ReporterEvent;

      const result = event.type === 'start'
        ? {
          ...caseFromRaw(
            {
              ...event,
              state: 'skipped',
              durationMs: 0,
              errors: [],
              meta: {},
            },
            attempt,
            runModel,
          ),
          status: 'running' as const,
          startedAt: new Date().toISOString(),
        }
        : caseFromRaw(event, attempt, runModel);

      if (result.status === 'skipped') {
        remove(run, (existing) => existing.id === result.id && existing.status === 'running');
      } else {
        upsert(run, result);
      }
    }
    publish(run);

    return offset + Buffer.byteLength(complete);
  };

  const execute = (run: ReportTypes.Run, job: Job) => new Promise<void>((resolveJob) => {
    const file = join(dirOf(run.id), `events-${job.attempt}${job.family ? `-${job.family}` : ''}.ndjson`);
    const runModel = job.model ?? 'default';
    const args = vitestArgs(settings, ['run', `--reporter=${options.reporterPath}`, ...(job.caseFilter ? ['-t', job.caseFilter] : [])]);

    const child = spawn(settings.vitest.command, args, {
      cwd: settings.root,
      env: {
        ...process.env,
        ...(job.model && settings.modelsEnv ? { [settings.modelsEnv]: job.model } : {}),
        ...(run.judge && settings.judgeEnv ? { [settings.judgeEnv]: run.judge } : {}),
        VITEST_EVALS_DASHBOARD_EVENTS: file,
      },
      shell: process.platform === 'win32',
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    let stderr = '';
    let offset = 0;
    let reading = Promise.resolve();
    child.stderr.on('data', (data: Buffer) => {
      stderr = `${stderr}${data.toString()}`.slice(-4000);
    });

    const timer = setInterval(
      () => {
        reading = reading.then(async () => {
          offset = await pump(run, file, job.attempt, offset, runModel);
        })
          .catch(() => undefined);
      },
      500,
    );

    const worker = workers.get(run.id);

    if (worker) {
      worker.stop = () => child.kill('SIGINT');
    }
    child.on('error', (error) => {
      clearInterval(timer);
      options.onEvent({ type: 'notice', tone: 'error', text: `The evals could not start: ${error.message}` });
      resolveJob();
    });
    child.on('close', async (code) => {
      clearInterval(timer);

      try {
        await reading;
        await pump(run, file, job.attempt, offset, runModel);
      } catch {
        // A half-written events file loses only the lines after it; the run still finishes.
      }

      const ran = run.cases.some((result) => result.attempt === job.attempt
        && (!job.family
        || result.family === job.family)
        && (result.status === 'passed'
        || result.status === 'failed'));

      remove(run, (result) => result.attempt === job.attempt
        && (result.status === 'running'
        || result.status === 'queued')
        && (!job.family
        || result.family === job.family));
      if (!ran && job.caseFilter) {
        const names = pickedCases(job.caseFilter).join(', ') || job.caseFilter;
        options.onEvent({
          type: 'notice',
          tone: code === 0 ? 'warning' : 'error',
          text: code === 0
            ? `${names} did not run: this branch's evals have no case with that name.`
            : `${names} failed to start. See stderr-${job.attempt}.log in the run's folder.`,
        });
      }

      if (code !== 0 && !run.cases.some((result) => result.attempt === job.attempt)) {
        writeFileSync(join(dirOf(run.id), `stderr-${job.attempt}.log`), stderr);
      }

      try {
        save(run);
      } finally {
        resolveJob();
      }
    });
  });

  const work = async (run: ReportTypes.Run, worker: Worker): Promise<void> => {
    const job = worker.queue.shift();

    if (!job) {
      return;
    }

    publish(run);
    await execute(run, job);

    return work(run, worker);
  };

  const drain = async (run: ReportTypes.Run) => {
    const worker = workers.get(run.id);

    if (!worker) {
      return;
    }
    run.state = 'running';
    publish(run);
    await work(run, worker);
    workers.delete(run.id);
    remove(run, (result) => result.status === 'running' || result.status === 'queued');
    run.state = run.cases.length ? 'finished' : 'failed';
    run.finishedAt = new Date().toISOString();
    save(run);
    publish(run);
  };

  const enqueue = (run: ReportTypes.Run, jobs: Job[]) => {
    const worker = workers.get(run.id);

    if (worker) {
      worker.queue.push(...jobs);
      publish(run);

      return;
    }
    workers.set(run.id, { queue: jobs });
    void drain(run);
  };

  const nextAttempt = (run: ReportTypes.Run) => {
    const queued = workers.get(run.id)?.queue.map((job) => job.attempt) ?? [];
    return Math.max(-1, ...run.cases.map((result) => result.attempt), ...queued) + 1;
  };

  return {
    list: () => [...runs.values()]
      .map(summarize)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

    get: (id: string) => runs.get(id),

    setBaseline: markBaseline,

    import(file: string, label: string, baseline: boolean) {
      const existing = [...runs.values()].find((run) => run.source === file);

      if (existing) {
        if (baseline) {
          markBaseline(existing.id);
        }
        return summarize(existing);
      }

      const cases = casesFromVitestJson(JSON.parse(readFileSync(file, 'utf8')));
      const now = new Date().toISOString();

      const run: ReportTypes.Run = {
        id: newId(),
        label,
        source: file,
        baseline: false,
        state: 'finished',
        models: [...new Set(cases.map((result) => result.model))],
        createdAt: now,
        finishedAt: now,
        total: 0,
        passed: 0,
        failed: 0,
        cases,
      };

      runs.set(run.id, run);
      save(run);
      if (baseline) {
        markBaseline(run.id);
      }

      return summarize(run);
    },

    start(request: ReportTypes.RunRequest) {
      const baseline = [...runs.values()].find((run) => run.baseline);
      // A run is judged like the baseline it is compared with, unless the form picked a judge.
      const judge = request.judge ?? (request.baseline ? undefined : baseline?.judge) ?? settings.judges[0];

      const run: ReportTypes.Run = {
        id: newId(),
        label: request.label,
        baseline: false,
        state: 'running',
        models: request.models,
        judge,
        caseFilter: request.caseFilter,
        git: gitState(),
        createdAt: new Date().toISOString(),
        total: 0,
        passed: 0,
        failed: 0,
        cases: [],
      };

      runs.set(run.id, run);
      save(run);
      if (request.baseline) {
        markBaseline(run.id);
      }
      // Each picked model runs the evals once, with the model in --models-env.
      const models = request.models.length ? request.models : [undefined];
      enqueue(run, models.map((model) => ({ model, caseFilter: request.caseFilter, attempt: 0, family: model && modelFamily(model) })));

      return summarize(run);
    },

    rerun(id: string, request: ReportTypes.RerunRequest) {
      const run = runs.get(id);

      if (!run) {
        return undefined;
      }

      const jobs: Job[] = [];
      const families = [...new Set(request.cases.map((item) => item.family))];
      const first = nextAttempt(run);

      for (let round = 0; round < Math.max(1, Math.min(request.times, 10)); round += 1) {
        for (const family of families) {
          const ids = request.cases
            .filter((item) => item.family === family)
            .map((item) => item.caseId);

          // A case that always runs on its own model has no family among the run's models; any of them runs it.
          const model = run.models.find((item) => modelFamily(item) === family) ?? run.models[0];

          if (ids.length) {
            jobs.push({ model, caseFilter: caseFilterFor(ids), attempt: first + round, family });
          }
        }

        for (const item of request.cases) {
          const template = run.cases.find((result) => result.caseId === item.caseId && result.family === item.family);

          if (!template) {
            continue;
          }

          const attempt = first + round;
          upsert(run, {
            ...template,
            id: `${template.key}#${attempt}`,
            attempt,
            status: 'queued',
            durationMs: 0,
            output: undefined,
            failure: undefined,
            judges: [],
            tokens: undefined,
            inputTokens: undefined,
            outputTokens: undefined,
            startedAt: undefined,
            toolCalls: [],
            transcript: [],
          });
        }
      }
      enqueue(run, jobs);

      return summarize(run);
    },

    cancel(id: string) {
      const worker = workers.get(id);

      if (!worker) {
        return;
      }
      worker.queue.length = 0;
      worker.stop?.();
    },
  };
}
