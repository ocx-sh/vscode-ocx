import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'out/test/**/*.test.js',
  // Open a folder containing ocx.toml so the extension auto-activates
  // (workspaceContains) and project discovery has something to find.
  workspaceFolder: './src/test/fixtures/workspace',
});
