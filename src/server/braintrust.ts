import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { caseFilterFor, modelFamily, totalCost, verdicts } from '#/shared/report.ts';
import type * as ReportTypes from '#/shared/report.types.ts';

// Read-only view of a Braintrust project's experiments. Experiments created close together, one per model, show as one run.
// Optional metadata the view reads: on the experiment `model`, `judgeModel` and `caseIds`; on each root span `caseId`, `suite` and `rationale`.

interface Experiment {
  id: string;
  name: string;
  created: string;
  repo_info?: { branch?: string; commit?: string; dirty?: boolean } | null;
  metadata?: { model?: string; judgeModel?: string; caseIds?: string[] } | null;
}

// One logged span. A case is the tree under one `eval` root: `task` holds the output, `tool` the tool calls, `score` each scorer, and `llm` the model calls.
interface Span {
  id: string;
  span_id?: string;
  root_span_id: string;
  span_parents?: string[] | null;
  is_root?: boolean;
  created: string;
  span_attributes?: { type?: string; name?: string } | null;
  input?: unknown;
  output?: unknown;
  scores?: Record<string, number | null> | null;
  metadata?: { caseId?: string; suite?: string; rationale?: string } | null;
  metrics?: { start?: number; end?: number; prompt_tokens?: number; completion_tokens?: number } | null;
  error?: unknown;
}

interface Group {
  id: string;
  experiments: Experiment[];
}

const API = 'https://api.braintrust.dev';

export class BraintrustSetupError extends Error {
  constructor() {
    super('BRAINTRUST_API_KEY and BRAINTRUST_PROJECT_ID are missing. Set them in the environment or in .env, then restart the dashboard.');
  }
}

const LIST_TTL_MS = 60_000;
// Experiments still being written to are not cached; an hour is well past any eval run.
const SETTLED_MS = 60 * 60_000;
const SAME_RUN_MS = 5 * 60_000;

// The environment wins, then .env.local, then .env in the folder the dashboard started in.
const VARS_FILES = ['.env.local', '.env'];

function readVars(file: string): Record<string, string> {
  if (!existsSync(file)) {
    return {};
  }
  return Object.fromEntries(readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => /^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line))
    .filter((match) => match !== null)
    .map((match) => [match[1], match[2]]));
}

function readCredentials(root: string) {
  const vars = Object.assign({}, ...VARS_FILES.toReversed()
    .map((file) => readVars(join(root, file)))) as Record<string, string | undefined>;

  const apiKey = process.env.BRAINTRUST_API_KEY ?? vars.BRAINTRUST_API_KEY;
  const projectId = process.env.BRAINTRUST_PROJECT_ID ?? vars.BRAINTRUST_PROJECT_ID;
  return apiKey && projectId ? { apiKey, projectId } : undefined;
}

function textOf(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(textOf).join('');
  }

  if (value && typeof value === 'object') {
    const item = value as { content?: unknown; text?: unknown };

    if (typeof item.text === 'string') {
      return item.text;
    }

    if (item.content !== undefined) {
      return textOf(item.content);
    }
  }

  return '';
}

function turnRole(index: number): string {
  return index % 2 ? 'assistant' : 'user';
}

function messagesOf(input: unknown): { role: string; text: string }[] {
  const list = Array.isArray(input) ? input : (input as { messages?: unknown[] } | null)?.messages ?? (input === undefined ? [] : [input]);
  return list.map((message, index) => ({
    role: typeof message === 'object' && message && 'role' in message ? String((message as { role: unknown }).role) : turnRole(index),
    text: textOf(message),
  }));
}

// `tool_choice` and `toolChoice` both read as `Tool choice`.
const scoreName = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());

function caseOf(root: Span, spans: Span[], model: string, attempt: number): ReportTypes.CaseResult {
  const caseId = root.metadata?.caseId ?? root.id;
  const suite = root.metadata?.suite ?? 'braintrust';
  const family = modelFamily(model);
  const key = `${suite}::${caseId}::${family}`;
  const messages = messagesOf(root.input);

  const ofType = (type: string) => spans.filter((span) => span.span_attributes?.type === type)
    .sort((a, b) => a.created.localeCompare(b.created));

  const output = root.output ?? ofType('task')[0]?.output;
  const answer = textOf(output) || (output === undefined ? '' : JSON.stringify(output, null, 2));

  const toolCalls: ReportTypes.ToolCall[] = ofType('tool').map((span) => ({
    name: span.span_attributes?.name ?? 'tool',
    arguments: span.input,
    result: span.output ?? span.error,
  }));

  const judges: ReportTypes.JudgeScore[] = ofType('score').flatMap((span) => Object.entries(span.scores ?? {})
    .filter((entry): entry is [string, number] => entry[1] !== null)
    .map(([name, score]) => ({
      name: scoreName(name),
      score,
      rationale: span.metadata?.rationale,
    })));

  // Model calls are `llm` spans. SDKs that nest one inside another (a stream and its request) would count twice, so only the innermost count.
  const llm = spans.filter((span) => span.span_attributes?.type === 'llm');
  const calls = llm.filter((span) => !llm.some((other) => span.span_id && other.span_parents?.includes(span.span_id)));
  const inputTokens = calls.reduce((sum, span) => sum + (span.metrics?.prompt_tokens ?? 0), 0);
  const outputTokens = calls.reduce((sum, span) => sum + (span.metrics?.completion_tokens ?? 0), 0);
  // Braintrust has no pass or fail, so a case fails when any scorer gives it less than half.
  const misses = judges.filter((judge) => (judge.score ?? 0) < 0.5);
  const error = root.error ? textOf(root.error) || JSON.stringify(root.error) : undefined;

  const transcript: ReportTypes.TranscriptEntry[] = [
    ...messages.map((message) => ({
      kind: message.role === 'user' ? 'user' as const : 'assistant' as const,
      text: message.text,
    })),
    ...toolCalls.map((tool) => ({
      kind: 'tool' as const,
      text: tool.name,
      tool,
    })),
    ...(answer ? [{ kind: 'assistant' as const, text: answer }] : []),
  ];

  return {
    id: `${key}#${attempt}`,
    key,
    attempt,
    caseId,
    title: messages.find((message) => message.role === 'user')?.text ?? caseId,
    suite,
    model,
    family,
    status: error || misses.length ? 'failed' : 'passed',
    durationMs: Math.round(((root.metrics?.end ?? 0) - (root.metrics?.start ?? 0)) * 1000),
    startedAt: root.created,
    input: messages.find((message) => message.role === 'user')?.text,
    output: answer || undefined,
    failure: error
      ?? (misses.length
        ? misses.map((judge) => `${judge.name}: ${Math.round((judge.score ?? 0) * 100)}%`)
          .join(', ')
        : undefined),
    judges,
    tokens: calls.length ? inputTokens + outputTokens : undefined,
    inputTokens: calls.length ? inputTokens : undefined,
    outputTokens: calls.length ? outputTokens : undefined,
    toolCalls,
    transcript,
  };
}

function group(experiments: Experiment[]): Group[] {
  const groups: Group[] = [];

  for (const experiment of [...experiments].sort((a, b) => a.created.localeCompare(b.created))) {
    const same = groups.find((item) => {
      const first = item.experiments[0];
      return first.repo_info?.commit === experiment.repo_info?.commit
        && first.repo_info?.branch === experiment.repo_info?.branch
        && Date.parse(experiment.created) - Date.parse(first.created) < SAME_RUN_MS
        && !item.experiments.some((other) => other.metadata?.model === experiment.metadata?.model);
    });

    if (same) {
      same.experiments.push(experiment);
    } else {
      groups.push({
        id: `bt-${experiment.id}`,
        experiments: [experiment],
      });
    }
  }

  return groups.reverse();
}

export function createBraintrust(options: { root: string; dataDir: string; prices: () => ReportTypes.Prices }) {
  const credentials = readCredentials(options.root);
  const cacheDir = join(options.dataDir, 'braintrust');
  let api = API;
  let listed: { at: number; groups: Group[] } | undefined;
  const details = new Map<string, ReportTypes.Run>();

  const call = async <T>(path: string, init: Pick<RequestInit, 'method' | 'body'> = {}): Promise<T> => {
    if (!credentials) {
      throw new BraintrustSetupError();
    }

    const base = api;

    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${credentials.apiKey}`, 'content-type': 'application/json' },
    });

    const raw = await response.text();
    const body = (raw.startsWith('{') ? JSON.parse(raw) : { Message: raw }) as T & { RedirectUrl?: string; Message?: string; error?: string };
    // Organizations on a regional data plane get a redirect instead of data.
    const redirect = body.RedirectUrl ?? /direct your requests to: (https:\/\/[^\s"]+)/.exec(body.Message ?? body.error ?? '')?.[1];

    if (redirect && redirect !== base && /^https:\/\/([a-z0-9-]+\.)*braintrust\.dev(\/|$)/.test(redirect)) {
      api = redirect;
      return call(path, init);
    }

    if (response.status === 429) {
      throw new Error('Braintrust is rate limiting these reads. Try again in a minute.');
    }

    if (!response.ok) {
      throw new Error(body.Message ?? body.error ?? `Braintrust answered ${response.status}`);
    }

    return body;
  };

  // The plain event download, which avoids the tighter rate limit on Braintrust's query language (BTQL).
  const events = async (experimentId: string, cursor?: string): Promise<Span[]> => {
    const page = await call<{ events: Span[]; cursor?: string | null }>(`/v1/experiment/${experimentId}/fetch`, {
      method: 'POST',
      body: JSON.stringify({ limit: 1000, ...(cursor && { cursor }) }),
    });

    const next = page.events.length ? page.cursor ?? undefined : undefined;

    return next ? [...page.events, ...(await events(experimentId, next))] : page.events;
  };

  const groups = async () => {
    if (listed && Date.now() - listed.at < LIST_TTL_MS) {
      return listed.groups;
    }

    const page = async (earlier: Experiment[], after?: string): Promise<Experiment[]> => {
      const { objects } = await call<{ objects: Experiment[] }>(
        `/v1/experiment?project_id=${credentials?.projectId ?? ''}&limit=100${after ? `&starting_after=${after}` : ''}`,
      );

      const experiments = [...earlier, ...objects];
      const next = objects.length === 100 && experiments.length < 300 ? objects.at(-1)?.id : undefined;

      return next ? page(experiments, next) : experiments;
    };

    listed = { at: Date.now(), groups: group(await page([])) };

    return listed.groups;
  };

  const summaryOf = (item: Group, cases: ReportTypes.CaseResult[] = []): ReportTypes.RunSummary => {
    const first = item.experiments[0];
    const done = verdicts(cases);

    const git = first.repo_info?.commit
      ? {
        branch: first.repo_info.branch ?? 'detached',
        commit: first.repo_info.commit.slice(0, 8),
        dirty: Boolean(first.repo_info.dirty),
      }
      : undefined;

    const cached = details.get(item.id);
    return {
      id: item.id,
      label: git ? `${git.branch} · ${git.commit}` : first.name,
      baseline: false,
      state: 'finished',
      models: item.experiments
        .map((experiment) => experiment.metadata?.model ?? experiment.name)
        .toSorted(),
      judge: first.metadata?.judgeModel,
      caseFilter: first.metadata?.caseIds?.length ? caseFilterFor(first.metadata.caseIds) : undefined,
      git,
      createdAt: first.created,
      total: cached ? verdicts(cached.cases).length : done.length,
      passed: (cached ? verdicts(cached.cases) : done).filter((result) => result.status === 'passed').length,
      failed: (cached ? verdicts(cached.cases) : done).filter((result) => result.status === 'failed').length,
      cost: totalCost(cached?.cases ?? cases, options.prices()),
    };
  };

  // A cache file cut short by a crash reads as missing, so the run is fetched again.
  const cached = (file: string) => {
    try {
      return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as ReportTypes.Run : undefined;
    } catch {
      return undefined;
    }
  };

  const load = async (item: Group): Promise<ReportTypes.Run> => {
    const file = join(cacheDir, `${item.id}.json`);
    const saved = cached(file);

    if (saved) {
      return saved;
    }

    const cases = (await Promise.all(item.experiments.map(async (experiment) => {
      const model = (experiment.metadata?.model ?? experiment.name).split('@')[0] ?? experiment.name;
      const spans = await events(experiment.id);
      const byRoot = Map.groupBy(spans, (span) => span.root_span_id);
      const seen = new Map<string, number>();
      return spans.filter((span) => span.is_root)
        .sort((a, b) => a.created.localeCompare(b.created))
        .map((root) => {
          const caseId = root.metadata?.caseId ?? root.id;
          const attempt = seen.get(caseId) ?? 0;
          seen.set(caseId, attempt + 1);

          return caseOf(root, byRoot.get(root.root_span_id) ?? [], model, attempt);
        });
    }))).flat();

    const run: ReportTypes.Run = { ...summaryOf(item, cases), cases };
    const settled = item.experiments.every((experiment) => Date.now() - Date.parse(experiment.created) > SETTLED_MS);

    if (settled) {
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(`${file}.tmp`, JSON.stringify(run));
      renameSync(`${file}.tmp`, file);
    }

    return run;
  };

  return {
    configured: Boolean(credentials),
    async list(): Promise<ReportTypes.RunSummary[]> {
      const all = await groups();

      // Braintrust's read limits are shared by everyone on the project, so a run's cases load only when it is opened; ones opened before come from disk.
      for (const item of all) {
        const saved = details.has(item.id) ? undefined : cached(join(cacheDir, `${item.id}.json`));

        if (saved) {
          details.set(item.id, saved);
        }
      }

      return all.map((item) => summaryOf(item));
    },
    async get(id: string): Promise<ReportTypes.Run | undefined> {
      const item = (await groups()).find((candidate) => candidate.id === id);

      if (!item) {
        return undefined;
      }

      const run = details.get(id) ?? await load(item);
      details.set(id, run);

      return {
        ...run,
        ...summaryOf(item, run.cases),
      };
    },
  };
}
