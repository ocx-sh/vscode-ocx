import * as path from 'node:path';
import * as vscode from 'vscode';

import { LIST_DEFAULT_SEPARATOR, type EnvEntry } from './ocx';

/** A final value to set into `process.env`. */
export interface ProcessEnvOp {
  readonly key: string;
  readonly value: string;
}

/** A mutation to apply to an `EnvironmentVariableCollection`. */
export interface CollectionOp {
  readonly kind: 'prepend' | 'replace' | 'append';
  readonly key: string;
  /**
   * For `prepend` this already includes the trailing path delimiter; for
   * `append`, the leading list separator.
   */
  readonly value: string;
}

/** The computed effect of a set of {@link EnvEntry}s on an environment. */
export interface EnvPlan {
  /** Final `key=value` assignments for `process.env`, one per touched key. */
  readonly processOps: readonly ProcessEnvOp[];
  /**
   * Ordered terminal-collection mutations: prepend for `path`, replace for
   * `constant`, append for `list`.
   */
  readonly collectionOps: readonly CollectionOp[];
  /** Every variable name affected (for backup/restore). */
  readonly touchedKeys: readonly string[];
}

/**
 * Append `value` to `existing`, joined by `separator`, having first removed
 * every earlier occurrence of `value` — a *move-to-back*, not a
 * skip-if-present. Byte-identical to `ocx_lib` `utility::list::append_unique`
 * (pinned by the upstream env-modifier ADR), so a terminal composed by `ocx`
 * and one composed here agree.
 *
 * The fold wraps the existing value in the separator so first and last elements
 * match the same needle, collapses `sep+value+sep` to `sep` until no match is
 * left, then unwraps. The single `replace` in a loop is deliberate:
 * `replaceAll` misses duplicates that only become adjacent once an earlier one
 * is removed.
 *
 * `separator` must be non-empty — an empty one never terminates. That is
 * enforced at the wire boundary when the entry is parsed (see `src/ocx.ts`).
 */
export function appendUnique(
  existing: string | undefined,
  value: string,
  separator: string,
): string {
  if (!existing) {
    return value;
  }
  const needle = separator + value + separator;
  let wrapped = separator + existing + separator;
  while (wrapped.includes(needle)) {
    wrapped = wrapped.replace(needle, separator);
  }
  const remainder = wrapped.slice(separator.length, wrapped.length - separator.length);
  return remainder ? remainder + separator + value : value;
}

/**
 * Pure mapping from `ocx` env entries to environment operations — no `vscode`,
 * no I/O, so it is unit-testable without the extension host (SRP).
 *
 * `type: "path"` entries prepend `value + delimiter` to the variable;
 * `type: "constant"` entries replace it; `type: "list"` entries append `value`
 * joined by the entry's separator, moving any earlier occurrence to the back
 * (see {@link appendUnique}). Applying entries in array order mirrors
 * `ocx env --shell=bash` emitting `export PATH="dir:${PATH}"` per line: the last
 * path entry ends up first on `PATH`. Entries of any kind may target any key.
 *
 * The terminal collection gets `append` for a `list` entry, mirroring the
 * `prepend` a `path` entry gets: `EnvironmentVariableCollection` has no
 * mutator that can express the dedupe fold, and `replace` would clobber a value
 * the user set in their own shell profile. A duplicate list element is
 * cosmetic; a clobbered one is not.
 *
 * @param baselineEnv pre-injection environment (so repeated calls don't stack).
 * @param delimiter   path separator (defaults to the platform's `path.delimiter`).
 */
export function computeEnvPlan(
  entries: readonly EnvEntry[],
  baselineEnv: Readonly<Record<string, string | undefined>>,
  delimiter: string = path.delimiter,
): EnvPlan {
  const working = new Map<string, string>();
  const collectionOps: CollectionOp[] = [];
  const touched = new Set<string>();

  const current = (key: string): string | undefined =>
    working.has(key) ? working.get(key) : baselineEnv[key];

  for (const entry of entries) {
    touched.add(entry.key);
    switch (entry.type) {
      case 'path': {
        const prefix = entry.value + delimiter;
        const existing = current(entry.key);
        working.set(entry.key, existing ? prefix + existing : entry.value);
        collectionOps.push({ kind: 'prepend', key: entry.key, value: prefix });
        break;
      }
      case 'constant': {
        working.set(entry.key, entry.value);
        collectionOps.push({ kind: 'replace', key: entry.key, value: entry.value });
        break;
      }
      case 'list': {
        const separator = entry.separator ?? LIST_DEFAULT_SEPARATOR;
        working.set(entry.key, appendUnique(current(entry.key), entry.value, separator));
        collectionOps.push({ kind: 'append', key: entry.key, value: separator + entry.value });
        break;
      }
      default: {
        const exhaustive: never = entry.type;
        throw new Error(`computeEnvPlan: unsupported entry type ${String(exhaustive)}`);
      }
    }
  }

  const processOps: ProcessEnvOp[] = [];
  for (const key of touched) {
    const value = working.get(key);
    if (value !== undefined) {
      processOps.push({ key, value });
    }
  }

  return { processOps, collectionOps, touchedKeys: [...touched] };
}

const CACHE_KEY = 'ocx.lastAppliedEnv';

/**
 * Canonical fingerprint of a composed environment, deciding whether a reload
 * actually changed anything (→ whether to prompt for a restart).
 *
 * `ocx --format json env` may re-emit the SAME entries in a different array order
 * between runs (map-iteration order for `constant` entries), so a raw
 * `JSON.stringify(entries)` flips spuriously on a mere `ocx.toml`/`ocx.lock` touch.
 * Entries for DIFFERENT keys never interact in {@link computeEnvPlan}, so cross-key
 * order is inert — sort by key to neutralize it. The sort is STABLE (ES2019+, V8
 * extension host), so the relative order of entries sharing a key — which IS
 * meaningful (prepend sequence for `type:"path"`) — is preserved.
 */
export function envFingerprint(entries: readonly EnvEntry[]): string {
  const canonical = [...entries].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return JSON.stringify(canonical);
}

const MUTATOR_OPTIONS: vscode.EnvironmentVariableMutatorOptions = {
  applyAtProcessCreation: true,
  applyAtShellIntegration: true,
};

/** Outcome of {@link EnvManager.apply}. */
export interface ApplyResult {
  /** Number of entries applied. */
  readonly count: number;
  /** True when the applied env differs from the last cached snapshot. */
  readonly changed: boolean;
}

/**
 * Owns the two injection surfaces and the restart-loop guard:
 *
 * - `process.env` — reaches extensions and the LSPs/child processes they spawn.
 * - `EnvironmentVariableCollection` — reaches terminals and tasks.
 *
 * Every `apply` first restores the baseline so reloads never stack `PATH`. A
 * checksum of the applied entries is cached in `workspaceState`; a fresh ext
 * host recomputes the same env (→ `changed: false`, silent), while a real edit
 * yields a different snapshot (→ `changed: true`, callers may prompt to
 * restart). Mirrors direnv-vscode's checksum cache.
 */
export class EnvManager {
  /** Original values of touched keys (`undefined` ⇒ the key was absent). */
  private readonly backup = new Map<string, string | undefined>();

  constructor(
    private readonly collection: vscode.GlobalEnvironmentVariableCollection,
    private readonly workspaceState: vscode.Memento,
  ) {
    this.collection.persistent = false;
    this.collection.description = 'OCX: environment from ocx.toml';
  }

  /**
   * Restore the baseline env and re-apply `entries`. Idempotent across reloads.
   * @returns entry count and whether the result differs from the cached snapshot.
   */
  apply(entries: readonly EnvEntry[], opts: { readonly applyToTerminals: boolean }): ApplyResult {
    this.restore();
    const baseline = { ...process.env };
    const plan = computeEnvPlan(entries, baseline);

    for (const key of plan.touchedKeys) {
      this.backup.set(key, process.env[key]);
    }
    for (const op of plan.processOps) {
      process.env[op.key] = op.value;
    }
    if (opts.applyToTerminals) {
      for (const op of plan.collectionOps) {
        switch (op.kind) {
          case 'prepend':
            this.collection.prepend(op.key, op.value, MUTATOR_OPTIONS);
            break;
          case 'append':
            this.collection.append(op.key, op.value, MUTATOR_OPTIONS);
            break;
          case 'replace':
            this.collection.replace(op.key, op.value, MUTATOR_OPTIONS);
            break;
        }
      }
    }

    return { count: entries.length, changed: this.updateCache(entries) };
  }

  /** Restore `process.env` to baseline and clear terminal mutators (keeps cache). */
  restore(): void {
    for (const [key, value] of this.backup) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    this.backup.clear();
    this.collection.clear();
  }

  /** {@link restore} and forget the cached snapshot (next apply will report changed). */
  reset(): void {
    this.restore();
    void this.workspaceState.update(CACHE_KEY, undefined);
  }

  private updateCache(entries: readonly EnvEntry[]): boolean {
    const snapshot = envFingerprint(entries);
    const previous = this.workspaceState.get<string>(CACHE_KEY);
    void this.workspaceState.update(CACHE_KEY, snapshot);
    return snapshot !== previous;
  }
}
