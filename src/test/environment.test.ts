import * as assert from 'node:assert';

import * as vscode from 'vscode';

import { computeEnvPlan, EnvManager, envFingerprint } from '../environment';
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

  test('list appends to an empty variable with no leading separator', () => {
    const plan = computeEnvPlan(
      [{ key: 'GODEBUG', value: 'gctrace=1', type: 'list', separator: ',' }],
      {},
      ':',
    );
    assert.strictEqual(plan.processOps.find((op) => op.key === 'GODEBUG')?.value, 'gctrace=1');
  });

  test('list appends behind an existing baseline value', () => {
    const plan = computeEnvPlan(
      [{ key: 'GODEBUG', value: 'gctrace=1', type: 'list', separator: ',' }],
      { GODEBUG: 'madvdontneed=1' },
      ':',
    );
    assert.strictEqual(
      plan.processOps.find((op) => op.key === 'GODEBUG')?.value,
      'madvdontneed=1,gctrace=1',
    );
  });

  test('list moves a duplicate to the back rather than adding a second copy', () => {
    const plan = computeEnvPlan(
      [{ key: 'GODEBUG', value: 'gctrace=1', type: 'list', separator: ',' }],
      { GODEBUG: 'gctrace=1,madvdontneed=1' },
      ':',
    );
    assert.strictEqual(
      plan.processOps.find((op) => op.key === 'GODEBUG')?.value,
      'madvdontneed=1,gctrace=1',
    );
  });

  test('list drops adjacent duplicates that only meet once an earlier one is removed', () => {
    const plan = computeEnvPlan(
      [{ key: 'K', value: 'x', type: 'list', separator: ',' }],
      { K: 'x,x,a' },
      ':',
    );
    assert.strictEqual(plan.processOps.find((op) => op.key === 'K')?.value, 'a,x');
  });

  test('list with an all-duplicate baseline collapses to the bare value', () => {
    const plan = computeEnvPlan(
      [{ key: 'K', value: 'x', type: 'list', separator: ',' }],
      { K: 'x' },
      ':',
    );
    assert.strictEqual(plan.processOps.find((op) => op.key === 'K')?.value, 'x');
  });

  test('two list entries on one key append in array order', () => {
    const plan = computeEnvPlan(
      [
        { key: 'K', value: 'a', type: 'list', separator: ',' },
        { key: 'K', value: 'b', type: 'list', separator: ',' },
      ],
      {},
      ':',
    );
    assert.strictEqual(plan.processOps.find((op) => op.key === 'K')?.value, 'a,b');
  });

  test('list falls back to a single space when the entry carries no separator', () => {
    const plan = computeEnvPlan(
      [{ key: 'JDK_JAVA_OPTIONS', value: '-Xmx2g', type: 'list' }],
      { JDK_JAVA_OPTIONS: '-Xms1g' },
      ':',
    );
    assert.strictEqual(
      plan.processOps.find((op) => op.key === 'JDK_JAVA_OPTIONS')?.value,
      '-Xms1g -Xmx2g',
    );
  });

  test('list emits an append collection op carrying the leading separator', () => {
    const plan = computeEnvPlan(
      [{ key: 'GODEBUG', value: 'gctrace=1', type: 'list', separator: ',' }],
      {},
      ':',
    );
    assert.deepStrictEqual(plan.collectionOps, [
      { kind: 'append', key: 'GODEBUG', value: ',gctrace=1' },
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

suite('envFingerprint', () => {
  test('cross-key reorder yields an equal fingerprint (the regression)', () => {
    // Same logical env, different emission order — simulates ocx map-iteration
    // order for `constant` entries. Must NOT register as a change.
    const a: EnvEntry[] = [
      { key: 'PATH', value: '/a', type: 'path' },
      { key: 'PATH', value: '/b', type: 'path' },
      { key: 'FOO', value: '1', type: 'constant' },
    ];
    const b: EnvEntry[] = [
      { key: 'FOO', value: '1', type: 'constant' },
      { key: 'PATH', value: '/a', type: 'path' },
      { key: 'PATH', value: '/b', type: 'path' },
    ];
    assert.strictEqual(envFingerprint(a), envFingerprint(b));
  });

  test('intra-key (prepend) reorder is a real change', () => {
    const a: EnvEntry[] = [
      { key: 'PATH', value: '/a', type: 'path' },
      { key: 'PATH', value: '/b', type: 'path' },
    ];
    const b: EnvEntry[] = [
      { key: 'PATH', value: '/b', type: 'path' },
      { key: 'PATH', value: '/a', type: 'path' },
    ];
    assert.notStrictEqual(envFingerprint(a), envFingerprint(b));
  });

  test('a value difference is a change', () => {
    assert.notStrictEqual(
      envFingerprint([{ key: 'FOO', value: '1', type: 'constant' }]),
      envFingerprint([{ key: 'FOO', value: '2', type: 'constant' }]),
    );
  });

  test('a type difference is a change', () => {
    assert.notStrictEqual(
      envFingerprint([{ key: 'K', value: 'v', type: 'path' }]),
      envFingerprint([{ key: 'K', value: 'v', type: 'constant' }]),
    );
  });

  test('same-key path/constant ordering is preserved (a real change)', () => {
    const a: EnvEntry[] = [
      { key: 'K', value: '/dir', type: 'path' },
      { key: 'K', value: 'x', type: 'constant' },
    ];
    const b: EnvEntry[] = [
      { key: 'K', value: 'x', type: 'constant' },
      { key: 'K', value: '/dir', type: 'path' },
    ];
    assert.notStrictEqual(envFingerprint(a), envFingerprint(b));
  });

  test('duplicate identical entries are retained, not deduped', () => {
    assert.notStrictEqual(
      envFingerprint([
        { key: 'PATH', value: '/a', type: 'path' },
        { key: 'PATH', value: '/a', type: 'path' },
      ]),
      envFingerprint([{ key: 'PATH', value: '/a', type: 'path' }]),
    );
  });

  test('empty entries fingerprint is deterministic', () => {
    assert.strictEqual(envFingerprint([]), envFingerprint([]));
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
  append(key: string, value: string): void {
    this.ops.push({ kind: 'append', key, value });
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

  test('apply folds a list entry into process.env and appends to the collection', () => {
    const collection = new FakeCollection();
    const manager = new EnvManager(
      collection as unknown as vscode.GlobalEnvironmentVariableCollection,
      new FakeMemento(),
    );
    process.env[SCALAR] = 'a,b';

    manager.apply([{ key: SCALAR, value: 'a', type: 'list', separator: ',' }], {
      applyToTerminals: true,
    });

    assert.strictEqual(process.env[SCALAR], 'b,a');
    assert.deepStrictEqual(collection.ops, [{ kind: 'append', key: SCALAR, value: ',a' }]);

    manager.reset();
    assert.strictEqual(process.env[SCALAR], 'a,b');
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

suite('EnvManager changed detection (fakes)', () => {
  const KEYS = ['PATH', 'OCX_UNIT_FOO', 'OCX_UNIT_BAR'] as const;
  const saved = new Map<string, string | undefined>();

  setup(() => {
    for (const key of KEYS) {
      saved.set(key, process.env[key]);
    }
  });

  teardown(() => {
    for (const [key, value] of saved) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    saved.clear();
  });

  function newManager(): EnvManager {
    return new EnvManager(
      new FakeCollection() as unknown as vscode.GlobalEnvironmentVariableCollection,
      new FakeMemento(),
    );
  }

  test('cross-key reordered entries do not report a change (no spurious prompt)', () => {
    const manager = newManager();
    const original: EnvEntry[] = [
      { key: 'PATH', value: '/unit-bin', type: 'path' },
      { key: 'OCX_UNIT_FOO', value: '1', type: 'constant' },
      { key: 'OCX_UNIT_BAR', value: '2', type: 'constant' },
    ];
    // Same logical env, permuted emission order (simulates ocx map iteration).
    const reordered: EnvEntry[] = [
      { key: 'OCX_UNIT_BAR', value: '2', type: 'constant' },
      { key: 'PATH', value: '/unit-bin', type: 'path' },
      { key: 'OCX_UNIT_FOO', value: '1', type: 'constant' },
    ];

    assert.strictEqual(manager.apply(original, { applyToTerminals: false }).changed, true);
    assert.strictEqual(manager.apply(reordered, { applyToTerminals: false }).changed, false);

    manager.reset();
  });

  test('a genuine value edit reports a change', () => {
    const manager = newManager();

    assert.strictEqual(
      manager.apply([{ key: 'OCX_UNIT_FOO', value: '1', type: 'constant' }], {
        applyToTerminals: false,
      }).changed,
      true,
    );
    assert.strictEqual(
      manager.apply([{ key: 'OCX_UNIT_FOO', value: '2', type: 'constant' }], {
        applyToTerminals: false,
      }).changed,
      true,
    );

    manager.reset();
  });
});
