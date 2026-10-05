import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { buildSourceContext, MAX_SELECTION_BYTES } from '../src/context/sourcePayload';

describe('source context', () => {
  it('keeps zero-based ranges and workspace-relative paths', () => {
    const source = buildSourceContext({
      filePath: path.join(path.sep, 'work space', 'project', 'src', 'session.ts'),
      languageId: 'typescript',
      text: 'function reconnect() {}',
      start: { line: 41, character: 0 },
      end: { line: 41, character: 23 },
    }, { workspacePath: path.join(path.sep, 'work space', 'project'), repositoryPath: path.join(path.sep, 'work space', 'project') });
    expect(source.workspaceRelativePath).toBe('src/session.ts');
    expect(source.selection.start.line).toBe(41);
    expect(source.selection.text).toContain('reconnect');
  });

  it('does not invent selected text for an empty selection', () => {
    const source = buildSourceContext({
      filePath: '/work/project/main.rs',
      languageId: 'rust',
      start: { line: 3, character: 2 },
      end: { line: 3, character: 2 },
    }, { workspacePath: '/work/project' });
    expect(source.selection.text).toBeUndefined();
  });

  it('rejects oversized selections', () => {
    expect(() => buildSourceContext({
      filePath: '/work/project/main.txt',
      languageId: 'plaintext',
      text: 'x'.repeat(MAX_SELECTION_BYTES + 1),
      start: { line: 0, character: 0 },
      end: { line: 0, character: MAX_SELECTION_BYTES + 1 },
    }, { workspacePath: '/work/project' })).toThrow(/64 KiB/);
  });
});
