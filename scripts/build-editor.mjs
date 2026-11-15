import { spawnSync } from 'node:child_process';
import { tauriEnv } from './tauri-env.mjs';

const bundles =
  process.platform === 'win32' ? 'nsis' : process.platform === 'darwin' ? 'app,dmg' : 'deb,rpm';
const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(
  command,
  ['--filter', '@photo-calendar/editor', 'tauri', 'build', '--bundles', bundles],
  { stdio: 'inherit', env: tauriEnv() },
);
process.exit(result.status ?? 1);
