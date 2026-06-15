import * as assert from 'node:assert';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import * as vscode from 'vscode';

import type { OcxApi } from '../extension';

const STUB_PATH_DIR = '/ocx-test-bin';
const STUB_SCALAR = 'OCX_TEST_SCALAR';
const STUB_BAD_DIR = '/ocx-bad-bin';
const STUB_BAD_KEY = 'OCX_BAD_VAR';

// Fixed env emitted by the stub, in the real `ocx --format json env` shape.
const STUB_JSON = JSON.stringify({
  entries: [
    { key: 'PATH', value: STUB_PATH_DIR, type: 'path' },
    { key: STUB_SCALAR, value: 'scalar-value', type: 'constant' },
  ],
});

// An entry with an unsupported `type` precedes a valid one: parsing must reject
// the whole batch so nothing — not even the trailing path entry — is applied.
const STUB_BAD_JSON = JSON.stringify({
  entries: [
    { key: STUB_BAD_KEY, value: '1', type: 'future_kind' },
    { key: 'PATH', value: STUB_BAD_DIR, type: 'path' },
  ],
});

// The stub is a POSIX shell script; execFile cannot run it on Windows, so the
// env-injection assertions skip there (the pure unit tests cover that logic).
const isWindows = process.platform === 'win32';

function writeStub(name: string, json: string): string {
  const stubPath = path.join(tmpdir(), name);
  writeFileSync(stubPath, `#!/bin/sh\ncat <<'OCXJSON'\n${json}\nOCXJSON\n`);
  chmodSync(stubPath, 0o755);
  return stubPath;
}

/**
 * A stub that records its argv (one token per line) to `argsFile` before
 * emitting `json`, so a test can assert exactly which arguments reached `ocx`.
 */
function writeArgsStub(name: string, json: string, argsFile: string): string {
  const stubPath = path.join(tmpdir(), name);
  writeFileSync(
    stubPath,
    `#!/bin/sh\nprintf '%s\\n' "$@" > '${argsFile}'\ncat <<'OCXJSON'\n${json}\nOCXJSON\n`,
  );
  chmodSync(stubPath, 0o755);
  return stubPath;
}

async function setExecutable(value: string | undefined): Promise<void> {
  await vscode.workspace
    .getConfiguration('ocx')
    .update('path.executable', value, vscode.ConfigurationTarget.Global);
}

async function setApplyToTerminals(value: boolean | undefined): Promise<void> {
  await vscode.workspace
    .getConfiguration('ocx')
    .update('env.applyToTerminals', value, vscode.ConfigurationTarget.Global);
}

async function setGroups(value: readonly string[] | undefined): Promise<void> {
  await vscode.workspace
    .getConfiguration('ocx')
    .update('groups', value, vscode.ConfigurationTarget.Global);
}

let api: OcxApi;
let stubPath: string;
let stubBadPath: string;

suite('OCX extension', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('ocx-sh.ocx');
    assert.ok(ext, 'extension ocx-sh.ocx should be present');
    api = (await ext.activate()) as OcxApi;

    if (isWindows) {
      return;
    }
    stubPath = writeStub(`ocx-stub-${process.pid}.sh`, STUB_JSON);
    stubBadPath = writeStub(`ocx-stub-bad-${process.pid}.sh`, STUB_BAD_JSON);
    await setExecutable(stubPath);
  });

  suiteTeardown(async () => {
    if (isWindows) {
      return;
    }
    api.reset();
    await setExecutable(undefined);
  });

  test('registers all OCX commands and removes the bootstrap sample', async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const id of [
      'ocx.reload',
      'ocx.reset',
      'ocx.restartExtensions',
      'ocx.showOutput',
      'ocx.init',
      'ocx.lock',
      'ocx.pull',
      'ocx.upgrade',
      'ocx.clean',
    ]) {
      assert.ok(commands.includes(id), `expected command ${id} to be registered`);
    }
    assert.ok(!commands.includes('ocx.helloWorld'), 'ocx.helloWorld should be removed');
  });

  test('reload injects env into process.env; terminals untouched when off (default)', async function () {
    if (isWindows) {
      this.skip();
    }
    await api.reload();

    assert.ok(process.env.PATH?.includes(STUB_PATH_DIR), 'PATH should contain the stub dir');
    assert.strictEqual(process.env[STUB_SCALAR], 'scalar-value');

    // applyToTerminals is off by default: the host env is injected, but no
    // terminal mutators are set.
    assert.strictEqual(
      api.environmentVariableCollection.get('PATH'),
      undefined,
      'no PATH terminal mutator should be set when applyToTerminals is off',
    );
    assert.strictEqual(
      api.environmentVariableCollection.get(STUB_SCALAR),
      undefined,
      'no scalar terminal mutator should be set when applyToTerminals is off',
    );
  });

  test('applyToTerminals=true injects terminal mutators', async function () {
    if (isWindows) {
      this.skip();
    }
    await setApplyToTerminals(true);
    try {
      await api.reload();

      const pathMutator = api.environmentVariableCollection.get('PATH');
      assert.ok(pathMutator, 'a PATH terminal mutator should be set');
      assert.ok(pathMutator.value.includes(STUB_PATH_DIR));
      assert.ok(
        api.environmentVariableCollection.get(STUB_SCALAR),
        'a scalar terminal mutator should be set',
      );
    } finally {
      await setApplyToTerminals(undefined);
      api.reset();
    }
  });

  test('reset restores the baseline env', async function () {
    if (isWindows) {
      this.skip();
    }
    await api.reload();
    api.reset();

    assert.ok(!process.env.PATH?.includes(STUB_PATH_DIR), 'PATH should no longer contain the stub dir');
    assert.strictEqual(process.env[STUB_SCALAR], undefined);
  });

  test('rejects an unsupported entry type without mutating the environment', async function () {
    if (isWindows) {
      this.skip();
    }
    api.reset();
    await setExecutable(stubBadPath);

    await api.reload(); // must resolve (error is handled), not throw or crash the host

    assert.strictEqual(
      process.env[STUB_BAD_KEY],
      undefined,
      'an unsupported-type entry must not be applied',
    );
    assert.ok(
      !process.env.PATH?.includes(STUB_BAD_DIR),
      'no entry should be applied when the batch is rejected',
    );

    await setExecutable(stubPath);
  });

  test('ocx.groups reach the ocx env invocation (normalized, after env)', async function () {
    if (isWindows) {
      this.skip();
    }
    api.reset();
    const argsFile = path.join(tmpdir(), `ocx-args-${process.pid}`);
    const argStub = writeArgsStub(`ocx-stub-args-${process.pid}.sh`, STUB_JSON, argsFile);
    await setExecutable(argStub);
    // A blank entry (dropped) and a padded entry ('  ci  ' → 'ci') prove both
    // halves of boundary normalization: blank-drop and trim-but-keep.
    await setGroups(['  ', '  ci  ', 'lint']);
    try {
      await api.reload();

      const recorded = readFileSync(argsFile, 'utf8').trim().split('\n');
      // Global flags precede the subcommand; the project path is discovered.
      assert.deepStrictEqual(recorded.slice(0, 3), ['--format', 'json', '--project']);
      assert.ok(recorded[3]?.endsWith('ocx.toml'), 'third flag value is the project ocx.toml');
      // Group selectors follow `env`, one --group per entry, blanks dropped.
      assert.deepStrictEqual(recorded.slice(4), ['env', '--group', 'ci', '--group', 'lint']);
    } finally {
      await setGroups(undefined);
      await setExecutable(stubPath);
      api.reset();
    }
  });

  test('no ocx.groups → no --group argument', async function () {
    if (isWindows) {
      this.skip();
    }
    api.reset();
    const argsFile = path.join(tmpdir(), `ocx-args-empty-${process.pid}`);
    const argStub = writeArgsStub(`ocx-stub-args-empty-${process.pid}.sh`, STUB_JSON, argsFile);
    await setExecutable(argStub);
    try {
      await api.reload();

      const recorded = readFileSync(argsFile, 'utf8').trim().split('\n');
      assert.ok(!recorded.includes('--group'), 'no --group token when ocx.groups is empty');
      assert.strictEqual(recorded.at(-1), 'env', 'env is the final token with no groups');
    } finally {
      await setExecutable(stubPath);
      api.reset();
    }
  });

  // `clean` is the one project command that does NOT trigger a reload, so the
  // args stub records only the clean invocation (no env call overwrites it).
  test('ocx.clean runs the subcommand with --project before it', async function () {
    if (isWindows) {
      this.skip();
    }
    api.reset();
    const argsFile = path.join(tmpdir(), `ocx-args-clean-${process.pid}`);
    const argStub = writeArgsStub(`ocx-stub-clean-${process.pid}.sh`, STUB_JSON, argsFile);
    await setExecutable(argStub);
    try {
      await vscode.commands.executeCommand('ocx.clean');

      const recorded = readFileSync(argsFile, 'utf8').trim().split('\n');
      assert.strictEqual(recorded[0], '--project', 'global --project precedes the subcommand');
      assert.ok(recorded[1]?.endsWith('ocx.toml'), 'second token is the discovered project ocx.toml');
      assert.strictEqual(recorded[2], 'clean', 'the subcommand follows the global flags');
      assert.ok(!recorded.includes('--group'), 'clean never receives a --group selector');
    } finally {
      await setExecutable(stubPath);
      api.reset();
    }
  });
});
