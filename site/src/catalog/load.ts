import type { Catalog } from './types.ts';

export const loadCatalog = (): Promise<Catalog> => import('@generated/catalog').then((m) => m.default);
