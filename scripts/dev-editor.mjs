import { spawn } from 'node:child_process';
import { tauriEnv } from './tauri-env.mjs';

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const child = spawn(command, ['--filter', '@photo-calendar/editor', 'tauri', 'dev'], {
  stdio: 'inherit',
  env: tauriEnv(),
  shell: process.platform === 'win32',
});
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
