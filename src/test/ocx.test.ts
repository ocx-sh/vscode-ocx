import * as assert from 'node:assert';

import { buildEnvArgs, buildSubcommandArgs, isUnsupportedGroupFlag, parseEnvJson } from '../ocx';

suite('buildEnvArgs', () => {
  const TOML = '/work/ocx.toml';

  test('no groups → global flags before env, no --group', () => {
    assert.deepStrictEqual(buildEnvArgs(TOML, []), [
      '--format',
      'json',
      '--project',
      TOML,
      'env',
    ]);
  });

  test('a single group appends one --group token after env', () => {
    assert.deepStrictEqual(buildEnvArgs(TOML, ['ci']), [
      '--format',
      'json',
      '--project',
      TOML,
      'env',
      '--group',
      'ci',
    ]);
  });

  test('multiple groups each get their own --group, in order', () => {
    assert.deepStrictEqual(buildEnvArgs(TOML, ['default', 'ci', 'lint']), [
      '--format',
      'json',
      '--project',
      TOML,
      'env',
      '--group',
      'default',
      '--group',
      'ci',
      '--group',
      'lint',
    ]);
  });

  test('group values are passed verbatim, never comma-joined', () => {
    // The extension emits one --group per entry; it never splits/joins on commas.
    const args = buildEnvArgs(TOML, ['all']);
    assert.deepStrictEqual(args.slice(-2), ['--group', 'all']);
    assert.ok(!args.includes('default,ci'));
  });
});

suite('buildSubcommandArgs', () => {
  const TOML = '/work/ocx.toml';

  test('lock/upgrade/clean → --project before the subcommand, no group flags', () => {
    for (const sub of ['lock', 'upgrade', 'clean'] as const) {
      assert.deepStrictEqual(buildSubcommandArgs(TOML, sub, []), ['--project', TOML, sub]);
    }
  });

  test('non-pull subcommands ignore groups (only pull accepts --group)', () => {
    for (const sub of ['lock', 'upgrade', 'clean'] as const) {
      assert.deepStrictEqual(buildSubcommandArgs(TOML, sub, ['ci', 'lint']), [
        '--project',
        TOML,
        sub,
      ]);
    }
  });

  test('pull with no groups is a bare pull (CLI default pulls everything)', () => {
    assert.deepStrictEqual(buildSubcommandArgs(TOML, 'pull', []), ['--project', TOML, 'pull']);
  });

  test('pull appends one --group per entry, in order, never comma-joined', () => {
    const args = buildSubcommandArgs(TOML, 'pull', ['default', 'ci']);
    assert.deepStrictEqual(args, [
      '--project',
      TOML,
      'pull',
      '--group',
      'default',
      '--group',
      'ci',
    ]);
    assert.ok(!args.includes('default,ci'));
  });
});

suite('isUnsupportedGroupFlag', () => {
  test('matches the clap "unexpected argument --group" usage error', () => {
    assert.ok(isUnsupportedGroupFlag("error: unexpected argument '--group' found"));
    // Quoting/locale variants still match on the two stable substrings.
    assert.ok(isUnsupportedGroupFlag('unexpected argument --group found'));
  });

  test('does not match unrelated env failures', () => {
    assert.ok(!isUnsupportedGroupFlag('ocx.lock not found; run `ocx lock`'));
    assert.ok(!isUnsupportedGroupFlag('unexpected argument --shell found'));
    assert.ok(!isUnsupportedGroupFlag(''));
  });
});

suite('parseEnvJson (ocx <= 0.6.5 shape: entries/type)', () => {
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

  test('parses a list entry with its separator', () => {
    const entries = parseEnvJson(
      JSON.stringify({
        entries: [{ key: 'GODEBUG', value: 'gctrace=1', type: 'list', separator: ',' }],
      }),
    );
    assert.deepStrictEqual(entries, [
      { key: 'GODEBUG', value: 'gctrace=1', type: 'list', separator: ',' },
    ]);
  });

  test('defaults an omitted list separator to a single space', () => {
    const entries = parseEnvJson(
      JSON.stringify({ entries: [{ key: 'JDK_JAVA_OPTIONS', value: '-Xmx2g', type: 'list' }] }),
    );
    assert.deepStrictEqual(entries, [
      { key: 'JDK_JAVA_OPTIONS', value: '-Xmx2g', type: 'list', separator: ' ' },
    ]);
  });

  test('rejects an empty list separator (it would never terminate the fold)', () => {
    assert.throws(
      () =>
        parseEnvJson(
          JSON.stringify({ entries: [{ key: 'X', value: '1', type: 'list', separator: '' }] }),
        ),
      /separator must not be empty/,
    );
  });

  test('rejects a non-string list separator', () => {
    assert.throws(
      () =>
        parseEnvJson(
          JSON.stringify({ entries: [{ key: 'X', value: '1', type: 'list', separator: 1 }] }),
        ),
      /separator must be a string/,
    );
  });

  test('ignores a separator on a non-list entry (the CLI already rejects it)', () => {
    const entries = parseEnvJson(
      JSON.stringify({ entries: [{ key: 'X', value: '1', type: 'constant', separator: ',' }] }),
    );
    assert.deepStrictEqual(entries, [{ key: 'X', value: '1', type: 'constant' }]);
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

suite('parseEnvJson (ocx >= 0.6.6 shape: items/kind)', () => {
  const LEGACY = JSON.stringify({
    entries: [
      { key: 'PATH', value: '/x/bin', type: 'path' },
      { key: 'CFLAGS', value: '-Wall', type: 'list', separator: ' ' },
    ],
    binaries: [],
  });
  const CURRENT = JSON.stringify({
    schema_version: 1,
    items: [
      { key: 'PATH', value: '/x/bin', kind: 'path' },
      { key: 'CFLAGS', value: '-Wall', kind: 'list', separator: ' ' },
    ],
    binaries: [],
    entrypoints: [],
    integrations: [],
    advisories: [],
  });

  test('the full 0.6.8 document parses to the same entries as its legacy twin', () => {
    assert.deepStrictEqual(parseEnvJson(CURRENT), parseEnvJson(LEGACY));
    assert.deepStrictEqual(parseEnvJson(CURRENT), [
      { key: 'PATH', value: '/x/bin', type: 'path' },
      { key: 'CFLAGS', value: '-Wall', type: 'list', separator: ' ' },
    ]);
  });

  test('rejects an unknown kind', () => {
    assert.throws(
      () => parseEnvJson(JSON.stringify({ items: [{ key: 'X', value: '1', kind: 'plain' }] })),
      /unsupported entry type "plain"/,
    );
  });

  test('rejects items that is not an array', () => {
    assert.throws(() => parseEnvJson(JSON.stringify({ items: {} })), /"items" is not an array/);
  });

  test('items wins over entries, so a malformed items is not rescued by entries', () => {
    assert.throws(
      () => parseEnvJson(JSON.stringify({ items: {}, entries: [] })),
      /"items" is not an array/,
    );
  });

  test('kind wins over type when an item carries both', () => {
    assert.deepStrictEqual(
      parseEnvJson(
        JSON.stringify({ items: [{ key: 'X', value: '1', kind: 'path', type: 'constant' }] }),
      ),
      [{ key: 'X', value: '1', type: 'path' }],
    );
  });

  test('rejects a document with neither items nor entries', () => {
    assert.throws(
      () => parseEnvJson(JSON.stringify({ schema_version: 1 })),
      /missing "items" or "entries"/,
    );
  });

  test('defaults an omitted list separator', () => {
    assert.deepStrictEqual(
      parseEnvJson(JSON.stringify({ items: [{ key: 'X', value: '1', kind: 'list' }] })),
      [{ key: 'X', value: '1', type: 'list', separator: ' ' }],
    );
  });
});
