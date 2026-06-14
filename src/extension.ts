import * as vscode from 'vscode';

/**
 * Extension entry point. Called by VS Code on the first activation event
 * (here: the first time `ocx.helloWorld` is invoked — see `contributes.commands`).
 *
 * Keep `activate` thin: register contributions, wire services, and push every
 * disposable onto `context.subscriptions` so VS Code tears them down on deactivate.
 */
export function activate(context: vscode.ExtensionContext): void {
  const helloWorld = vscode.commands.registerCommand('ocx.helloWorld', () => {
    void vscode.window.showInformationMessage('Hello World from OCX!');
  });

  context.subscriptions.push(helloWorld);
}

/** Called by VS Code on shutdown / disable. Disposables are handled automatically. */
export function deactivate(): void {
  // Nothing to clean up beyond `context.subscriptions`.
}
