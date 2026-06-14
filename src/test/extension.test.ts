import * as assert from 'node:assert';
import * as vscode from 'vscode';

suite('OCX Extension Test Suite', () => {
  suiteSetup(async () => {
    // Force activation so contributed commands are registered before assertions.
    const ext = vscode.extensions.getExtension('ocx-sh.ocx');
    await ext?.activate();
  });

  test('ocx.helloWorld command is registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes('ocx.helloWorld'),
      'expected ocx.helloWorld to be a registered command',
    );
  });

  test('ocx.helloWorld executes without throwing', async () => {
    await vscode.commands.executeCommand('ocx.helloWorld');
  });
});
