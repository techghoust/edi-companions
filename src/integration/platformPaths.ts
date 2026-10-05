import * as path from 'node:path';

export function runtimeConfigDirectory(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  home: string,
): string {
  if (platform === 'win32') {
    return env.APPDATA || path.win32.join(home, 'AppData', 'Roaming');
  }
  if (platform === 'darwin') {
    return path.posix.join(home, 'Library', 'Application Support');
  }
  return env.XDG_CONFIG_HOME || path.posix.join(home, '.config');
}
