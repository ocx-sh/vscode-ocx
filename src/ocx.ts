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
  /**
   * Tool groups to compose (`ocx.groups`). Empty ⇒ the default group only —
   * the same set `ocx env` composes with no group flag. See {@link buildEnvArgs}.
   */
  readonly groups: readonly string[];
  /** Environment for the child process (baseline env + `ocx.extraEnv`). */
  readonly env: NodeJS.ProcessEnv;
}

/**
 * Build the `ocx` argv for composing the project environment.
 *
 * Layout: `--format json --project <p> env [--group <g>]…`. The global
 * `--format`/`--project` flags MUST precede the `env` subcommand (verified
 * against `ocx` 0.3.7 — a per-subcommand `--project` is rejected); a group
 * selector is a **subcommand** flag and therefore follows `env`, mirroring the
 * `ocx run`/`ocx pull` convention (`-g`/`--group`, one selector per token).
 *
 * Group semantics follow the CLI verbatim: `default` selects the implicit
 * `[tools]` table, `all` expands to `default` + every `[group.*]`, and an
 * **empty** list composes the default group only (it does NOT mean
 * "everything"). Each group is emitted as its own `--group <name>` pair so a
 * value never needs comma-escaping. Pure (no I/O) so it is unit-testable.
 */
export function buildEnvArgs(projectToml: string, groups: readonly string[]): string[] {
  const args = ['--format', 'json', '--project', projectToml, 'env'];
  for (const group of groups) {
    args.push('--group', group);
  }
  return args;
}

/**
 * Compose the project environment via `ocx --format json --project <p> env`.
 *
 * Runs without a shell (`execFile`) so the executable path and args are passed
 * verbatim (no quoting/injection surface). Argv is built by {@link buildEnvArgs}.
 */
export async function runEnv(opts: RunEnvOptions): Promise<OcxEnvResult> {
  try {
    const { stdout } = await execFileAsync(
      opts.executable,
      buildEnvArgs(opts.projectToml, opts.groups),
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

/**
 * True when an `ocx env` failure is the CLI rejecting the `--group` selector —
 * i.e. the installed `ocx` predates `ocx env --group` support (the flag lives on
 * `ocx run`/`ocx pull` but not yet on `ocx env`, which hardcodes the default
 * group). clap reports an unknown flag as `error: unexpected argument '--group'
 * found`; match on the stable, quoting/locale-tolerant substrings so the caller
 * can turn a cryptic usage error into actionable guidance.
 */
export function isUnsupportedGroupFlag(message: string): boolean {
  return message.includes('--group') && message.includes('unexpected argument');
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

/**
 * Project-lifecycle `ocx` subcommands the extension exposes as palette commands.
 * Each operates on the discovered project `ocx.toml` and takes no required
 * argument. Deliberately excludes argument-taking, config-mutating subcommands
 * (`add`/`remove` need a `<IDENTIFIER>` and belong with `ocx.toml` authoring) and
 * non-existent ones — `ocx` has no `install`/`select`/`sync` (verified against
 * `ocx --help`). Modelled as a closed union so the switch on it stays exhaustive.
 */
export type ProjectSubcommand = 'lock' | 'pull' | 'upgrade' | 'clean';

/**
 * Build the `ocx` argv for a project-lifecycle subcommand.
 *
 * Layout: `--project <p> <subcommand> [--group <g>…]`. The global `--project`
 * flag MUST precede the subcommand (same constraint as {@link buildEnvArgs}).
 * Only `pull` accepts a group selector (`ocx lock`/`upgrade`/`clean` have no
 * `--group`), so groups are forwarded for `pull` alone — one `--group <name>`
 * per entry (never comma-joined), mirroring {@link buildEnvArgs}. An empty group
 * list yields a bare `ocx pull`, whose own default is to pull every group. Pure
 * (no I/O) so it is unit-testable.
 */
export function buildSubcommandArgs(
  projectToml: string,
  subcommand: ProjectSubcommand,
  groups: readonly string[],
): string[] {
  const args = ['--project', projectToml, subcommand];
  if (subcommand === 'pull') {
    for (const group of groups) {
      args.push('--group', group);
    }
  }
  return args;
}

export interface RunSubcommandOptions {
  readonly executable: string;
  /** Full argv after the executable (built by {@link buildSubcommandArgs}). */
  readonly args: readonly string[];
  /** Working directory — the project directory containing `ocx.toml`. */
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}

/**
 * Result of running an `ocx` subcommand. Discriminated on `ok` so callers handle
 * the "not installed" case (`notFound`) distinctly from a non-zero exit.
 */
export type OcxRunResult =
  | { readonly ok: true; readonly stdout: string; readonly stderr: string }
  | { readonly ok: false; readonly notFound: boolean; readonly message: string };

/**
 * Run a project-lifecycle `ocx` subcommand via `execFile` (no shell, so argv is
 * passed verbatim — no quoting/injection surface, matching {@link runEnv}).
 * Captured stdout/stderr is surfaced to the OCX output channel by the caller.
 */
export async function runSubcommand(opts: RunSubcommandOptions): Promise<OcxRunResult> {
  try {
    const { stdout, stderr } = await execFileAsync(opts.executable, [...opts.args], {
      cwd: opts.cwd,
      env: opts.env,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { ok: true, stdout, stderr };
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
