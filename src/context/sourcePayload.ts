import * as path from 'node:path';
import { IntegrationError } from '../integration/client';
import { ProjectRef, SourceContext } from '../integration/protocol';

export const MAX_SELECTION_BYTES = 64 * 1024;

export interface EditorSnapshot {
  filePath: string;
  languageId: string;
  text?: string;
  start: { line: number; character: number };
  end: { line: number; character: number };
}

export function buildSourceContext(snapshot: EditorSnapshot, project: ProjectRef): SourceContext {
  if (snapshot.text && Buffer.byteLength(snapshot.text, 'utf8') > MAX_SELECTION_BYTES) {
    throw new IntegrationError('PAYLOAD_TOO_LARGE', 'Select no more than 64 KiB of text to send to EDI.');
  }
  const base = project.repositoryPath ?? project.workspacePath;
  const relative = path.relative(base, snapshot.filePath);
  const workspaceRelativePath = relative.startsWith('..') || path.isAbsolute(relative)
    ? undefined
    : relative.split(path.sep).join('/');
  return {
    filePath: snapshot.filePath,
    ...(workspaceRelativePath ? { workspaceRelativePath } : {}),
    languageId: snapshot.languageId,
    selection: {
      ...(snapshot.text === undefined ? {} : { text: snapshot.text }),
      start: snapshot.start,
      end: snapshot.end,
    },
  };
}
