import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { IntegrationError } from '../integration/client';
import { ProjectRef } from '../integration/protocol';

const execFileAsync = promisify(execFile);

async function chooseWorkspaceFolder(): Promise<vscode.WorkspaceFolder> {
  if (vscode.env.remoteName) {
    throw new IntegrationError('REMOTE_WORKSPACE_UNSUPPORTED', 'EDI Companion currently supports local desktop workspaces only.');
  }
  const folders = vscode.workspace.workspaceFolders ?? [];
  if (folders.length === 0) throw new IntegrationError('NO_WORKSPACE', 'Open a project folder in VS Code first.');

  const editorFolder = vscode.window.activeTextEditor
    ? vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri)
    : undefined;
  if (editorFolder) return editorFolder;
  if (folders.length === 1) return folders[0]!;

  const selected = await vscode.window.showQuickPick(
    folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder })),
    { title: 'Choose the workspace folder to open in EDI', placeHolder: 'Workspace folder' },
  );
  if (!selected) throw new IntegrationError('CANCELLED', 'No workspace folder was selected.');
  return selected.folder;
}

async function canonicalPath(value: string): Promise<string> {
  try { return await fs.realpath(value); } catch { return path.resolve(value); }
}

async function git(cwd: string, args: string[]): Promise<string | undefined> {
  try {
    const result = await execFileAsync('git', args, {
      cwd,
      windowsHide: true,
      timeout: 3_000,
      maxBuffer: 256 * 1024,
      encoding: 'utf8',
    });
    const value = result.stdout.trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

export async function collectProjectRef(): Promise<ProjectRef> {
  const folder = await chooseWorkspaceFolder();
  if (folder.uri.scheme !== 'file') {
    throw new IntegrationError('REMOTE_WORKSPACE_UNSUPPORTED', 'EDI Companion requires a local file-system workspace.');
  }

  const workspacePath = await canonicalPath(folder.uri.fsPath);
  const repositoryRoot = await git(workspacePath, ['rev-parse', '--show-toplevel']);
  if (!repositoryRoot) return { workspacePath };

  const repositoryPath = await canonicalPath(repositoryRoot);
  const commonDirRaw = await git(repositoryPath, ['rev-parse', '--git-common-dir']);
  const gitCommonDir = commonDirRaw
    ? await canonicalPath(path.isAbsolute(commonDirRaw) ? commonDirRaw : path.join(repositoryPath, commonDirRaw))
    : undefined;
  const [remoteUrl, headCommit, branch] = await Promise.all([
    git(repositoryPath, ['remote', 'get-url', 'origin']),
    git(repositoryPath, ['rev-parse', 'HEAD']),
    git(repositoryPath, ['branch', '--show-current']),
  ]);

  return {
    workspacePath,
    repositoryPath,
    ...(gitCommonDir ? { gitCommonDir } : {}),
    ...(remoteUrl ? { remoteUrl } : {}),
    ...(headCommit ? { headCommit } : {}),
    ...(branch ? { branch } : {}),
  };
}
