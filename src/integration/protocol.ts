export const PROTOCOL_VERSION = 1 as const;

export interface RuntimeDescriptor {
  protocolVersion: number;
  port: number;
  token: string;
  pid: number;
  instanceId: string;
}

export interface ClientIdentity {
  id: string;
  version: string;
}

export interface ProjectRef {
  workspacePath: string;
  repositoryPath?: string;
  gitCommonDir?: string;
  remoteUrl?: string;
  headCommit?: string;
  branch?: string;
}

export interface Position {
  line: number;
  character: number;
}

export interface SourceContext {
  filePath: string;
  workspaceRelativePath?: string;
  languageId: string;
  selection: {
    text?: string;
    start: Position;
    end: Position;
  };
}

interface BaseRequest {
  protocolVersion: 1;
  requestId: string;
  client: ClientIdentity;
  project: ProjectRef;
}

export interface OpenProjectRequest extends BaseRequest {
  action: 'project.open';
  payload: Record<string, never>;
}

export type EntryType = 'note' | 'decision' | 'experiment' | 'research';

export interface CreateEntryRequest extends BaseRequest {
  action: 'entry.create';
  source?: SourceContext;
  payload: {
    entryType: EntryType;
    title: string;
    comment: string;
  };
}

export interface OpenProjectResult {
  projectId: string | null;
  opened: boolean;
  needsLink: boolean;
}

export interface CreateEntryResult {
  projectId: string;
  entryId: string;
  entryType: EntryType;
  created: boolean;
  duplicate: boolean;
}

export interface SuccessResponse<T> {
  protocolVersion: number;
  requestId: string;
  ok: true;
  result: T;
}

export interface ErrorResponse {
  protocolVersion: number;
  requestId: string;
  ok: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    suggestedAction?: string;
  };
}

export type ProtocolResponse<T> = SuccessResponse<T> | ErrorResponse;

export function parseRuntimeDescriptor(value: unknown): RuntimeDescriptor {
  if (!value || typeof value !== 'object') throw new Error('Invalid EDI runtime descriptor.');
  const item = value as Record<string, unknown>;
  if (!Number.isInteger(item.protocolVersion) || item.protocolVersion !== PROTOCOL_VERSION) {
    throw new Error('Unsupported EDI integration protocol.');
  }
  if (!Number.isInteger(item.port) || Number(item.port) < 1 || Number(item.port) > 65535) {
    throw new Error('Invalid EDI integration port.');
  }
  if (typeof item.token !== 'string' || item.token.length < 32) throw new Error('Invalid EDI integration token.');
  if (!Number.isInteger(item.pid) || Number(item.pid) < 1) throw new Error('Invalid EDI process identifier.');
  if (typeof item.instanceId !== 'string' || item.instanceId.length < 8) throw new Error('Invalid EDI instance identifier.');
  return item as unknown as RuntimeDescriptor;
}

export function parseProtocolResponse<T>(value: unknown, requestId: string): ProtocolResponse<T> {
  if (!value || typeof value !== 'object') throw new Error('EDI returned an invalid response.');
  const item = value as Record<string, unknown>;
  if (item.protocolVersion !== PROTOCOL_VERSION) throw new Error('EDI uses an unsupported integration protocol.');
  if (item.requestId !== requestId || typeof item.ok !== 'boolean') throw new Error('EDI returned a mismatched response.');
  return item as unknown as ProtocolResponse<T>;
}
