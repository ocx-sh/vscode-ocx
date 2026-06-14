import * as assert from 'node:assert';
import { chmodSync, writeFileSync } from 'node:fs';
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
});
