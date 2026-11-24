# 🧪 vitest-evals-dashboard

> A local dashboard for your Vitest evals: run them, compare every run with a baseline, and re-run the cases that changed.

Comparing a prompt change or a new model usually means reading raw eval output and re-running by hand to tell a real regression from noise. Start this in any project with Vitest evals: run a baseline once, then every new run shows which cases got worse or better, with the conversation, the judge's score and reasoning, the tool calls and the estimated cost of each case.

## ✨ Features

- 📌 **Baseline compare.** Pin one run as the baseline; every other run shows per case what got worse, what got fixed and the pass rate per model.
- 🔁 **Re-run single cases.** Run a flaky case 3 or 5 more times on either side, with each round shown as a dot, to tell noise from a real change.
- 📡 **Live results.** Cases stream in while Vitest runs them.
- 🎛️ **Model and judge pickers.** Hand it a list of models and judges, and the new-run form lets you pick them; each picked model runs the evals once.
- 💬 **Case details.** The conversation, judge scores with their reasoning, tool calls with arguments and results, tokens and time.
- 💸 **Cost estimates.** Token usage priced with list prices from [models.dev](https://models.dev), for any provider.
- 🧭 **Open in your editor.** Jump to a case's test in Cursor, VS Code or Zed, whichever is installed, or show its folder.
- 🧠 **Braintrust tab.** Read-only view of a Braintrust project's experiments, shown when its keys are set.
- 🗂️ **Runs that last.** Runs are kept per repo, shared by its branches and worktrees, and survive restarts.

## 🧰 Built with

[Vitest](https://vitest.dev) · [vitest-evals](https://github.com/getsentry/vitest-evals) · [Bun](https://bun.sh) · [Vite](https://vite.dev) · [React](https://react.dev) · [Tailwind CSS](https://tailwindcss.com) · [Radix UI](https://www.radix-ui.com) · [models.dev](https://models.dev)

## 🚀 Run it in 3 steps

**You need:** [Bun](https://bun.sh) 1.4 or newer, and a project with Vitest 4 tests, ideally written with [vitest-evals](https://github.com/getsentry/vitest-evals).

**1. Go to the folder with your Vitest config**

```bash
cd my-project
```

**2. Start the dashboard**

```bash
bunx vitest-evals-dashboard
```

It uses your project's own Vitest (`node_modules/.bin/vitest`) and your Vitest config.

**3. Open it and run a baseline**

Open http://127.0.0.1:4320, choose **Run the baseline**, and change something. Then start a new run and compare.

> [!TIP]
> Before it is on npm, run it from a clone: `bun install`, then `bun link` in the clone. After that, `vitest-evals-dashboard` works in any folder.

## ⚙️ Options

```text
vitest-evals-dashboard [options] [-- vitest args]
```

| Option | What it does |
| --- | --- |
| `--port <port>` | Port to listen on. Default `4320`. |
| `--host <host>` | Host to listen on. Default `127.0.0.1`. Use `0.0.0.0` to reach it from another machine. |
| `--project <name>` | Run only this [Vitest project](https://vitest.dev/guide/projects). |
| `--models <a,b>` | Models the new-run form offers. Each picked model runs the evals once. Needs `--models-env`. |
| `--models-env <NAME>` | Environment variable that carries the picked model to your evals. |
| `--judges <a,b>` | Judge models the new-run form offers. Needs `--judge-env`. |
| `--judge-env <NAME>` | Environment variable that carries the picked judge to your evals. |
| `--import <file>` | A Vitest JSON report to load as a run. Repeat for more files. |
| `--label <name>` | Name for each imported run, in `--import` order. |
| `--baseline` | Mark the first imported run as the baseline. |
| `--allowed-hosts <a,b>` | Extra host names allowed to reach it, such as `my-box.local`. A leading dot allows every subdomain: `.ts.net` for Tailscale. |
| `--data <dir>` | Where runs are kept. Default `~/.cache/vitest-evals-dashboard/<repo>`. |
| `-h`, `--help` | Show the options. |

Anything after `--` goes to every `vitest run` and `vitest list`, such as `--config` or a file filter.

## 🧪 Examples

**Run the evals as they are**

```bash
bunx vitest-evals-dashboard
```

**Use a separate config for evals**

```bash
bunx vitest-evals-dashboard -- --config vitest.evals.config.ts
```

**Only some test files**

```bash
bunx vitest-evals-dashboard -- evals/auth
```

**Pick the model and judge per run**

```bash
bunx vitest-evals-dashboard \
  --models claude-sonnet-4-5,gpt-5-mini --models-env EVAL_MODEL \
  --judges claude-haiku-4-5 --judge-env EVAL_JUDGE
```

Your evals read the picked model and judge from those variables:

```ts
// evals/agent.eval.ts
const model = process.env.EVAL_MODEL ?? 'claude-sonnet-4-5'
const judgeModel = process.env.EVAL_JUDGE ?? 'claude-haiku-4-5'
```

**Load reports from CI and compare them**

```bash
bunx vitest-evals-dashboard \
  --import reports/main.json --label main --baseline \
  --import reports/my-branch.json --label my-branch
```

Write such a report with `vitest run --reporter=json --outputFile.json=reports/main.json`.

**Reach it from your phone or another machine**

```bash
bunx vitest-evals-dashboard --host 0.0.0.0                          # by IP address
bunx vitest-evals-dashboard --host 0.0.0.0 --allowed-hosts .ts.net  # by Tailscale name too
```

## 📦 Monorepos

Start the dashboard where Vitest finds the config for your evals. Runs are still kept per repo.

**Evals in one package**

```bash
cd packages/evals
bunx vitest-evals-dashboard
```

**Vitest projects defined at the root**

```bash
# vitest.config.ts at the root lists projects such as 'unit' and 'evals'
bunx vitest-evals-dashboard --project evals
```

**One project inside a package**

```bash
cd apps/agent
bunx vitest-evals-dashboard --project llm \
  --models claude-sonnet-4-5,claude-haiku-4-5 --models-env EVAL_MODEL \
  --judges claude-haiku-4-5 --judge-env EVAL_JUDGE
```

**Keep the command in package.json**

```json
{
  "scripts": {
    "evals:ui": "vitest-evals-dashboard --project evals --models claude-sonnet-4-5,gpt-5-mini --models-env EVAL_MODEL"
  }
}
```

The dashboard uses the nearest `node_modules/.bin/vitest` above the folder it starts in, so hoisted and per-package installs both work. Without one, it falls back to `npx vitest`.

## 🔎 How it reads your tests

| What | Where it comes from |
| --- | --- |
| Cases | `vitest list` in the folder you started in, with your `--project` and `--` arguments. |
| Case ID | A test titled `AUTH-12: resets an expired password` has the ID `AUTH-12`: capitals, dashes and a closing number. Any other test, such as `Login: rejects a bad code`, uses its title. |
| Area | The test file's name: `auth.eval.ts` shows as `auth`. |
| Model | A `[model]` tag in a `describe` title, such as `describe('[claude-sonnet-4-5]', …)`. Otherwise the model the run picked, or `default`. |
| Conversation, tools, tokens | The run that [vitest-evals](https://github.com/getsentry/vitest-evals) records on each test. |
| Judge scores | The judges vitest-evals ran on the test, with their scores and reasoning. |
| Results | A Vitest reporter the dashboard adds to each run, which streams every case as it finishes. |

Versions of one model line up across runs: the version numbers are dropped, so `claude-sonnet-4` compares with `claude-sonnet-4-5`, `gpt-5-mini` with `gpt-6-mini` and `gemini-2.5-flash` with `gemini-3-flash`. Anything after `@` in a model name is ignored. Models with nothing in common still line up in the order they were picked, so a run on one model compares with a baseline on another.

Plain Vitest tests work too; they just have no conversation or judge scores.

## 🧠 Braintrust

The Braintrust tab shows when `BRAINTRUST_API_KEY` and `BRAINTRUST_PROJECT_ID` are set in the environment, `.env.local` or `.env` in the folder you start in. It lists the project's experiments, groups those created close together into one run, and opens them like any other run. It never writes to Braintrust.

Each experiment's root spans are its cases. Tokens come from its `llm` spans, tool calls from `tool` spans and scores from `score` spans. A case fails when a scorer gives it less than 0.5. These optional metadata fields are used when present:

| Object | Fields |
| --- | --- |
| Experiment | `model`, `judgeModel`, `caseIds` |
| Root span | `caseId`, `suite`, `rationale` |

The "Only <branch>" filter and the default comparison use your repo's default branch, read from git.

## 🔒 Good to know

- **Runs cost money.** Starting the dashboard calls no model. Every run or re-run you start in it does, the same as running your evals by hand.
- **Local by default.** It listens on `127.0.0.1`. Requests whose host is not an IP address, `localhost`, your `--host` or one of your `--allowed-hosts` are refused, so a web page cannot reach it through DNS rebinding.
- **Your data stays local.** Runs live in the data folder. The only outside calls are the models.dev price list, fetched once a day, and Braintrust when its keys are set.

## 🛠️ Develop

```bash
bun install
bun run typecheck
cd ../some-project && bun ../vitest-evals-dashboard/bin/vitest-evals-dashboard.ts
```

| Folder | Holds |
| --- | --- |
| `bin/` | The `vitest-evals-dashboard` command. |
| `src/server/` | Options, the HTTP server, runs, case listing, the Vitest reporter, prices, Braintrust and opening files. |
| `src/shared/` | Turning Vitest results into cases, comparing runs, and the shared types. |
| `src/ui/` | The React app: pages, components and the store. |

## 📄 License

[MIT](LICENSE)
