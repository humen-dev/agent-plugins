import { useSyncExternalStore } from 'react';
import { STORAGE_KEY } from './types.ts';

export function readStored(storage: Pick<Storage, 'getItem'> | null): string[] {
  try {
    const v: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
    return Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : [];
  } catch {
    return [];
  }
}

export interface InstallStore {
  get(): string[];
  edit(next: readonly string[]): void;
  preview(names: readonly string[]): void;
  clearPreview(): void;
  reset(): void;
  subscribe(fn: () => void): () => void;
}

export function createInstallStore(storage: () => Storage | null): InstallStore {
  const open = () => {
    try {
      return storage();
    } catch {
      return null;
    }
  };
  const subs = new Set<() => void>();
  const notify = () => subs.forEach((f) => f());
  let previewed: string[] | null = null;
  let memory: string[] | null = null;
  let stored: string[] | null = null;
  return {
    get: () => previewed ?? memory ?? (stored ??= readStored(open())),
    edit(next) {
      previewed = null;
      memory = [...next];
      try {
        open()?.setItem(STORAGE_KEY, JSON.stringify(memory));
      } catch {
        // EC-7: storage unavailable or full; the selection stays in memory
      }
      notify();
    },
    preview(names) {
      previewed = [...names];
      notify();
    },
    clearPreview() {
      if (previewed === null) return;
      previewed = null;
      notify();
    },
    reset() {
      previewed = memory = stored = null;
      notify();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
  };
}

export const installStore: InstallStore = createInstallStore(() => window.localStorage);

export function useInstallSelection(): string[] {
  return useSyncExternalStore(installStore.subscribe, installStore.get);
}
