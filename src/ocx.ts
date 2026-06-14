import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * The modifier kinds OCX emits — the serde `snake_case` rendering of
 * `ModifierKind` (`Path` | `Constant`) from `ocx_lib`. These are the ONLY two
 * supported values; any other `type` is rejected at parse time (see
 * {@link parseEnvJson}). The wire format is documented to allow future modifier
 * kinds, so rejection — not silent passthrough — is the deliberate contract.
 */
export type EnvEntryType = 'path' | 'constant';

const ENV_ENTRY_TYPES: ReadonlySet<string> = new Set<EnvEntryType>(['path', 'constant']);

/** A single composed-environment entry as emitted by `ocx --format json env`. */
export interface EnvEntry {
  /** Variable name — any key is supported (e.g. `PATH`, `JAVA_HOME`). */
  readonly key: string;
  /** Variable value; for `type: "path"` this is a single directory to prepend. */
  readonly value: string;
  /**
   * `"path"` ⇒ prepend `value` to the path-like variable `key`. `"constant"` ⇒
   * replace `key` with `value`.
   */
  readonly type: EnvEntryType;
}

/**
 * Result of invoking `ocx ... env`. Discriminated on `kind` so callers handle
 * the "not installed" case distinctly from a runtime failure (see
 * `quality-typescript.md`: discriminated unions over throwing for control flow).
 */
export type OcxEnvResult =
  | { readonly kind: 'ok'; readonly entries: readonly EnvEntry[] }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'error'; readonly message: string };

/** Result of `ocx init`. */
export type OcxInitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly notFound: boolean; readonly message: string };

export interface RunEnvOptions {
  /** Executable path or name (resolved against the child's `PATH`). */
  readonly executable: string;
  /** Absolute path to the project `ocx.toml`. */
  readonly projectToml: string;
  /** Environment for the child process (baseline env + `ocx.extraEnv`). */
  readonly env: NodeJS.ProcessEnv;
}

/**
 * Compose the project environment via `ocx --format json --project <p> env`.
 *
 * The global `--format`/`--project` flags MUST precede the `env` subcommand
 * (verified against `ocx` 0.3.7 — a per-subcommand `--project` is rejected).
 * Runs without a shell (`execFile`) so the executable path and args are passed
 * verbatim (no quoting/injection surface).
 */
export async function runEnv(opts: RunEnvOptions): Promise<OcxEnvResult> {
  try {
    const { stdout } = await execFileAsync(
      opts.executable,
      ['--format', 'json', '--project', opts.projectToml, 'env'],
      { env: opts.env, maxBuffer: 4 * 1024 * 1024 },
    );
    return { kind: 'ok', entries: parseEnvJson(stdout) };
  } catch (e) {
    if (isNotFound(e)) {
      return { kind: 'not-found' };
    }
    return { kind: 'error', message: errorMessage(e) };
  }
}

export interface RunInitOptions {
  readonly executable: string;
  /** Directory to create the `ocx.toml` in. */
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}

/** Create a minimal `ocx.toml` via `ocx init`. */
export async function runInit(opts: RunInitOptions): Promise<OcxInitResult> {
  try {
    await execFileAsync(opts.executable, ['init'], { cwd: opts.cwd, env: opts.env });
    return { ok: true };
  } catch (e) {
    return { ok: false, notFound: isNotFound(e), message: errorMessage(e) };
  }
}

/** Narrow an unknown thrown value to a Node syscall error. */
function isErrnoException(e: unknown): e is NodeJS.ErrnoException {
  return e instanceof Error && 'code' in e;
}

/** True when the executable could not be spawned (not on PATH / missing). */
function isNotFound(e: unknown): boolean {
  return isErrnoException(e) && e.code === 'ENOENT';
}

/** Best-effort human-readable message, preferring the child's stderr. */
function errorMessage(e: unknown): string {
  if (e !== null && typeof e === 'object' && 'stderr' in e) {
    const stderr = (e as { stderr: unknown }).stderr;
    if (typeof stderr === 'string' && stderr.trim().length > 0) {
      return stderr.trim();
    }
  }
  return e instanceof Error ? e.message : String(e);
}

/**
 * Parse and validate `ocx --format json env` stdout into `EnvEntry[]`.
 *
 * Pure and `vscode`-free, so it is unit-testable. Throws on any deviation from
 * the documented wire format, including an unsupported entry `type`.
 */
export function parseEnvJson(stdout: string): EnvEntry[] {
  return parseEntries(JSON.parse(stdout));
}

/** Validate and narrow the parsed JSON into `EnvEntry[]` at the trust boundary. */
function parseEntries(parsed: unknown): EnvEntry[] {
  if (parsed === null || typeof parsed !== 'object' || !('entries' in parsed)) {
    throw new Error('ocx env: unexpected output (missing "entries")');
  }
  const { entries } = parsed;
  if (!Array.isArray(entries)) {
    throw new Error('ocx env: "entries" is not an array');
  }
  return entries.map(toEntry);
}

function toEntry(item: unknown): EnvEntry {
  if (item === null || typeof item !== 'object') {
    throw new Error('ocx env: malformed entry (not an object)');
  }
  if (!('key' in item) || !('value' in item) || !('type' in item)) {
    throw new Error('ocx env: entry missing key/value/type');
  }
  const { key, value, type } = item;
  if (typeof key !== 'string' || typeof value !== 'string' || typeof type !== 'string') {
    throw new Error('ocx env: entry key/value/type must be strings');
  }
  if (!isEnvEntryType(type)) {
    throw new Error(`ocx env: unsupported entry type "${type}" (expected "path" or "constant")`);
  }
  return { key, value, type };
}

function isEnvEntryType(type: string): type is EnvEntryType {
  return ENV_ENTRY_TYPES.has(type);
}
