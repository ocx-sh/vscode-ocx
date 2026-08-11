import * as assert from 'node:assert';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';

// The vendored schema is draft 2020-12 (`$defs`), so it needs ajv's 2020 build —
// the default export only understands draft-07.
import Ajv from 'ajv/dist/2020';

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
      [
        '[tools]',
        'go-task = "ocx.sh/go-task/task:latest"',
        'uv = "ocx.sh/astral-sh/uv:0"',
        '',
        '[group]',
      ].join('\n'),
    );
    assert.strictEqual(validate(data), true, JSON.stringify(validate.errors));
  });

  test('accepts grouped bindings and digest-pinned identifiers', async () => {
    const data = await parseToml(
      [
        '[tools]',
        'go-task = "ocx.sh/go-task/task@sha256:fcfad89eae0672b309b5bcc7bb25e592cab244296dd9885233631b95da1ee41c"',
        '',
        '[group.ci.tools]',
        'uv = "ocx.sh/astral-sh/uv:0"',
      ].join('\n'),
    );
    assert.strictEqual(validate(data), true, JSON.stringify(validate.errors));
  });

  test('rejects a tool binding written directly under [group.<name>]', async () => {
    // The CLI raises ProjectErrorKind::GroupHoldsDirectBinding — bindings live
    // in [group.<name>.tools] only.
    const data = await parseToml('[group.ci]\nuv = "ocx.sh/astral-sh/uv:0"');
    assert.strictEqual(validate(data), false);
  });

  test('accepts the [env] shorthand and every modifier kind', async () => {
    const data = await parseToml(
      [
        '[env]',
        'CI = "1"',
        'JAVA_OPTS = { type = "constant", value = "-Xmx2g" }',
        'PATH = { type = "path", value = "node_modules/.bin" }',
        'GODEBUG = { type = "list", separator = ",", value = "gctrace=1" }',
        'JDK_JAVA_OPTIONS = { type = "list", value = "-Xmx2g" }',
      ].join('\n'),
    );
    assert.strictEqual(validate(data), true, JSON.stringify(validate.errors));
  });

  test('accepts a per-group [env] table', async () => {
    const data = await parseToml('[group.ci.env]\nGODEBUG = { type = "list", separator = ",", value = "gctrace=1" }');
    assert.strictEqual(validate(data), true, JSON.stringify(validate.errors));
  });

  test('rejects an unknown env modifier kind', async () => {
    const data = await parseToml('[env]\nX = { type = "prepend_value", value = "1" }');
    assert.strictEqual(validate(data), false);
  });

  test('rejects an env table missing its value', async () => {
    const data = await parseToml('[env]\nX = { type = "list", separator = "," }');
    assert.strictEqual(validate(data), false);
  });

  test('rejects an unknown top-level key', async () => {
    const data = await parseToml(
      '[tools]\ngo-task = "ocx.sh/go-task/task:latest"\n\n[unexpected]\nx = 1',
    );
    assert.strictEqual(validate(data), false);
  });

  test('rejects a bare-tag identifier (no registry/repository path)', async () => {
    const data = await parseToml('[tools]\ngo-task = "latest"');
    assert.strictEqual(validate(data), false);
  });
});
