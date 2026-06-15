import * as vscode from 'vscode';

import { readConfig } from './config';
import { EnvManager } from './environment';
import { isUnsupportedGroupFlag, runEnv, runInit } from './ocx';
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

  context.subscriptions.push(output, status, { dispose: () => envManager.restore() });

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

    const projectToml = await findProjectToml();
    if (projectToml === undefined) {
      envManager.reset();
      status.set({ kind: 'no-project' });
      return;
    }

    status.set({ kind: 'loading' });
    envManager.restore(); // baseline env for the child + idempotent re-apply
    const childEnv: NodeJS.ProcessEnv = { ...process.env, ...config.extraEnv };
    const result = await runEnv({
      executable: config.executable,
      projectToml,
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
        output.appendLine(`[reload] applied ${count} env entries from ${projectToml}`);
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
    vscode.commands.registerCommand('ocx.init', () => runInitCommand(output, reload)),
  );

  // --- listeners -----------------------------------------------------------
  const watcher = vscode.workspace.createFileSystemWatcher('**/{ocx.toml,ocx.lock}');
  const onConfigFileChange = (): void => {
    if (readConfig().watchForChanges) {
      void reload();
    }
  };
  watcher.onDidChange(onConfigFileChange);
  watcher.onDidCreate(onConfigFileChange);
  watcher.onDidDelete(onConfigFileChange);

  context.subscriptions.push(
    watcher,
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('ocx')) {
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

/** Find the first `ocx.toml` in the workspace (v1 targets a single project). */
async function findProjectToml(): Promise<string | undefined> {
  const uris = await vscode.workspace.findFiles('**/ocx.toml', '**/node_modules/**', 1);
  return uris[0]?.fsPath;
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

async function notifyNotFound(executable: string): Promise<void> {
  const openSettings = 'Open Settings';
  const choice = await vscode.window.showErrorMessage(
    `OCX: could not find the "${executable}" executable. Set "ocx.path.executable" or install OCX.`,
    openSettings,
  );
  if (choice === openSettings) {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'ocx.path.executable');
  }
}

async function runInitCommand(
  output: vscode.OutputChannel,
  reload: () => Promise<void>,
): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder === undefined) {
    void vscode.window.showErrorMessage('OCX: open a folder before running ocx init.');
    return;
  }
  const config = readConfig();
  const result = await runInit({
    executable: config.executable,
    cwd: folder.uri.fsPath,
    env: { ...process.env, ...config.extraEnv },
  });
  if (!result.ok) {
    output.appendLine(`[init] failed: ${result.message}`);
    void vscode.window.showErrorMessage(
      result.notFound
        ? `OCX: could not find the "${config.executable}" executable. Set "ocx.path.executable" or install OCX.`
        : `OCX: ocx init failed. ${result.message}`,
    );
    return;
  }
  await reload();
  const tomlUri = vscode.Uri.joinPath(folder.uri, 'ocx.toml');
  void vscode.window.showTextDocument(tomlUri);
}
