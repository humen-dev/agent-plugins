import { describe, expect, it } from 'vitest';
import { requestUrl } from '../../src/links/request-url.ts';

const repo = 'https://github.com/o/r';

describe('requestUrl', () => {
  it('keeps one title and one what value for a hostile query', () => {
    const p = new URL(requestUrl(repo, 'x&labels=bug')).searchParams;
    expect(p.getAll('title')).toEqual(['x&labels=bug']);
    expect(p.getAll('what')).toEqual(['x&labels=bug']);
    expect(p.get('labels')).toBeNull();
    expect(p.get('template')).toBe('plugin-request.yml');
  });

  it('gives empty params for an empty query', () => {
    expect(requestUrl(repo, '  ')).toBe(`${repo}/issues/new?template=plugin-request.yml&title=&what=`);
  });

  it('percent-encodes # ? = & and keeps one title and one what', () => {
    const url = requestUrl(repo, 'a#b?c=d&e');
    const p = new URL(url).searchParams;
    expect(p.getAll('title')).toEqual(['a#b?c=d&e']);
    expect(p.getAll('what')).toEqual(['a#b?c=d&e']);
    for (const enc of ['%23', '%3F', '%3D', '%26']) expect(url).toContain(enc);
  });

  it('drops everything after 200 chars', () => {
    const p = new URL(requestUrl(repo, 'a'.repeat(201))).searchParams;
    expect(p.get('title')).toBe('a'.repeat(200));
  });
});
