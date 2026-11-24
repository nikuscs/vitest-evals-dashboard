import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ModelPrice, Prices } from '#/shared/report.types.ts';

const SOURCE = 'https://models.dev/api.json';
const DAY = 24 * 60 * 60 * 1000;

interface CatalogTier {
  input: number;
  output: number;
  tier?: { type?: string; size?: number };
}

interface CatalogModel {
  cost?: { input?: number; output?: number; tiers?: CatalogTier[] };
}

type Catalog = Record<string, { models?: Record<string, CatalogModel> }>;

function pricesFrom(catalog: Catalog): Prices {
  const prices: Prices = {};

  // Every provider's list prices; the first provider to list a model wins.
  for (const provider of Object.values(catalog)) {
    for (const [id, model] of Object.entries(provider.models ?? {})) {
      const { input, output, tiers } = model.cost ?? {};

      if (input === undefined || output === undefined) {
        continue;
      }

      const price: ModelPrice = {
        input,
        output,
        tiers: tiers?.filter((tier) => tier.tier?.type === 'context' && tier.tier.size)
          .map((tier) => ({
            input: tier.input,
            output: tier.output,
            size: tier.tier?.size ?? 0,
          })),
      };

      prices[id.split('@')[0] ?? id] ??= price;
    }
  }

  return prices;
}

// Model list prices from models.dev, cached for a day in the UI's data folder.
export function createPrices(dataDir: string) {
  const file = join(dataDir, 'prices.json');
  let prices: Prices = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as Prices : {};

  const refresh = async () => {
    if (existsSync(file) && Date.now() - statSync(file).mtimeMs < DAY && Object.keys(prices).length) {
      return;
    }

    try {
      const response = await fetch(SOURCE, { signal: AbortSignal.timeout(15_000) });

      if (!response.ok) {
        return;
      }
      prices = pricesFrom(await response.json() as Catalog);
      writeFileSync(file, JSON.stringify(prices));
    } catch {
      // Offline: keep the cached prices.
    }
  };

  void refresh();

  return {
    get: () => prices,
    refresh,
  };
}
