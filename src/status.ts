import * as vscode from 'vscode';

/** Discriminated state shown in the status bar. */
export type StatusState =
  | { readonly kind: 'no-project' }
  | { readonly kind: 'trust-required' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly count: number }
  | { readonly kind: 'failed'; readonly message: string };

const WARNING_BG = new vscode.ThemeColor('statusBarItem.warningBackground');
const ERROR_BG = new vscode.ThemeColor('statusBarItem.errorBackground');

/** Status-bar item reflecting the OCX environment state; click → `ocx.reload`. */
export class StatusBar {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.name = 'OCX Environment';
    this.item.command = 'ocx.reload';
    this.item.show();
  }

  set(state: StatusState): void {
    this.item.backgroundColor = undefined;
    switch (state.kind) {
      case 'no-project':
        this.item.text = '$(package) OCX';
        this.item.tooltip = 'OCX: no ocx.toml in this workspace. Click to reload.';
        break;
      case 'trust-required':
        this.item.text = '$(shield) OCX';
        this.item.tooltip = 'OCX: workspace is not trusted — environment loading is disabled.';
        this.item.backgroundColor = WARNING_BG;
        break;
      case 'loading':
        this.item.text = '$(sync~spin) OCX';
        this.item.tooltip = 'OCX: loading environment…';
        break;
      case 'loaded':
        this.item.text = `$(package) OCX ${state.count}`;
        this.item.tooltip = `OCX: environment loaded (${state.count} ${
          state.count === 1 ? 'entry' : 'entries'
        }). Click to reload.`;
        break;
      case 'failed':
        this.item.text = '$(error) OCX';
        this.item.tooltip = `OCX: failed to load environment. ${state.message}`;
        this.item.backgroundColor = ERROR_BG;
        break;
      default: {
        const exhaustive: never = state;
        throw new Error(`unhandled status state: ${String(exhaustive)}`);
      }
    }
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
