import * as vscode from 'vscode';

import { readConfig } from './config';
import { EnvManager } from './environment';
import {
  buildSubcommandArgs,
  isUnsupportedGroupFlag,
  runEnv,
  runInit,
  runSubcommand,
  type ProjectSubcommand,
} from './ocx';
import { PROJECT_FILE, ProjectLocator } from './project';
import { StatusBar } from './status';

/**
 * Public API returned from {@link activate}. Surfaced for integration tests and
 * for other extensions that want to drive the OCX environment programmatically.
 */
export interface OcxApi {
  /** Recompute and re-apply the OCX environment. */
  reload(): Promise<void>;
  /** Restore the baseline environment and clear terminal mutators. */
  reset(): void;
  /** The terminal/task environment collection (read-only introspection). */
  readonly environmentVariableCollection: vscode.GlobalEnvironmentVariableCollection;
}

/**
 * Extension entry point. Keep this thin (see `arch-principles.md`): build
 * services, register commands + listeners, push every disposable. The actual
 * work happens lazily in {@link reload}, triggered by commands, file watchers,
 * config changes, and the initial activation below.
 */
export function activate(context: vscode.ExtensionContext): OcxApi {
  const output = vscode.window.createOutputChannel('OCX', { log: true });
  const status = new StatusBar();
  const envManager = new EnvManager(context.environmentVariableCollection, context.workspaceState);
  const locator = new ProjectLocator();

  context.subscriptions.push(output, status, locator, { dispose: () => envManager.restore() });

  // --- reload, serialized so concurrent triggers never stack PATH ----------
  let running: Promise<void> | undefined;
  let queued = false;

  const reloadOnce = async (): Promise<void> => {
    const config = readConfig();

    if (!config.enable) {
      envManager.reset();
      status.set({ kind: 'no-project' });
      return;
    }
    if (!vscode.workspace.isTrusted) {
      status.set({ kind: 'trust-required' });
      output.appendLine('[reload] workspace not trusted — skipping environment injection');
      return;
    }

    const project = await locator.resolve();
    if (project === undefined) {
      envManager.reset();
      status.set({ kind: 'no-project' });
      return;
    }

    status.set({ kind: 'loading' });
    envManager.restore(); // baseline env for the child + idempotent re-apply
    const childEnv: NodeJS.ProcessEnv = { ...process.env, ...config.extraEnv };
    const result = await runEnv({
      executable: config.executable,
      projectToml: project.tomlPath,
      groups: config.groups,
      env: childEnv,
    });

    switch (result.kind) {
      case 'not-found':
        status.set({ kind: 'failed', message: `executable "${config.executable}" not found` });
        output.appendLine(`[reload] ocx executable not found: ${config.executable}`);
        void notifyNotFound(config.executable);
        return;
      case 'error': {
        // When `ocx.groups` is set but the installed `ocx` rejects `--group`,
        // the raw clap usage error is opaque — point the user at the cause.
        const hint =
          config.groups.length > 0 && isUnsupportedGroupFlag(result.message)
            ? ' This `ocx` does not support `ocx env --group`; update `ocx` or clear the `ocx.groups` setting.'
            : '';
        status.set({ kind: 'failed', message: result.message });
        output.appendLine(`[reload] ocx env failed: ${result.message}`);
        void vscode.window.showErrorMessage(
          `OCX: failed to load environment. ${result.message}${hint}`,
        );
        return;
      }
      case 'ok': {
        const { count, changed } = envManager.apply(result.entries, {
          applyToTerminals: config.applyToTerminals,
        });
        status.set({ kind: 'loaded', count });
        output.appendLine(`[reload] applied ${count} env entries from ${project.tomlPath}`);
        if (changed) {
          if (config.restartAutomatic) {
            void executeRestart(output);
          } else {
            void promptRestart(output);
          }
        }
        return;
      }
      default: {
        const exhaustive: never = result;
        throw new Error(`unhandled ocx env result: ${String(exhaustive)}`);
      }
    }
  };

  const reload = (): Promise<void> => {
    if (running !== undefined) {
      queued = true;
      return running;
    }
    running = (async () => {
      do {
        queued = false;
        try {
          await reloadOnce();
        } catch (e) {
          output.appendLine(`[reload] unexpected error: ${e instanceof Error ? e.message : String(e)}`);
          status.set({ kind: 'failed', message: 'unexpected error (see OCX output)' });
        }
      } while (queued);
    })().finally(() => {
      running = undefined;
    });
    return running;
  };

  // --- commands ------------------------------------------------------------
  context.subscriptions.push(
    vscode.commands.registerCommand('ocx.reload', () => reload()),
    vscode.commands.registerCommand('ocx.reset', () => {
      envManager.reset();
      status.set({ kind: 'no-project' });
    }),
    vscode.commands.registerCommand('ocx.restartExtensions', () => executeRestart(output)),
    vscode.commands.registerCommand('ocx.showOutput', () => output.show()),
    vscode.commands.registerCommand('ocx.init', () => runInitCommand(output, reload, locator)),
    vscode.commands.registerCommand('ocx.lock', () => runProjectCommand('lock', output, reload, locator)),
    vscode.commands.registerCommand('ocx.pull', () => runProjectCommand('pull', output, reload, locator)),
    vscode.commands.registerCommand('ocx.upgrade', () =>
      runProjectCommand('upgrade', output, reload, locator),
    ),
    vscode.commands.registerCommand('ocx.clean', () => runProjectCommand('clean', output, reload, locator)),
  );

  // --- listeners -----------------------------------------------------------
  // The locator owns project discovery + file/folder watching and signals when
  // the project's files or location may have changed; we just reload. An `ocx`
  // settings change may move the project (`ocx.project`), so rescope the watcher
  // before reloading — one reload path covers every configuration change.
  context.subscriptions.push(
    locator.onDidChange(() => void reload()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('ocx')) {
        locator.rescope();
        void reload();
      }
    }),
    vscode.workspace.onDidGrantWorkspaceTrust(() => void reload()),
  );

  void reload();

  return {
    reload,
    reset: () => envManager.reset(),
    environmentVariableCollection: context.environmentVariableCollection,
  };
}

/** Disposables on `context.subscriptions` are torn down automatically. */
export function deactivate(): void {
  // Intentionally empty — the restore disposable pushed in activate handles cleanup.
}

/** Restart the extension host (or reload the window on remote). */
async function executeRestart(output: vscode.OutputChannel): Promise<void> {
  // `restartExtensionHost` leaves the separate PTY host (terminals) alive, but
  // is unavailable on remote — fall back to a full window reload there.
  const command =
    vscode.env.remoteName !== undefined
      ? 'workbench.action.reloadWindow'
      : 'workbench.action.restartExtensionHost';
  output.appendLine(`[restart] executing ${command}`);
  await vscode.commands.executeCommand(command);
}

async function promptRestart(output: vscode.OutputChannel): Promise<void> {
  const restart = 'Restart Extensions';
  const choice = await vscode.window.showInformationMessage(
    'OCX environment changed. Restart extensions so language servers pick up the new PATH?',
    restart,
    'Later',
  );
  if (choice === restart) {
    await executeRestart(output);
  }
}

/** Single source of truth for the "ocx executable missing" user message. */
function executableNotFoundMessage(executable: string): string {
  return `OCX: could not find the "${executable}" executable. Set "ocx.path.executable" or install OCX.`;
}

async function notifyNotFound(executable: string): Promise<void> {
  const openSettings = 'Open Settings';
  const choice = await vscode.window.showErrorMessage(
    executableNotFoundMessage(executable),
    openSettings,
  );
  if (choice === openSettings) {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'ocx.path.executable');
  }
}

/**
 * Run a project-lifecycle `ocx` subcommand against the workspace `ocx.toml`,
 * surfacing progress and output. After a subcommand that can change the composed
 * environment (`lock`/`upgrade` re-resolve `ocx.lock`; `pull` materializes
 * tools), trigger a {@link reload} so the injected env reflects the new state.
 * `clean` only removes unreferenced objects, so it needs no reload.
 */
async function runProjectCommand(
  subcommand: ProjectSubcommand,
  output: vscode.OutputChannel,
  reload: () => Promise<void>,
  locator: ProjectLocator,
): Promise<void> {
  const project = await locator.resolve();
  if (project === undefined) {
    void vscode.window.showErrorMessage(`OCX: no ${PROJECT_FILE} found in the workspace.`);
    return;
  }
  const config = readConfig();
  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `OCX: running ocx ${subcommand}…`,
      cancellable: false,
    },
    () =>
      runSubcommand({
        executable: config.executable,
        args: buildSubcommandArgs(project.tomlPath, subcommand, config.groups),
        cwd: project.dir,
        env: { ...process.env, ...config.extraEnv },
      }),
  );

  if (!result.ok) {
    output.appendLine(`[${subcommand}] failed: ${result.message}`);
    void vscode.window.showErrorMessage(
      result.notFound
        ? executableNotFoundMessage(config.executable)
        : `OCX: ocx ${subcommand} failed. ${result.message}`,
    );
    return;
  }

  output.appendLine(`[${subcommand}] ocx ${subcommand} completed`);
  const detail = [result.stdout, result.stderr]
    .map((stream) => stream.trim())
    .filter((stream) => stream.length > 0)
    .join('\n');
  if (detail.length > 0) {
    output.appendLine(detail);
  }
  if (subcommand !== 'clean') {
    await reload();
  }
}

async function runInitCommand(
  output: vscode.OutputChannel,
  reload: () => Promise<void>,
  locator: ProjectLocator,
): Promise<void> {
  const target = locator.initTarget();
  if (target === undefined) {
    void vscode.window.showErrorMessage('OCX: open a folder before running ocx init.');
    return;
  }
  const config = readConfig();
  const result = await runInit({
    executable: config.executable,
    cwd: target.dir,
    env: { ...process.env, ...config.extraEnv },
  });
  if (!result.ok) {
    output.appendLine(`[init] failed: ${result.message}`);
    void vscode.window.showErrorMessage(
      result.notFound
        ? executableNotFoundMessage(config.executable)
        : `OCX: ocx init failed. ${result.message}`,
    );
    return;
  }
  await reload();
  void vscode.window.showTextDocument(target.manifest);
}
