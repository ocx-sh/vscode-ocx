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
