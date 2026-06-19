import * as path from 'node:path';

import * as vscode from 'vscode';

import { readConfig } from './config';

/** The project manifest filename OCX reads (`ocx --project <…/ocx.toml>`). */
export const PROJECT_FILE = 'ocx.toml';
/** The lockfile OCX writes alongside the manifest. */
export const LOCK_FILE = 'ocx.lock';

/** The resolved active project: the manifest path and its directory. */
export interface ProjectRef {
  /** Absolute path to the project manifest — passed to `ocx --project`. */
  readonly tomlPath: string;
  /** Directory holding the manifest — the working directory for `ocx` subcommands. */
  readonly dir: string;
}

/** A place the manifest may live, derived from settings + workspace folders. */
interface Candidate {
  readonly dir: vscode.Uri;
  readonly manifest: vscode.Uri;
}

/**
 * Single source of truth for "where is the OCX project, and when does it change".
 *
 * Resolution precedence:
 *   1. the `ocx.project` setting (absolute, or relative to a workspace folder), then
 *   2. the first workspace-folder root containing an `ocx.toml`.
 *
 * The file watcher is **derived from the same precedence** — it watches exactly the
 * directories a manifest could resolve from — so discovery, watching, and the
 * `--project` argument can never drift apart (the defect this class removes: the
 * rule used to be re-encoded in three places). `onDidChange` fires when a manifest
 * is created/changed/deleted (subject to `ocx.watchForChanges`) or the workspace
 * folder set changes; callers reload in response. Reacting to the `ocx.project`
 * setting itself is left to the caller, which calls {@link rescope} then reloads —
 * keeping a single reload path for all configuration changes.
 */
export class ProjectLocator implements vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<void>();
  /** Fires when the resolved project's files or location may have changed. */
  readonly onDidChange = this.emitter.event;

  private readonly folderSub: vscode.Disposable;
  private watchers: vscode.FileSystemWatcher[] = [];
  private watchKey = '';
  private current_: ProjectRef | undefined;

  constructor() {
    this.rescope();
    this.folderSub = vscode.workspace.onDidChangeWorkspaceFolders(() => {
      this.rescope();
      this.emitter.fire();
    });
  }

  /** The most recently resolved project (set by {@link resolve}). */
  get current(): ProjectRef | undefined {
    return this.current_;
  }

  /** Resolve the active project by precedence; `undefined` if none exists. */
  async resolve(): Promise<ProjectRef | undefined> {
    for (const candidate of this.candidates()) {
      try {
        await vscode.workspace.fs.stat(candidate.manifest);
        this.current_ = { tomlPath: candidate.manifest.fsPath, dir: candidate.dir.fsPath };
        return this.current_;
      } catch {
        // No manifest at this candidate — try the next.
      }
    }
    this.current_ = undefined;
    return undefined;
  }

  /**
   * Where `ocx init` should create a manifest: the first candidate directory (so
   * init honours `ocx.project`), defaulting to the first workspace folder.
   * `undefined` when no folder is open. `ocx init` always writes `ocx.toml`,
   * regardless of a custom configured manifest name.
   */
  initTarget(): { readonly dir: string; readonly manifest: vscode.Uri } | undefined {
    const [first] = this.candidates();
    if (first === undefined) {
      return undefined;
    }
    return { dir: first.dir.fsPath, manifest: vscode.Uri.joinPath(first.dir, PROJECT_FILE) };
  }

  /** Rebuild the watchers to match the current search space (no-op if unchanged). */
  rescope(): void {
    const candidates = this.candidates();
    const key = candidates.map((c) => c.manifest.fsPath).join('\n');
    if (key === this.watchKey) {
      return;
    }
    this.watchKey = key;
    this.disposeWatchers();
    for (const candidate of candidates) {
      const manifestName = path.basename(candidate.manifest.fsPath);
      // Watch the manifest and its sibling lockfile; a single-name brace glob
      // (`{ocx.lock}`) would match literally, so collapse the duplicate case.
      const pattern =
        manifestName === LOCK_FILE ? LOCK_FILE : `{${manifestName},${LOCK_FILE}}`;
      const watcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(candidate.dir, pattern),
      );
      const fire = (): void => {
        if (readConfig().watchForChanges) {
          this.emitter.fire();
        }
      };
      watcher.onDidChange(fire);
      watcher.onDidCreate(fire);
      watcher.onDidDelete(fire);
      this.watchers.push(watcher);
    }
  }

  dispose(): void {
    this.folderSub.dispose();
    this.disposeWatchers();
    this.emitter.dispose();
  }

  /** Candidate manifest locations, in precedence order. */
  private candidates(): Candidate[] {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const configured = readConfig().project;

    if (configured === '') {
      return folders.map((folder) => ({
        dir: folder.uri,
        manifest: vscode.Uri.joinPath(folder.uri, PROJECT_FILE),
      }));
    }

    if (path.isAbsolute(configured)) {
      return [
        {
          dir: vscode.Uri.file(path.dirname(configured)),
          manifest: vscode.Uri.file(configured),
        },
      ];
    }

    // Relative: resolve against each workspace folder, in order.
    return folders.map((folder) => ({
      dir: vscode.Uri.joinPath(folder.uri, path.dirname(configured)),
      manifest: vscode.Uri.joinPath(folder.uri, configured),
    }));
  }

  private disposeWatchers(): void {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];
  }
}
