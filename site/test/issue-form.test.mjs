import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const form = parse(readFileSync(new URL('../../.github/ISSUE_TEMPLATE/plugin-request.yml', import.meta.url), 'utf8'));
const inputs = form.body.filter((b) => b.type !== 'markdown');

describe('plugin-request issue form', () => {
  it('has the three ids, a required what, and the plugin-request label', () => {
    expect(inputs.map((b) => b.id)).toEqual(['what', 'use-case', 'kind']);
    expect(inputs[0].validations.required).toBe(true);
    expect(form.labels).toEqual(['plugin-request']);
  });

  it('asks for no secrets in any field', () => {
    const texts = inputs.flatMap((b) => [b.attributes.label, b.attributes.description, b.attributes.placeholder, ...(b.attributes.options ?? [])]);
    for (const s of texts.filter(Boolean)) expect(s).not.toMatch(/secret|token|password|credential|api key/i);
  });

  it('opens with the no-secrets notice', () => {
    expect(form.body[0].type).toBe('markdown');
    expect(form.body[0].attributes.value).toBe('Do not include secrets, tokens, passwords or private code.');
  });
});
