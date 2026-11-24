import { describe, expect, it } from 'vitest';
import { createInstallStore, readStored } from '../../src/install/store.ts';
import { STORAGE_KEY } from '../../src/install/types.ts';

const memStorage = (init: Record<string, string> = {}) => {
  const data = { ...init };
  return { data, s: { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) } as unknown as Storage };
};

describe('readStored', () => {
  it('returns [] for invalid values', () => {
    const of = (v: string | null) => readStored({ getItem: () => v });
    for (const v of [null, 'x', '{}', '[1]', '["a",2]']) expect(of(v)).toEqual([]);
    expect(readStored(null)).toEqual([]);
    expect(readStored({ getItem: () => { throw new Error('no'); } })).toEqual([]);
    expect(of('["a"]')).toEqual(['a']);
  });
});

describe('installStore', () => {
  it('preview leaves storage alone, edit writes it', () => {
    const { data, s } = memStorage({ [STORAGE_KEY]: '["a"]' });
    const st = createInstallStore(() => s);
    expect(st.get()).toEqual(['a']);
    st.preview(['x', 'y']);
    expect(st.get()).toEqual(['x', 'y']);
    expect(data[STORAGE_KEY]).toBe('["a"]');
    st.edit(['y']);
    expect(st.get()).toEqual(['y']);
    expect(JSON.parse(data[STORAGE_KEY])).toEqual(['y']);
  });

  it('returns a stable reference and notifies', () => {
    const st = createInstallStore(() => memStorage().s);
    expect(st.get()).toBe(st.get());
    let n = 0;
    const off = st.subscribe(() => n++);
    st.edit(['a']);
    st.preview(['b']);
    st.reset();
    off();
    st.edit(['c']);
    expect(n).toBe(3);
  });

  it('keeps the selection when storage throws (EC-7)', () => {
    const boom = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } } as unknown as Storage;
    for (const st of [createInstallStore(() => boom), createInstallStore(() => { throw new Error('x'); })]) {
      expect(st.get()).toEqual([]);
      expect(() => st.edit(['a'])).not.toThrow();
      expect(st.get()).toEqual(['a']);
    }
  });
});
