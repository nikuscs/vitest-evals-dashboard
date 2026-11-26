import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createVite } from 'vite';
import { BraintrustSetupError, createBraintrust } from '#/server/braintrust.ts';
import { createCases } from '#/server/cases.ts';
import { createOpener } from '#/server/open.ts';
import { createPrices } from '#/server/prices.ts';
import { createRuns } from '#/server/runs.ts';
import { readSettings } from '#/server/settings.ts';
import type * as ReportTypes from '#/shared/report.types.ts';
import type { IncomingMessage, ServerResponse } from 'node:http';

const here = fileURLToPath(new URL('.', import.meta.url));
const packageRoot = resolve(here, '../..');
const settings = readSettings();

const clients = new Set<ServerResponse>();

const broadcast = (event: ReportTypes.ServerEvent) => {
  const data = `data: ${JSON.stringify(event)}\n\n`;

  for (const client of clients) {
    client.write(data);
  }
};

const prices = createPrices(settings.dataDir);
const cases = createCases(settings);
const opener = createOpener(() => cases.get());

const braintrust = createBraintrust({
  root: settings.root,
  dataDir: settings.dataDir,
  prices: () => prices.get(),
});

void cases.get()
  .catch(() => undefined);

const runs = createRuns({
  settings,
  reporterPath: resolve(here, 'reporter.ts'),
  prices: () => prices.get(),
  onEvent: broadcast,
});

for (const { file, label, baseline } of settings.imports) {
  runs.import(file, label, baseline);
}

const json = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
};

// A posted body is whatever the client sent, so every field is checked before use.
const body = async <T>(request: IncomingMessage): Promise<Partial<T>> => {
  request.setEncoding('utf8');
  let raw = '';

  for await (const chunk of request) {
    raw += chunk as string;
  }

  return JSON.parse(raw || '{}') as Partial<T>;
};

async function api(request: IncomingMessage, response: ServerResponse, path: string) {
  const [, , resource, id, action] = path.split('/');

  if (resource === 'events') {
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    response.write(': connected\n\n');
    clients.add(response);
    request.on('close', () => clients.delete(response));

    return;
  }

  if (resource === 'settings') {
    const current: ReportTypes.Settings = { models: settings.models, judges: settings.judges, apps: opener.apps, braintrust: braintrust.configured, defaultBranch: settings.defaultBranch };
    return json(response, 200, current);
  }

  if (resource === 'prices') {
    await prices.refresh();
    return json(response, 200, prices.get());
  }

  if (resource === 'braintrust') {
    try {
      if (!id) {
        return json(response, 200, await braintrust.list());
      }

      const run = await braintrust.get(id);
      return run ? json(response, 200, run) : json(response, 404, { error: 'Run not found' });
    } catch (error) {
      return json(response, error instanceof BraintrustSetupError ? 424 : 502, {
        error: error instanceof Error ? error.message : String(error),
        setup: error instanceof BraintrustSetupError,
      });
    }
  }

  if (resource === 'open' && request.method === 'POST') {
    const { caseId, app } = await body<{ caseId: string; app: ReportTypes.OpenApp }>(request);

    if (!caseId || !app || !opener.apps.includes(app)) {
      return json(response, 400, { error: 'Pick a case and an app' });
    }

    try {
      return json(response, 200, { opened: await opener.open(caseId, app) });
    } catch (error) {
      return json(response, 404, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  // A refresh spawns `vitest list`, so it is a POST and gets the cross-site check.
  if (resource === 'cases') {
    return json(response, 200, await cases.get(request.method === 'POST'));
  }

  if (resource !== 'runs') {
    return json(response, 404, { error: 'Not found' });
  }

  if (request.method === 'GET' && !id) {
    return json(response, 200, runs.list());
  }

  if (request.method === 'GET' && id) {
    const run = runs.get(id);
    return run ? json(response, 200, run) : json(response, 404, { error: 'Run not found' });
  }

  if (request.method === 'POST' && !id) {
    const { models, ...input } = await body<ReportTypes.RunRequest>(request);

    // Without --models the evals run as they are; with it, at least one model is picked.
    if (settings.models.length && !models?.length) {
      return json(response, 400, { error: 'Pick at least one model' });
    }

    // SAFETY: the dashboard's new-run form posts the whole request; only the models need a check.
    return json(response, 201, runs.start({ ...input, models: settings.models.length ? models ?? [] : [] } as ReportTypes.RunRequest));
  }

  if (request.method === 'POST' && id && action === 'baseline') {
    runs.setBaseline(id);
    return json(response, 200, { ok: true });
  }

  if (request.method === 'POST' && id && action === 'rerun') {
    const { cases: picked, ...input } = await body<ReportTypes.RerunRequest>(request);

    if (!picked?.length) {
      return json(response, 400, { error: 'Pick at least one case' });
    }

    // SAFETY: the dashboard's rerun form posts the whole request; only the cases need a check.
    const run = runs.rerun(id, { ...input, cases: picked } as ReportTypes.RerunRequest);
    return run ? json(response, 202, run) : json(response, 404, { error: 'Run not found' });
  }

  if (request.method === 'POST' && id && action === 'cancel') {
    runs.cancel(id);
    return json(response, 200, { ok: true });
  }

  return json(response, 405, { error: 'Method not allowed' });
}

// Only these hosts reach the dashboard, so a web page cannot rebind its own domain to this port and start runs.
const allowedHosts = ['localhost', settings.host, ...settings.allowedHosts];

const trusted = (host = '') => {
  const name = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return isIP(name) > 0 || allowedHosts.some((allowed) => (allowed.startsWith('.') ? name.endsWith(allowed) : name === allowed));
};

// A cross-site page can still POST a text/plain body without a preflight, so writes need a JSON body from the dashboard's own origin.
const sameOrigin = (request: IncomingMessage) => {
  const { origin, host } = request.headers;

  if (origin === undefined) {
    return true;
  }

  const from = URL.parse(origin);
  // Parsing the Host with the origin's scheme drops a default port (:80, :443) the same way the origin does.
  return Boolean(from && host && from.host === URL.parse(`${from.protocol}//${host}`)?.host);
};

const crossSite = (request: IncomingMessage) => {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return false;
  }

  return !sameOrigin(request) || !request.headers['content-type']?.toLowerCase().startsWith('application/json');
};

const server = createServer((request, response) => {
  if (!trusted(request.headers.host)) {
    return json(response, 403, { error: 'Host not allowed' });
  }

  const path = URL.parse(request.url ?? '/', 'http://localhost')?.pathname;

  if (!path) {
    return json(response, 400, { error: 'Bad request' });
  }

  // Vite's editor launcher opens any path and answers plain GETs, which any page can send. The dashboard uses /api/open instead.
  if (`${path} ${request.url}`.toLowerCase().includes('/__open-in-editor')) {
    return json(response, 404, { error: 'Not found' });
  }

  if (path.startsWith('/api/')) {
    if (crossSite(request)) {
      return json(response, 403, { error: 'Cross-site request refused' });
    }

    api(request, response, path).catch((error: unknown) => json(response, 500, { error: String(error) }));
    return;
  }
  vite.middlewares(request, response);
});

const vite = await createVite({
  configFile: resolve(packageRoot, 'vite.config.ts'),
  server: {
    middlewareMode: true,
    allowedHosts,
    hmr: { server },
  },
  appType: 'spa',
});

server.listen(settings.port, settings.host, () => {
  process.stdout.write(`Evals dashboard: http://${settings.host}:${settings.port}\n`);
});
