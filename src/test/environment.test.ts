import * as assert from 'node:assert';

import * as vscode from 'vscode';

import { computeEnvPlan, EnvManager } from '../environment';
import type { EnvEntry } from '../ocx';

// The exact JSON shape emitted by `ocx --format json env`.
const ENTRIES: EnvEntry[] = [
  { key: 'PATH', value: '/a', type: 'path' },
  { key: 'PATH', value: '/b', type: 'path' },
  { key: 'FOO', value: '1', type: 'constant' },
];

suite('computeEnvPlan', () => {
  test('prepends path entries in array order (last entry wins the front)', () => {
    const plan = computeEnvPlan(ENTRIES, { PATH: '/orig' }, ':');

    const pathOp = plan.processOps.find((op) => op.key === 'PATH');
    // /a applied first (→ /a:/orig), then /b (→ /b:/a:/orig); mirrors bash eval.
    assert.strictEqual(pathOp?.value, '/b:/a:/orig');
  });

  test('replaces scalar (non-path) entries', () => {
    const plan = computeEnvPlan(ENTRIES, { PATH: '/orig' }, ':');
    const fooOp = plan.processOps.find((op) => op.key === 'FOO');
    assert.strictEqual(fooOp?.value, '1');
  });

  test('emits ordered collection ops: two PATH prepends then a FOO replace', () => {
    const plan = computeEnvPlan(ENTRIES, { PATH: '/orig' }, ':');
    assert.deepStrictEqual(plan.collectionOps, [
      { kind: 'prepend', key: 'PATH', value: '/a:' },
      { kind: 'prepend', key: 'PATH', value: '/b:' },
      { kind: 'replace', key: 'FOO', value: '1' },
    ]);
  });

  test('reports every touched key once', () => {
    const plan = computeEnvPlan(ENTRIES, { PATH: '/orig' }, ':');
    assert.deepStrictEqual([...plan.touchedKeys].sort(), ['FOO', 'PATH']);
  });

  test('absent baseline PATH yields the value with no stray delimiter', () => {
    const plan = computeEnvPlan([{ key: 'PATH', value: '/a', type: 'path' }], {}, ':');
    assert.strictEqual(plan.processOps.find((op) => op.key === 'PATH')?.value, '/a');
  });

  test('constant replaces an existing baseline value', () => {
    const plan = computeEnvPlan(
      [{ key: 'JAVA_HOME', value: '/new', type: 'constant' }],
      { JAVA_HOME: '/old' },
      ':',
    );
    assert.strictEqual(plan.processOps.find((op) => op.key === 'JAVA_HOME')?.value, '/new');
  });

  test('same key, path then constant: constant wins, both ops preserved in order', () => {
    const plan = computeEnvPlan(
      [
        { key: 'K', value: '/dir', type: 'path' },
        { key: 'K', value: 'x', type: 'constant' },
      ],
      {},
      ':',
    );
    assert.strictEqual(plan.processOps.find((op) => op.key === 'K')?.value, 'x');
    assert.deepStrictEqual(plan.collectionOps, [
      { kind: 'prepend', key: 'K', value: '/dir:' },
      { kind: 'replace', key: 'K', value: 'x' },
    ]);
  });

  test('same key, constant then path: path prepends onto the constant value', () => {
    const plan = computeEnvPlan(
      [
        { key: 'K', value: 'base', type: 'constant' },
        { key: 'K', value: '/dir', type: 'path' },
      ],
      {},
      ':',
    );
    assert.strictEqual(plan.processOps.find((op) => op.key === 'K')?.value, '/dir:base');
  });
});

/** Minimal in-memory Memento for unit-testing EnvManager without the host. */
class FakeMemento implements vscode.Memento {
  private readonly store = new Map<string, unknown>();
  keys(): readonly string[] {
    return [...this.store.keys()];
  }
  get<T>(key: string, defaultValue?: T): T | undefined {
    return this.store.has(key) ? (this.store.get(key) as T) : defaultValue;
  }
  update(key: string, value: unknown): Thenable<void> {
    if (value === undefined) {
      this.store.delete(key);
    } else {
      this.store.set(key, value);
    }
    return Promise.resolve();
  }
}

/** Records the mutations EnvManager applies to a terminal collection. */
class FakeCollection {
  persistent = true;
  description: string | vscode.MarkdownString | undefined;
  readonly ops: Array<{ kind: string; key: string; value: string }> = [];
  prepend(key: string, value: string): void {
    this.ops.push({ kind: 'prepend', key, value });
  }
  replace(key: string, value: string): void {
    this.ops.push({ kind: 'replace', key, value });
  }
  clear(): void {
    this.ops.length = 0;
  }
}

suite('EnvManager apply/reset (fakes)', () => {
  const SCALAR = 'OCX_UNIT_SCALAR';
  let savedPath: string | undefined;
  let savedScalar: string | undefined;

  setup(() => {
    savedPath = process.env.PATH;
    savedScalar = process.env[SCALAR];
  });

  teardown(() => {
    if (savedPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = savedPath;
    }
    if (savedScalar === undefined) {
      delete process.env[SCALAR];
    } else {
      process.env[SCALAR] = savedScalar;
    }
  });

  test('apply mutates process.env; reset restores it exactly', () => {
    const collection = new FakeCollection();
    const manager = new EnvManager(
      collection as unknown as vscode.GlobalEnvironmentVariableCollection,
      new FakeMemento(),
    );

    const before = process.env.PATH;
    const result = manager.apply(
      [
        { key: 'PATH', value: '/unit-bin', type: 'path' },
        { key: SCALAR, value: 'x', type: 'constant' },
      ],
      { applyToTerminals: true },
    );

    assert.strictEqual(result.count, 2);
    assert.ok(process.env.PATH?.startsWith('/unit-bin'));
    assert.strictEqual(process.env[SCALAR], 'x');
    assert.strictEqual(collection.ops.length, 2);

    manager.reset();
    assert.strictEqual(process.env.PATH, before);
    assert.strictEqual(process.env[SCALAR], undefined);
    assert.strictEqual(collection.ops.length, 0);
  });

  test('changed flag tracks the cached snapshot', () => {
    const manager = new EnvManager(
      new FakeCollection() as unknown as vscode.GlobalEnvironmentVariableCollection,
      new FakeMemento(),
    );
    const entries: EnvEntry[] = [{ key: SCALAR, value: 'y', type: 'constant' }];

    assert.strictEqual(manager.apply(entries, { applyToTerminals: false }).changed, true);
    // Same entries again (simulating a fresh ext host) → silent, no re-prompt.
    assert.strictEqual(manager.apply(entries, { applyToTerminals: false }).changed, false);

    manager.reset();
  });

  test('applyToTerminals: false skips collection mutations', () => {
    const collection = new FakeCollection();
    const manager = new EnvManager(
      collection as unknown as vscode.GlobalEnvironmentVariableCollection,
      new FakeMemento(),
    );

    manager.apply([{ key: SCALAR, value: 'z', type: 'constant' }], { applyToTerminals: false });
    assert.strictEqual(collection.ops.length, 0);
    assert.strictEqual(process.env[SCALAR], 'z');

    manager.reset();
  });
});
