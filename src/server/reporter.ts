import { appendFileSync } from 'node:fs';
import type { Reporter, TestCase } from 'vitest/node';

// Loaded by Vitest by path: it streams each case to the file the UI server tails, one JSON line per event.
export default class EvalsUiReporter implements Reporter {
  readonly #file = process.env.VITEST_EVALS_DASHBOARD_EVENTS;

  onTestCaseReady(testCase: TestCase) {
    if (testCase.options.mode !== 'run') {
      return;
    }
    this.#write({ type: 'start', ...this.#identity(testCase) });
  }

  onTestCaseResult(testCase: TestCase) {
    const result = testCase.result();
    this.#write({
      type: 'result',
      ...this.#identity(testCase),
      state: result.state,
      durationMs: testCase.diagnostic()?.duration ?? 0,
      errors: (result.errors ?? []).map((error) => error.message),
      meta: testCase.meta(),
    });
  }

  #identity(testCase: TestCase) {
    const describe: string[] = [];

    for (let parent = testCase.parent; parent.type === 'suite'; parent = parent.parent) {
      describe.unshift(parent.name);
    }

    return {
      file: testCase.module.moduleId,
      describe,
      title: testCase.name,
    };
  }

  #write(event: object) {
    if (this.#file) {
      appendFileSync(this.#file, `${JSON.stringify(event)}\n`);
    }
  }
}
