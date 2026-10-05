import { describe, expect, it } from 'vitest';
import { runtimeConfigDirectory } from '../src/integration/platformPaths';

describe('EDI config directory', () => {
  it('uses the Windows roaming application data directory', () => {
    expect(runtimeConfigDirectory('win32', { APPDATA: 'C:\\Users\\dev\\AppData\\Roaming' }, 'C:\\Users\\dev'))
      .toBe('C:\\Users\\dev\\AppData\\Roaming');
  });

  it('uses macOS Application Support, matching the EDI runtime descriptor location', () => {
    expect(runtimeConfigDirectory('darwin', { XDG_CONFIG_HOME: '/custom/config' }, '/Users/dev'))
      .toBe('/Users/dev/Library/Application Support');
  });

  it('uses the XDG config directory on Linux', () => {
    expect(runtimeConfigDirectory('linux', { XDG_CONFIG_HOME: '/custom/config' }, '/home/dev'))
      .toBe('/custom/config');
    expect(runtimeConfigDirectory('linux', {}, '/home/dev')).toBe('/home/dev/.config');
  });
});
