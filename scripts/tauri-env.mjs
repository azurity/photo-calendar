import { accessSync, constants, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Tauri dev/build needs a writable CARGO_HOME. Some sandboxed/container
 * environments mount ~/.cargo read-only; fall back to a repo-local cache.
 * On Linux without WebKitGTK 4.1 development files, an extracted sysroot can
 * provide the pkg-config metadata (see scripts/setup-linux-tauri-deps.sh).
 */
export function tauriEnv(repoRoot = process.cwd()) {
  const env = { ...process.env };
  const defaultCargoHome = env.CARGO_HOME || join(homedir(), '.cargo');
  try {
    accessSync(defaultCargoHome, constants.W_OK);
  } catch {
    env.CARGO_HOME = join(repoRoot, '.cargo-home');
    mkdirSync(env.CARGO_HOME, { recursive: true });
  }

  try {
    accessSync(homedir(), constants.W_OK);
  } catch {
    const appData = join(repoRoot, '.app-data');
    env.PHOTO_CALENDAR_HOME = env.PHOTO_CALENDAR_HOME || join(appData, 'calendar');
    env.XDG_DATA_HOME = env.XDG_DATA_HOME || join(appData, 'xdg-data');
    env.XDG_CONFIG_HOME = env.XDG_CONFIG_HOME || join(appData, 'xdg-config');
    env.XDG_CACHE_HOME = env.XDG_CACHE_HOME || join(appData, 'xdg-cache');
    mkdirSync(env.PHOTO_CALENDAR_HOME, { recursive: true });
    mkdirSync(env.XDG_DATA_HOME, { recursive: true });
    mkdirSync(env.XDG_CONFIG_HOME, { recursive: true });
    mkdirSync(env.XDG_CACHE_HOME, { recursive: true });
  }

  const sysroot = join(repoRoot, '.sysroot', 'root');
  if (existsSync(join(sysroot, 'usr', 'lib', 'x86_64-linux-gnu', 'pkgconfig'))) {
    const pkgConfig = join(sysroot, 'usr', 'lib', 'x86_64-linux-gnu', 'pkgconfig');
    env.PKG_CONFIG_PATH = env.PKG_CONFIG_PATH ? `${pkgConfig}:${env.PKG_CONFIG_PATH}` : pkgConfig;
    env.PKG_CONFIG_SYSROOT_DIR = sysroot;
  }
  return env;
}
