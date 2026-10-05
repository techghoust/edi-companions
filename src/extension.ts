import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import { collectProjectRef } from './context/project';
import { sourceContextFromEditor } from './context/source';
import { IntegrationError } from './integration/client';
import { chooseExecutable, discoverOrLaunch } from './integration/discovery';
import {
  CreateEntryRequest,
  EntryType,
  OpenProjectRequest,
  PROTOCOL_VERSION,
} from './integration/protocol';

const EXTENSION_VERSION = '0.3.0';

const entryPrompts: Record<EntryType, { title: string; detail: string; saved: string }> = {
  note: { title: 'Note title', detail: 'Context, problem, or what changed', saved: 'Note saved to EDI.' },
  decision: { title: 'Decision title', detail: 'Why does this decision exist?', saved: 'Decision saved to EDI.' },
  experiment: { title: 'Experiment title', detail: 'Hypothesis or question', saved: 'Experiment saved to EDI.' },
  research: { title: 'Research title', detail: 'What did this teach you?', saved: 'Research saved to EDI.' },
};

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('EDI Companion', { log: true });
  context.subscriptions.push(output);
  context.subscriptions.push(vscode.commands.registerCommand('edi.openProject', () => openProjectInEdi(output)));
  for (const entryType of ['note', 'decision', 'experiment', 'research'] as const) {
    context.subscriptions.push(vscode.commands.registerCommand(`edi.add${capitalize(entryType)}`, () => addEntry(entryType, output)));
  }
}

function capitalize(value: string): string {
  return value[0]!.toUpperCase() + value.slice(1);
}

async function openProjectInEdi(output: vscode.LogOutputChannel): Promise<void> {
  await runCommand(output, async () => {
    const result = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Opening project in EDI…',
      cancellable: false,
    }, async () => {
      const project = await collectProjectRef();
      const client = await discoverOrLaunch();
      const request: OpenProjectRequest = {
        protocolVersion: PROTOCOL_VERSION,
        requestId: crypto.randomUUID(),
        client: { id: 'edi-vscode', version: EXTENSION_VERSION },
        action: 'project.open',
        project,
        payload: {},
      };
      return client.openProject(request);
    });
    if (result.needsLink) {
      await vscode.window.showInformationMessage('EDI opened this workspace. Link or create the project there.');
    } else if (showSuccessNotifications()) {
      await vscode.window.showInformationMessage('Project opened in EDI.');
    }
    output.info(`project.open completed (${result.projectId ? 'matched' : 'needs-link'})`);
  });
}

async function addEntry(entryType: EntryType, output: vscode.LogOutputChannel): Promise<void> {
  await runCommand(output, async () => {
    const project = await collectProjectRef();
    const source = sourceContextFromEditor(vscode.window.activeTextEditor, project);
    const prompts = entryPrompts[entryType];
    const title = await vscode.window.showInputBox({
      title: `EDI: Add ${capitalize(entryType)}`,
      prompt: prompts.title,
      placeHolder: prompts.title,
      ignoreFocusOut: true,
      validateInput: (value) => value.trim().length === 0 ? 'Enter a title.' : value.trim().length > 200 ? 'Use no more than 200 characters.' : undefined,
    });
    if (title === undefined) throw new IntegrationError('CANCELLED', 'Entry creation was cancelled.');
    const comment = await vscode.window.showInputBox({
      title: `EDI: Add ${capitalize(entryType)}`,
      prompt: prompts.detail,
      placeHolder: 'Optional short comment',
      ignoreFocusOut: true,
      validateInput: (value) => value.length > 10_000 ? 'Use no more than 10,000 characters.' : undefined,
    });
    if (comment === undefined) throw new IntegrationError('CANCELLED', 'Entry creation was cancelled.');

    const result = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Saving ${entryType} to EDI…`,
      cancellable: false,
    }, async () => {
      const client = await discoverOrLaunch();
      const request: CreateEntryRequest = {
        protocolVersion: PROTOCOL_VERSION,
        requestId: crypto.randomUUID(),
        client: { id: 'edi-vscode', version: EXTENSION_VERSION },
        action: 'entry.create',
        project,
        ...(source ? { source } : {}),
        payload: { entryType, title: title.trim(), comment: comment.trim() },
      };
      return client.createEntry(request);
    });

    if (showSuccessNotifications()) await vscode.window.showInformationMessage(result.duplicate ? 'This entry was already saved.' : prompts.saved);
    output.info(`entry.create completed (${entryType}, ${result.duplicate ? 'duplicate' : 'created'})`);
  });
}

function showSuccessNotifications(): boolean {
  return vscode.workspace.getConfiguration('edi').get<boolean>('showSuccessNotifications', true);
}

async function runCommand(output: vscode.LogOutputChannel, action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    const failure = error instanceof IntegrationError
      ? error
      : new IntegrationError('UNEXPECTED_ERROR', error instanceof Error ? error.message : String(error));
    if (failure.code === 'CANCELLED') return;
    output.error(`${failure.code}: ${failure.message}`);
    if (failure.code === 'EDI_NOT_INSTALLED') {
      const selected = await vscode.window.showErrorMessage(failure.message, 'Select EDI Executable');
      if (selected === 'Select EDI Executable' && await chooseExecutable()) {
        await vscode.window.showInformationMessage('EDI executable saved. Run the command again.');
      }
      return;
    }
    if (failure.code === 'PROJECT_NOT_LINKED') {
      await vscode.window.showInformationMessage('This workspace is not linked yet. Complete the project setup in EDI, then retry.');
      return;
    }
    await vscode.window.showErrorMessage(failure.message);
  }
}

export function deactivate(): void {}
