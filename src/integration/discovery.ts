import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { IntegrationClient, IntegrationError } from './client';
import { parseRuntimeDescriptor, RuntimeDescriptor } from './protocol';
import { runtimeConfigDirectory } from './platformPaths';

function runtimeDescriptorPath(): string {
  const config = runtimeConfigDirectory(process.platform, process.env, os.homedir());
  return path.join(config, 'EDI Developer Journal', 'integration.json');
}

export async function readRuntimeDescriptor(file = runtimeDescriptorPath()): Promise<RuntimeDescriptor> {
  const raw = await fs.readFile(file, 'utf8');
  return parseRuntimeDescriptor(JSON.parse(raw));
}

async function connectedClient(): Promise<IntegrationClient> {
  const descriptor = await readRuntimeDescriptor();
  const client = new IntegrationClient(descriptor);
  await client.health();
  return client;
}

function executableCandidates(): string[] {
  const configured = vscode.workspace.getConfiguration('edi').get<string>('executablePath', '').trim();
  const autoDetect = vscode.workspace.getConfiguration('edi').get<boolean>('autoDetect', true);
  const candidates = configured ? [configured] : [];
  if (!autoDetect) return candidates;

  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA;
    const programFiles = process.env.ProgramFiles;
    if (local) {
      candidates.push(path.join(local, 'Programs', 'EDI Developer Journal', 'EDI Developer Journal.exe'));
      candidates.push(path.join(local, 'EDI Developer Journal', 'EDI Developer Journal.exe'));
    }
    if (programFiles) candidates.push(path.join(programFiles, 'EDI Developer Journal', 'EDI Developer Journal.exe'));
  } else if (process.platform === 'darwin') {
    const app = 'EDI Developer Journal.app';
    candidates.push(path.join('/Applications', app));
    candidates.push(path.join(os.homedir(), 'Applications', app));
  } else {
    candidates.push('/usr/bin/edi-developer-journal', '/usr/local/bin/edi-developer-journal');
  }
  return [...new Set(candidates)];
}

async function findExecutable(): Promise<string | undefined> {
  for (const candidate of executableCandidates()) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile() || (process.platform === 'darwin' && candidate.endsWith('.app') && stat.isDirectory())) return candidate;
    } catch {}
  }
  return undefined;
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function discoverOrLaunch(): Promise<IntegrationClient> {
  try {
    return await connectedClient();
  } catch {}

  const executable = await findExecutable();
  if (!executable) {
    throw new IntegrationError('EDI_NOT_INSTALLED', 'EDI Developer Journal could not be found.');
  }

  const child = process.platform === 'darwin' && executable.endsWith('.app')
    ? spawn('open', ['-a', executable], { detached: true, stdio: 'ignore' })
    : spawn(executable, [], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();

  let lastError: unknown;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await delay(250);
    try {
      return await connectedClient();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? new IntegrationError('EDI_NOT_RUNNING', `EDI did not start: ${lastError.message}`, true)
    : new IntegrationError('EDI_NOT_RUNNING', 'EDI did not start.', true);
}

export async function chooseExecutable(): Promise<boolean> {
  const selection = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: process.platform === 'darwin',
    canSelectMany: false,
    title: process.platform === 'darwin' ? 'Select EDI Developer Journal app or executable' : 'Select EDI Developer Journal executable',
    filters: process.platform === 'win32' ? { Applications: ['exe'] } : undefined,
  });
  const selected = selection?.[0];
  if (!selected) return false;
  await vscode.workspace.getConfiguration('edi').update('executablePath', selected.fsPath, vscode.ConfigurationTarget.Global);
  return true;
}
