import * as vscode from 'vscode';
import { ProjectRef, SourceContext } from '../integration/protocol';
import { buildSourceContext } from './sourcePayload';

export function sourceContextFromEditor(
  editor: vscode.TextEditor | undefined,
  project: ProjectRef,
): SourceContext | undefined {
  if (!editor || editor.document.uri.scheme !== 'file') return undefined;

  const selection = editor.selection;
  return buildSourceContext({
    filePath: editor.document.uri.fsPath,
    languageId: editor.document.languageId,
    ...(selection.isEmpty ? {} : { text: editor.document.getText(selection) }),
    start: { line: selection.start.line, character: selection.start.character },
    end: { line: selection.end.line, character: selection.end.character },
  }, project);
}
