export type CaseStatus = 'passed' | 'failed' | 'skipped' | 'running' | 'queued';

export type RunState = 'running' | 'finished' | 'failed';

export interface JudgeScore {
  name: string;
  score: number | null;
  rationale?: string;
}

export interface ToolCall {
  name: string;
  arguments: unknown;
  result?: unknown;
}

export interface TranscriptEntry {
  kind: 'user' | 'assistant' | 'tool';
  text: string;
  tool?: ToolCall;
}

export interface CaseResult {
  id: string;
  key: string;
  attempt: number;
  caseId: string;
  title: string;
  suite: string;
  model: string;
  family: string;
  // Reported a model other than the one the run picked: the test always runs on its own model.
  fixedModel?: boolean;
  status: CaseStatus;
  durationMs: number;
  startedAt?: string;
  input?: string;
  output?: string;
  failure?: string;
  judges: JudgeScore[];
  tokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  toolCalls: ToolCall[];
  transcript: TranscriptEntry[];
}

// The checkout a run ran in; `dirty` means it had uncommitted changes, so the commit alone does not reproduce it.
export interface GitState {
  branch: string;
  commit: string;
  dirty: boolean;
}

export interface RunSummary {
  id: string;
  label: string;
  baseline: boolean;
  state: RunState;
  models: string[];
  judge?: string;
  caseFilter?: string;
  git?: GitState;
  createdAt: string;
  finishedAt?: string;
  total: number;
  passed: number;
  failed: number;
  source?: string;
  baselineDelta?: number;
  queued?: number;
  cost?: number;
}

export interface Run extends RunSummary {
  cases: CaseResult[];
}

export interface RerunRequest {
  cases: { caseId: string; family: string }[];
  times: number;
}

export type OpenApp = 'cursor' | 'code' | 'zed' | 'folder';

export interface EvalCase {
  id: string;
  title: string;
  suite: string;
  file: string;
}

// What the dashboard was started with: the models and judges the new-run form offers, and the apps that can open a case.
export interface Settings {
  models: string[];
  judges: string[];
  apps: OpenApp[];
  // Braintrust credentials were found, so its tab shows.
  braintrust: boolean;
  // The repo's default branch, such as main or master.
  defaultBranch: string;
}

export interface RunRequest {
  label: string;
  baseline: boolean;
  models: string[];
  judge?: string;
  caseFilter?: string;
}

export type ServerEvent =
  | { type: 'run'; run: RunSummary }
  | { type: 'case'; runId: string; result: CaseResult }
  | { type: 'remove'; runId: string; ids: string[] }
  | { type: 'notice'; tone: 'warning' | 'error'; text: string };

export type CaseChange = 'worse' | 'fixed' | 'same-pass' | 'same-fail' | 'new' | 'pending';

export interface CaseComparison {
  caseId: string;
  title: string;
  suite: string;
  family: string;
  before?: CaseResult;
  after?: CaseResult;
  beforeAttempts: CaseResult[];
  afterAttempts: CaseResult[];
  change: CaseChange;
}

export interface FamilySummary {
  family: string;
  beforeModel?: string;
  afterModel?: string;
  before: { passed: number; total: number };
  after: { passed: number; total: number };
  worse: number;
  fixed: number;
}

export interface PriceTier {
  input: number;
  output: number;
  size: number;
}

export interface ModelPrice {
  input: number;
  output: number;
  tiers?: PriceTier[];
}

export type Prices = Partial<Record<string, ModelPrice>>;
