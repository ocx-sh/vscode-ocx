import * as assert from 'node:assert';

import { parseEnvJson } from '../ocx';

suite('parseEnvJson', () => {
  test('parses path and constant entries in declaration order', () => {
    const entries = parseEnvJson(
      JSON.stringify({
        entries: [
          { key: 'PATH', value: '/a/bin', type: 'path' },
          { key: 'OPENCODE_DISABLE_AUTOUPDATE', value: 'true', type: 'constant' },
          { key: 'PATH', value: '/b', type: 'path' },
        ],
      }),
    );
    assert.deepStrictEqual(entries, [
      { key: 'PATH', value: '/a/bin', type: 'path' },
      { key: 'OPENCODE_DISABLE_AUTOUPDATE', value: 'true', type: 'constant' },
      { key: 'PATH', value: '/b', type: 'path' },
    ]);
  });

  test('rejects an unsupported entry type', () => {
    assert.throws(
      () => parseEnvJson(JSON.stringify({ entries: [{ key: 'X', value: '1', type: 'plain' }] })),
      /unsupported entry type "plain"/,
    );
  });

  test('rejects a future/unknown modifier kind (e.g. prepend_value)', () => {
    assert.throws(
      () =>
        parseEnvJson(JSON.stringify({ entries: [{ key: 'X', value: '1', type: 'prepend_value' }] })),
      /unsupported entry type "prepend_value"/,
    );
  });

  test('rejects a non-string field', () => {
    assert.throws(() =>
      parseEnvJson(JSON.stringify({ entries: [{ key: 'X', value: 1, type: 'path' }] })),
    );
  });

  test('rejects a missing entries envelope', () => {
    assert.throws(() => parseEnvJson(JSON.stringify({ foo: 1 })));
  });

  test('accepts arbitrary keys for both kinds', () => {
    const entries = parseEnvJson(
      JSON.stringify({
        entries: [
          { key: 'JAVA_HOME', value: '/jdk', type: 'constant' },
          { key: 'LD_LIBRARY_PATH', value: '/lib', type: 'path' },
        ],
      }),
    );
    assert.strictEqual(entries.length, 2);
  });
});
