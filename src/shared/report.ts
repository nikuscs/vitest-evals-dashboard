import type * as ReportTypes from '#/shared/report.types.ts';

interface HarnessEvent {
  type?: string;
  role?: string;
  content?: unknown;
  id?: string;
  toolCallId?: string;
  name?: string;
  arguments?: unknown;
}

interface TaskMeta {
  harness?: {
    name?: string;
    run?: {
      output?: unknown;
      usage?: { totalTokens?: number; inputTokens?: number; outputTokens?: number };
      session?: { events?: HarnessEvent[] };
    };
  };
  eval?: {
    scores?: { name?: string; score?: number | null; metadata?: { rationale?: string } }[];
    output?: unknown;
  };
}

export interface RawCase {
  file: string;
  describe: string[];
  title: string;
  state: string;
  durationMs: number;
  errors: string[];
  meta: unknown;
}

const MODEL_TAG = /\[(?:[\w-]+\/)?([a-z0-9.@-]+)\]/;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Picked cases travel as a `-t` filter that matches a test titled `ID: …` or exactly `title`.
export function caseFilterFor(ids: string[]): string {
  return `(${ids.map(escapeRegExp).join('|')})(?::|$)`;
}

// The case IDs inside a filter made by caseFilterFor; anything else is a hand-written filter.
export function pickedCases(caseFilter: string | undefined): string[] {
  return /^\((.+)\)\(\?::\|\$\)$/.exec(caseFilter ?? '')?.[1]?.replaceAll('\\', '').split('|') ?? [];
}

// A test file's name without its folders and test suffixes: `auth.eval.ts` is `auth`.
export function suiteOf(file: string): string {
  return file.split(/[/\\]/).pop()?.replace(/(\.(eval|evals|test|spec))?\.[cm]?[jt]sx?$/, '') ?? file;
}

// A model without its version, so versions of one model compare with each other: `claude-sonnet-4-5` is `sonnet`,
// `gpt-5-mini` is `gpt-mini`, `gemini-2.5-flash` is `gemini-flash`. Anything after `@` (a region or a tag) is ignored.
export function modelFamily(model: string): string {
  const id = model.split('@')[0] ?? model;
  const claude = /claude-([a-z]+)/.exec(id);

  if (claude?.[1]) {
    return claude[1];
  }

  const words = id.split(/[-_]/).filter((word) => !/^v?\d+(\.\d+)*$|^latest$/.test(word));
  return words.join('-') || id;
}

export function modelLabel(model: string): string {
  const match = /^claude-([a-z]+)-([\d-]+)$/.exec(model);

  if (!match) {
    return model;
  }

  const [, family = '', version = ''] = match;
  return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${version.replaceAll('-', '.')}`;
}

function text(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value && typeof value === 'object' && 'text' in value && typeof (value).text === 'string') {
    return (value as { text: string }).text;
  }

  if (value && typeof value === 'object' && 'message' in value && typeof (value).message === 'string') {
    return (value as { message: string }).message;
  }

  if (value && typeof value === 'object' && 'content' in value && typeof (value).content === 'string') {
    return (value as { content: string }).content;
  }

  return JSON.stringify(value, null, 2);
}

function cleanFailure(errors: string[]): string | undefined {
  if (!errors.length) {
    return undefined;
  }

  const first = errors.join('\n')
    .split('\n')
    .filter((line) => !/^\s+at /.test(line))
    .join('\n')
    .trim();

  return first.slice(0, 2000);
}

function transcriptOf(events: HarnessEvent[]): { transcript: ReportTypes.TranscriptEntry[]; toolCalls: ReportTypes.ToolCall[] } {
  const toolCalls: ReportTypes.ToolCall[] = [];
  const byId = new Map<string, ReportTypes.ToolCall>();
  const transcript: ReportTypes.TranscriptEntry[] = [];

  for (const event of events) {
    if (event.type === 'message' && (event.role === 'user' || event.role === 'assistant')) {
      transcript.push({ kind: event.role, text: text(event.content) });
    } else if (event.type === 'tool_call' && event.name) {
      const call: ReportTypes.ToolCall = { name: event.name, arguments: event.arguments ?? {} };
      toolCalls.push(call);
      if (event.id) {
        byId.set(event.id, call);
      }
      transcript.push({ kind: 'tool', text: event.name, tool: call });
    } else if (event.type === 'tool_result' && event.toolCallId) {
      const call = byId.get(event.toolCallId);

      if (call) {
        call.result = event.content;
      }
    }
  }

  return {
    transcript,
    toolCalls,
  };
}

function statusOf(state: string): ReportTypes.CaseStatus {
  if (state === 'pass' || state === 'passed') {
    return 'passed';
  }

  return state === 'fail' || state === 'failed' ? 'failed' : 'skipped';
}

// A test titled `ID-12: title` keeps `ID-12` as its case ID; any other test, such as `Auth: rejects a token`, is its own title.
export function splitTitle(title: string): { caseId: string; title: string } {
  const match = /^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+): (.+)$/.exec(title);
  return match ? { caseId: match[1] ?? title, title: match[2] ?? title } : { caseId: title, title };
}

// The model comes from a `[model]` tag in the describe titles, else the model the run passed in.
export function caseFromRaw(raw: RawCase, attempt = 0, runModel = 'default'): ReportTypes.CaseResult {
  const meta = (raw.meta ?? {}) as TaskMeta;

  const tag = [...raw.describe]
    .reverse()
    .map((part) => MODEL_TAG.exec(part)?.[1])
    // A model name has a digit or a dash, so a tag like `[slow]` is not one.
    .find((name) => name && /[\d-]/.test(name));

  const reported = tag;
  const model = reported ?? runModel;
  const { caseId, title } = splitTitle(raw.title);
  const suite = suiteOf(raw.file);
  const status = statusOf(raw.state);
  const { transcript, toolCalls } = transcriptOf(meta.harness?.run?.session?.events ?? []);

  const judges: ReportTypes.JudgeScore[] = (meta.eval?.scores ?? []).map((score) => ({
    name: score.name ?? 'Judge',
    score: score.score ?? null,
    rationale: score.metadata?.rationale,
  }));

  const family = modelFamily(model);
  const key = `${suite}::${caseId}::${family}`;
  return {
    id: `${key}#${attempt}`,
    key,
    attempt,
    caseId,
    title,
    suite,
    model,
    family,
    fixedModel: Boolean(reported && runModel !== 'default' && reported !== runModel.split('@')[0]),
    status,
    durationMs: Math.round(raw.durationMs),
    input: transcript.find((entry) => entry.kind === 'user')?.text,
    output: (meta.harness?.run?.output ?? meta.eval?.output) === undefined ? undefined : text(meta.harness?.run?.output ?? meta.eval?.output),
    failure: status === 'failed' ? cleanFailure(raw.errors) : undefined,
    judges,
    tokens: meta.harness?.run?.usage?.totalTokens,
    inputTokens: meta.harness?.run?.usage?.inputTokens,
    outputTokens: meta.harness?.run?.usage?.outputTokens,
    toolCalls,
    transcript,
  };
}

interface VitestJsonReport {
  testResults?: {
    name: string;
    assertionResults?: { ancestorTitles: string[]; title: string; status: string; duration?: number | null; failureMessages?: string[]; meta?: unknown }[];
  }[];
}

export function casesFromVitestJson(report: VitestJsonReport): ReportTypes.CaseResult[] {
  return (report.testResults ?? []).flatMap((file) => (file.assertionResults ?? []).map((test) => caseFromRaw(
    {
      file: file.name,
      describe: test.ancestorTitles,
      title: test.title,
      state: test.status,
      durationMs: test.duration ?? 0,
      errors: test.failureMessages ?? [],
      meta: test.meta,
    },
  )))
    .filter((result) => result.status !== 'skipped');
}

function changeOf(before?: ReportTypes.CaseResult, after?: ReportTypes.CaseResult): ReportTypes.CaseChange {
  if (!after || after.status === 'running' || after.status === 'queued') {
    return 'pending';
  }

  if (!before) {
    return 'new';
  }

  if (before.status === 'passed' && after.status === 'failed') {
    return 'worse';
  }

  if (before.status === 'failed' && after.status === 'passed') {
    return 'fixed';
  }

  return after.status === 'passed' ? 'same-pass' : 'same-fail';
}

function group(cases: ReportTypes.CaseResult[]) {
  const keys = new Map<string, ReportTypes.CaseResult[]>();

  for (const result of cases) {
    keys.set(result.key, [...(keys.get(result.key) ?? []), result]);
  }

  for (const attempts of keys.values()) {
    attempts.sort((a, b) => a.attempt - b.attempt);
  }

  return keys;
}

// One result per case: passed when at least half its finished attempts passed, shown with its latest finished attempt.
function verdict(attempts: ReportTypes.CaseResult[]): ReportTypes.CaseResult | undefined {
  const done = attempts.filter((result) => result.status === 'passed' || result.status === 'failed');
  const latest = done.at(-1) ?? attempts.at(-1);

  if (!latest) {
    return undefined;
  }

  if (!done.length) {
    return latest;
  }

  const passed = done.filter((result) => result.status === 'passed').length;
  return {
    ...latest,
    status: passed * 2 >= done.length ? 'passed' : 'failed',
  };
}

export function verdicts(cases: ReportTypes.CaseResult[]): ReportTypes.CaseResult[] {
  return [...group(cases).values()]
    .map(verdict)
    .filter((result): result is ReportTypes.CaseResult => Boolean(result));
}

// Lines up the models of two runs: the same family pairs with itself, and the families only one run has pair in the order they first appear,
// so a run on one model compares with a run on another. Only the key changes; each result keeps its own model and family.
function alignFamilies(before: ReportTypes.CaseResult[], after: ReportTypes.CaseResult[]): ReportTypes.CaseResult[] {
  const beforeFamilies = [...new Set(before.map((result) => result.family))];
  const afterFamilies = new Set(after.map((result) => result.family));
  const unmatchedAfter = [...afterFamilies].filter((family) => !beforeFamilies.includes(family));
  const unmatchedBefore = beforeFamilies.filter((family) => !afterFamilies.has(family));
  const pairs = new Map(unmatchedBefore.flatMap((family, index) => (unmatchedAfter[index] ? [[family, unmatchedAfter[index]] as const] : [])));

  return before.map((result) => {
    const family = pairs.get(result.family);
    return family ? { ...result, key: result.key.replace(/::[^:]+$/, `::${family}`) } : result;
  });
}

export function baselineDelta(beforeCases: ReportTypes.CaseResult[], after: ReportTypes.CaseResult[]): number | undefined {
  const before = alignFamilies(beforeCases, after);
  const base = new Map(verdicts(before).map((result) => [result.key, result]));
  const pairs = verdicts(after).filter((result) => (result.status === 'passed' || result.status === 'failed') && base.has(result.key));

  if (!pairs.length) {
    return undefined;
  }

  const passed = (list: (ReportTypes.CaseResult | undefined)[]) => list.filter((result) => result?.status === 'passed').length;
  return ((passed(pairs) - passed(pairs.map((result) => base.get(result.key)))) / pairs.length) * 100;
}

export function compareRuns(before: ReportTypes.CaseResult[], after: ReportTypes.CaseResult[]): ReportTypes.CaseComparison[] {
  const beforeKeys = group(alignFamilies(before, after));
  const afterKeys = group(after);
  return [...new Set([...beforeKeys.keys(), ...afterKeys.keys()])]
    .flatMap((key) => {
      const beforeAttempts = beforeKeys.get(key) ?? [];
      const afterAttempts = afterKeys.get(key) ?? [];
      const b = verdict(beforeAttempts);
      const a = verdict(afterAttempts);
      const any = a ?? b;

      // Every key comes from at least one attempt, so one side always has a verdict.
      if (!any) {
        return [];
      }

      return [{
        caseId: any.caseId,
        title: any.title,
        suite: any.suite,
        family: any.family,
        before: b,
        after: a,
        beforeAttempts,
        afterAttempts,
        change: changeOf(b, a),
      }];
    })
    .sort((x, y) => x.suite.localeCompare(y.suite) || x.caseId.localeCompare(y.caseId) || x.family.localeCompare(y.family));
}

export function summarizeFamilies(rows: ReportTypes.CaseComparison[]): ReportTypes.FamilySummary[] {
  const families = new Map<string, ReportTypes.FamilySummary>();

  for (const row of rows) {
    const summary = families.get(row.family)
      ?? {
        family: row.family,
        before: { passed: 0, total: 0 },
        after: { passed: 0, total: 0 },
        worse: 0,
        fixed: 0,
      };

    if (row.before) {
      if (!row.before.fixedModel || !summary.beforeModel) {
        summary.beforeModel = row.before.model;
      }
      summary.before.total += 1;
      if (row.before.status === 'passed') {
        summary.before.passed += 1;
      }
    }

    if (row.after && row.after.status !== 'running' && row.after.status !== 'queued') {
      if (!row.after.fixedModel || !summary.afterModel) {
        summary.afterModel = row.after.model;
      }
      summary.after.total += 1;
      if (row.after.status === 'passed') {
        summary.after.passed += 1;
      }
    }

    if (row.change === 'worse') {
      summary.worse += 1;
    }

    if (row.change === 'fixed') {
      summary.fixed += 1;
    }
    families.set(row.family, summary);
  }

  return [...families.values()].sort((a, b) => a.family.localeCompare(b.family));
}

export type JudgeKind = 'factuality' | 'rubric' | 'judge' | 'rules';

export function judgeKind(results: ReportTypes.CaseResult[]): JudgeKind {
  const names = results.flatMap((result) => result.judges.map((judge) => judge.name.toLowerCase()));

  if (names.some((name) => name.includes('factual'))) {
    return 'factuality';
  }

  if (names.some((name) => name.includes('rubric'))) {
    return 'rubric';
  }

  if (names.length) {
    return 'judge';
  }

  return 'rules';
}

// Estimated USD for one case: list prices, no prompt-cache discount, and the context tier picked from the average prompt per model call.
export function caseCost(result: ReportTypes.CaseResult, prices: ReportTypes.Prices): number | undefined {
  const price = prices[result.model.split('@')[0] ?? result.model];
  const input = result.inputTokens;
  const output = result.outputTokens;

  if (!price || input === undefined || output === undefined) {
    return undefined;
  }

  const perCall = input / Math.max(1, result.toolCalls.length + 1);

  const tier = (price.tiers ?? []).filter((item) => perCall > item.size)
    .sort((a, b) => b.size - a.size)
    .at(0);

  const rate = tier ?? price;
  return (input * rate.input + output * rate.output) / 1_000_000;
}

export function totalCost(results: ReportTypes.CaseResult[], prices: ReportTypes.Prices): number | undefined {
  const costs = results.map((result) => caseCost(result, prices))
    .filter((value): value is number => value !== undefined);

  return costs.length
    ? costs.reduce((sum, value) => sum + value, 0)
    : undefined;
}

export function money(value: number | undefined) {
  if (value === undefined) {
    return '—';
  }

  if (value < 0.01) {
    return '<$0.01';
  }

  return `$${value < 10 ? value.toFixed(2) : value.toFixed(0)}`;
}

// Average judge score per round, 0–1. A round that failed before the judge could score it counts as 0; undefined when no judge scored the case.
export function judgeScore(attempts: ReportTypes.CaseResult[]): number | undefined {
  const judged = attempts.some((result) => result.judges.some((judge) => typeof judge.score === 'number'));

  if (!judged) {
    return undefined;
  }

  const rounds = attempts.flatMap((result) => {
    const scores = result.judges
      .map((judge) => judge.score)
      .filter((value): value is number => typeof value === 'number');

    if (scores.length) {
      return [scores.reduce((sum, value) => sum + value, 0) / scores.length];
    }

    return result.status === 'failed' ? [0] : [];
  });

  return rounds.length ? rounds.reduce((sum, value) => sum + value, 0) / rounds.length : undefined;
}
