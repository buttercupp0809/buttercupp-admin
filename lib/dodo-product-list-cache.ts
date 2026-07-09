export interface DodoProductOption {
  id: string;
  name: string;
  priceCents: number | null;
  currency: string | null;
  recurring: boolean;
}

interface CacheEntry {
  at: number;
  data: { products: DodoProductOption[]; environment: string };
}

export const PRODUCT_LIST_TTL_MS = 60_000;

// Mutable wrapper so both the list route (writer) and the create route
// (burster) share the same reference without hitting the ES module
// read-only binding constraint on named exports.
const store: { cache: CacheEntry | null } = { cache: null };

export function getProductListCache(): CacheEntry | null {
  return store.cache;
}

export function setProductListCache(entry: CacheEntry): void {
  store.cache = entry;
}

export function burstProductListCache(): void {
  store.cache = null;
}
