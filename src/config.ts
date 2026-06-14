import * as vscode from 'vscode';

/** The `contributes.configuration` section id for every OCX setting. */
export const CONFIG_SECTION = 'ocx';

/**
 * Typed view of the `ocx.*` settings declared in `package.json`.
 *
 * Settings are read at the point of use (not cached) so changes take effect on
 * the next reload — `extension.ts` re-reads via {@link readConfig} whenever
 * `onDidChangeConfiguration` fires for the `ocx` section.
 */
export interface OcxConfig {
  /** Path or name of the `ocx` executable (`ocx.path.executable`). */
  readonly executable: string;
  /** Master on/off switch (`ocx.enable`). */
  readonly enable: boolean;
  /** Reload when `ocx.toml`/`ocx.lock` change (`ocx.watchForChanges`). */
  readonly watchForChanges: boolean;
  /** Restart the ext host automatically vs. prompt (`ocx.restart.automatic`). */
  readonly restartAutomatic: boolean;
  /** Inject env into terminals/tasks too (`ocx.env.applyToTerminals`). */
  readonly applyToTerminals: boolean;
  /** Extra env passed to the `ocx` child process (`ocx.extraEnv`). */
  readonly extraEnv: Readonly<Record<string, string>>;
}

/** Read the current `ocx.*` configuration (optionally scoped to a resource). */
export function readConfig(scope?: vscode.ConfigurationScope): OcxConfig {
  const c = vscode.workspace.getConfiguration(CONFIG_SECTION, scope);
  return {
    executable: c.get<string>('path.executable', 'ocx'),
    enable: c.get<boolean>('enable', true),
    watchForChanges: c.get<boolean>('watchForChanges', true),
    restartAutomatic: c.get<boolean>('restart.automatic', false),
    applyToTerminals: c.get<boolean>('env.applyToTerminals', true),
    extraEnv: c.get<Record<string, string>>('extraEnv', {}),
  };
}
