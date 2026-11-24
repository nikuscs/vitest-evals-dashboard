import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './globals.css';
import { initialDark, Shell } from './components/shell';
import { BraintrustPage } from './pages/braintrust-page';
import { RunPage } from './pages/run-page';
import { RunsPage } from './pages/runs-page';
import { usePath, useStore } from './store';
import type { Source } from './store';

function Home({ source }: { source: Source }) {
  return source === 'braintrust' ? <BraintrustPage /> : <RunsPage />;
}

function App() {
  const path = usePath();
  const { runs, braintrust } = useStore();
  const source: Source = path.startsWith('/braintrust') ? 'braintrust' : 'evals';
  const runId = (/^\/runs\/([^/]+)/.exec(path) ?? /^\/braintrust\/([^/]+)/.exec(path))?.[1];
  const run = (source === 'braintrust' ? braintrust?.runs ?? [] : runs).find((item) => item.id === runId);
  return (
    <Shell crumb={runId ? run?.label ?? 'Run' : undefined} source={source}>
      {runId ? <RunPage id={runId} key={runId} source={source} /> : <Home source={source} />}
    </Shell>
  );
}

initialDark();
const root = document.getElementById('root');

if (root) {
  createRoot(root).render(<StrictMode><App /></StrictMode>);
}
