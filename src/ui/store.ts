import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type * as ReportTypes from '#/shared/report.types.ts';

interface State {
  runs: ReportTypes.RunSummary[];
  details: Partial<Record<string, ReportTypes.Run>>;
  loaded: boolean;
  toast?: { id: number; text: string; tone?: 'info' | 'warning' | 'error' };
  prices: ReportTypes.Prices;
  settings: ReportTypes.Settings;
  braintrust?: BraintrustState;
}

export type Source = 'evals' | 'braintrust';

type BraintrustState = { runs: ReportTypes.RunSummary[]; error?: undefined; setup?: undefined } | { runs?: undefined; error: string; setup: boolean };

let state: State = {
  runs: [],
  details: {},
  loaded: false,
  prices: {},
  settings: { models: [], judges: [], apps: [], braintrust: false, defaultBranch: 'main' },
};

const listeners = new Set<() => void>();

const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  for (const listener of listeners) {
    listener();
  }
};

const apply = (event: ReportTypes.ServerEvent) => {
  if (event.type === 'run') {
    const exists = state.runs.some((run) => run.id === event.run.id);

    const runs = exists
      ? state.runs.map((run) => (run.id === event.run.id ? event.run : run))
      : [event.run, ...state.runs];

    const detail = state.details[event.run.id];

    const cases = detail && event.run.state !== 'running'
      ? detail.cases.filter((result) => result.status !== 'running' && result.status !== 'queued')
      : detail?.cases;

    set({
      runs,
      details: detail && cases
        ? {
          ...state.details,
          [event.run.id]: { ...detail, ...event.run, cases },
        }
        : state.details,
    });

    return;
  }

  if (event.type === 'notice') {
    toast(event.text, event.tone);
    return;
  }

  const detail = state.details[event.runId];

  if (!detail) {
    return;
  }

  if (event.type === 'remove') {
    set({
      details: {
        ...state.details,
        [event.runId]: {
          ...detail,
          cases: detail.cases.filter((result) => !event.ids.includes(result.id)),
        },
      },
    });
    return;
  }

  const cases = detail.cases.some((result) => result.id === event.result.id)
    ? detail.cases.map((result) => (result.id === event.result.id ? event.result : result))
    : [...detail.cases, event.result];

  set({
    details: {
      ...state.details,
      [event.runId]: { ...detail, cases },
    },
  });
};

let connected = false;

const connect = () => {
  if (connected) {
    return;
  }
  connected = true;
  void fetch('/api/settings')
    .then((response) => response.json() as Promise<ReportTypes.Settings>)
    .then((settings) => set({ settings }));
  void fetch('/api/prices')
    .then((response) => response.json() as Promise<ReportTypes.Prices>)
    .then((prices) => set({ prices }));
  void fetch('/api/runs')
    .then((response) => response.json() as Promise<ReportTypes.RunSummary[]>)
    .then((runs) => set({ runs, loaded: true }));
  const source = new EventSource('/api/events');
  let opened = false;
  source.onmessage = (message) => apply(JSON.parse(message.data as string) as ReportTypes.ServerEvent);
  // Events sent while the stream was down are lost, so a reconnect reloads the runs and every open run.
  source.onopen = () => {
    if (opened) {
      void refresh();
    }
    opened = true;
  };
};

const fetchRun = async (id: string) => {
  const response = await fetch(`/api/runs/${id}`);
  return response.ok ? response.json() as Promise<ReportTypes.Run> : undefined;
};

const refresh = async () => {
  const response = await fetch('/api/runs');
  const runs = await response.json() as ReportTypes.RunSummary[];
  set({ runs, loaded: true });

  const ids = Object.keys(state.details)
    .filter((key) => runs.some((run) => run.id === key));

  const fresh = await Promise.all(ids.map(fetchRun));
  const details = { ...state.details };

  for (const run of fresh) {
    if (run) {
      details[run.id] = run;
    }
  }
  set({ details });
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  connect();

  return () => listeners.delete(listener);
};

export function useStore() {
  return useSyncExternalStore(subscribe, () => state);
}

let braintrustLoading = false;

const loadBraintrust = () => {
  if (braintrustLoading) {
    return;
  }
  braintrustLoading = true;
  void fetch('/api/braintrust')
    .then(async (response) => {
      const body = await response.json() as ReportTypes.RunSummary[] | { error: string; setup?: boolean };
      set({ braintrust: Array.isArray(body) ? { runs: body } : { error: body.error, setup: Boolean(body.setup) } });
    })
    .catch((error: unknown) => set({
      braintrust: { error: String(error), setup: false },
    }))
    .finally(() => {
      braintrustLoading = false;
    });
};

// Braintrust runs are read from its API on first use; retry() asks again after a failure.
export function useBraintrust(enabled = true) {
  const { braintrust } = useStore();
  useEffect(
    () => {
      if (enabled && !state.braintrust) {
        loadBraintrust();
      }
    },
    [enabled],
  );

  return {
    runs: braintrust?.runs,
    error: braintrust?.error,
    setup: braintrust?.setup ?? false,
    loaded: Boolean(braintrust),
    retry: () => {
      set({ braintrust: undefined });
      loadBraintrust();
    },
  };
}

export function useRun(id: string | undefined, source: Source = 'evals') {
  const { details } = useStore();
  useEffect(
    () => {
      if (!id || state.details[id]) {
        return;
      }
      void fetch(source === 'braintrust' ? `/api/braintrust/${id}` : `/api/runs/${id}`)
        .then((response) => (response.ok ? response.json() as Promise<ReportTypes.Run> : undefined))
        .then((run) => {
          if (run) {
            set({
              details: { ...state.details, [id]: run },
            });
          }
        });
    },
    [id, source],
  );

  return id ? details[id] : undefined;
}

export function useActions() {
  const [pending, setPending] = useState(false);

  const post = useCallback(
    async (path: string, body?: unknown) => {
      setPending(true);
      try {
        const response = await fetch(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body ?? {}),
        });

        const result = (await response.json()) as { error?: string };

        if (!response.ok) {
          toast(result.error ?? `The dashboard answered ${response.status}`, 'error');
          return undefined;
        }

        return result;
      } catch (error) {
        toast(error instanceof Error ? error.message : String(error), 'error');
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [],
  );

  return {
    pending,
    start: (request: ReportTypes.RunRequest) => post('/api/runs', request) as Promise<ReportTypes.RunSummary | undefined>,
    setBaseline: (id: string) => post(`/api/runs/${id}/baseline`),
    cancel: (id: string) => post(`/api/runs/${id}/cancel`),
    rerun: (id: string, request: ReportTypes.RerunRequest) => post(`/api/runs/${id}/rerun`, request),
  };
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(text: string, tone: 'info' | 'warning' | 'error' = 'info') {
  clearTimeout(toastTimer);
  set({
    toast: { id: Date.now(), text, tone },
  });
  toastTimer = setTimeout(() => set({ toast: undefined }), tone === 'info' ? 3200 : 7000);
}

export function navigate(path: string) {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function usePath() {
  return useSyncExternalStore(
    (listener) => {
      window.addEventListener('popstate', listener);
      return () => window.removeEventListener('popstate', listener);
    },
    () => window.location.pathname,
  );
}
