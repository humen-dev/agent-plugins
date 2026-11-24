import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { en } from '../src/i18n/en.ts';

const SRC = join(import.meta.dirname, '..', 'src');
const ATTRS = new Set(['aria-label', 'title', 'placeholder', 'alt']);
const hasLetter = (s: string) => /\p{L}/u.test(s);
const isStr = (n: ts.Node): n is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);

function resolves(key: string): boolean {
  let v: unknown = en;
  for (const part of key.split('.')) {
    if (typeof v !== 'object' || v === null || !(part in v)) return false;
    v = (v as Record<string, unknown>)[part];
  }
  return typeof v === 'string' || (typeof v === 'object' && v !== null && 'one' in v && 'other' in v);
}

export function scan(text: string, name = 'x.tsx'): string[] {
  const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const at = (n: ts.Node) => `${name}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;
  const literals = (n: ts.Node) => {
    // a t('…') call is the sanctioned source of a string, so its key is not a literal to flag
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 't') return;
    if (isStr(n) && hasLetter(n.text)) out.push(`${at(n)} literal "${n.text}" in attribute`);
    ts.forEachChild(n, literals);
  };
  const visit = (n: ts.Node) => {
    if (ts.isJsxText(n) && hasLetter(n.text)) out.push(`${at(n)} JSX text "${n.text.trim()}"`);
    if (ts.isJsxAttribute(n) && ATTRS.has(n.name.getText(sf)) && n.initializer) literals(n.initializer);
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 't') {
      const [k] = n.arguments;
      if (!k || !isStr(k)) out.push(`${at(n)} t() key is not a string literal`);
      else if (!resolves(k.text)) out.push(`${at(n)} unknown key "${k.text}"`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

const tsxFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tsxFiles(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : [],
  );

describe('AC-63 translations', () => {
  it('every src/**/*.tsx takes its strings from en.ts', () => {
    const files = tsxFiles(SRC);
    expect(files.length).toBeGreaterThan(5);
    const problems = files.flatMap((f) => scan(readFileSync(f, 'utf8'), f));
    expect(problems).toEqual([]);
  });

  it('accepts clean code', () => {
    expect(scan(`const a = <button aria-label={t('header.menu')} title={t('header.menu')}>{t('header.menu')}<b>{x}</b></button>;`)).toEqual([]);
  });

  it('fails on planted JSX text', () => {
    expect(scan(`const a = <p>Hello</p>;`)).toHaveLength(1);
  });

  it('fails on planted attribute literals, also inside expressions', () => {
    expect(scan(`const a = <i aria-label="Close" />;`)).toHaveLength(1);
    expect(scan(`const a = <i title={'Close'} />;`)).toHaveLength(1);
    expect(scan(`const a = <i placeholder={x ? 'a' : t('header.menu')} />;`)).toHaveLength(1);
    expect(scan(`const a = <img alt="logo" />;`)).toHaveLength(1);
  });

  it('fails on unknown or non-literal keys', () => {
    expect(scan(`t('no.such.key');`)).toHaveLength(1);
    expect(scan(`t('card');`)).toHaveLength(1);
    expect(scan(`t(k);`)).toHaveLength(1);
    expect(scan(`t('search.count', { n: 1 });`)).toEqual([]);
  });
});
