import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import Ajv from 'ajv';

// out/test/schema.test.js → repo root is two levels up.
const SCHEMA_PATH = path.resolve(__dirname, '../../schemas/ocx.toml.schema.json');

async function parseToml(toml: string): Promise<unknown> {
  // smol-toml is ESM-only; load it dynamically from this CJS test module.
  const { parse } = await import('smol-toml');
  return parse(toml);
}

suite('ocx.toml JSON schema', () => {
  const ajv = new Ajv({ allErrors: true });
  const schema: unknown = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
  const validate = ajv.compile(schema as object);

  test('accepts a valid ocx.toml', async () => {
    const data = await parseToml(
      ['[tools]', 'go-task = "ocx.sh/go-task:latest"', 'nodejs = "ocx.sh/nodejs:24"', '', '[group]'].join(
        '\n',
      ),
    );
    assert.strictEqual(validate(data), true, JSON.stringify(validate.errors));
  });

  test('accepts grouped bindings and digest-pinned identifiers', async () => {
    const data = await parseToml(
      [
        '[tools]',
        'go-task = "ocx.sh/go-task@sha256:fcfad89eae0672b309b5bcc7bb25e592cab244296dd9885233631b95da1ee41c"',
        '',
        '[group.ci]',
        'nodejs = "ocx.sh/nodejs:24"',
      ].join('\n'),
    );
    assert.strictEqual(validate(data), true, JSON.stringify(validate.errors));
  });

  test('rejects an unknown top-level key', async () => {
    const data = await parseToml('[tools]\ngo-task = "ocx.sh/go-task:latest"\n\n[unexpected]\nx = 1');
    assert.strictEqual(validate(data), false);
  });

  test('rejects a bare-tag identifier (no registry/repository path)', async () => {
    const data = await parseToml('[tools]\ngo-task = "latest"');
    assert.strictEqual(validate(data), false);
  });
});
