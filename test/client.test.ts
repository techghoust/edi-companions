import * as http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { IntegrationClient, IntegrationError } from '../src/integration/client';
import { CreateEntryRequest, OpenProjectRequest, RuntimeDescriptor } from '../src/integration/protocol';

const servers: http.Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function serverFor(handler: http.RequestListener): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test server address.');
  return { server, port: address.port };
}

function descriptor(port: number): RuntimeDescriptor {
  return { protocolVersion: 1, port, token: 's'.repeat(64), pid: 42, instanceId: 'test-instance' };
}

function request(): OpenProjectRequest {
  return {
    protocolVersion: 1,
    requestId: 'request-1',
    client: { id: 'edi-vscode', version: '0.2.0' },
    action: 'project.open',
    project: { workspacePath: 'C:\\work space\\café-项目' },
    payload: {},
  };
}

function createRequest(): CreateEntryRequest {
  return {
    protocolVersion: 1,
    requestId: 'create-1',
    client: { id: 'edi-vscode', version: '0.2.0' },
    action: 'entry.create',
    project: { workspacePath: 'C:\\work space\\café-项目' },
    source: {
      filePath: 'C:\\work space\\café-项目\\src\\main.ts',
      workspaceRelativePath: 'src/main.ts',
      languageId: 'typescript',
      selection: {
        text: 'const answer = 42;',
        start: { line: 3, character: 0 },
        end: { line: 3, character: 18 },
      },
    },
    payload: { entryType: 'note', title: 'Remember this', comment: 'Useful context' },
  };
}

describe('integration client', () => {
  it('checks the EDI instance and opens a project', async () => {
    const { port } = await serverFor((incoming, response) => {
      response.setHeader('Content-Type', 'application/json');
      if (incoming.url === '/v1/health') {
        response.end(JSON.stringify({ protocolVersion: 1, instanceId: 'test-instance' }));
        return;
      }
      expect(incoming.headers.authorization).toBe(`Bearer ${'s'.repeat(64)}`);
      response.end(JSON.stringify({ protocolVersion: 1, requestId: 'request-1', ok: true, result: { projectId: 'p1', opened: true, needsLink: false } }));
    });
    const client = new IntegrationClient(descriptor(port));
    await expect(client.health()).resolves.toEqual({ protocolVersion: 1, instanceId: 'test-instance' });
    await expect(client.openProject(request())).resolves.toMatchObject({ projectId: 'p1', opened: true });
  });

  it('surfaces protocol errors without stack traces from the server', async () => {
    const { port } = await serverFor((_incoming, response) => {
      response.statusCode = 404;
      response.end(JSON.stringify({ error: { code: 'PROJECT_NOT_LINKED', message: 'This workspace is not linked.', retryable: false } }));
    });
    const client = new IntegrationClient(descriptor(port));
    await expect(client.openProject(request())).rejects.toMatchObject({ code: 'PROJECT_NOT_LINKED' });
  });

  it('creates an entry and accepts an idempotent duplicate response', async () => {
    let calls = 0;
    const { port } = await serverFor((_incoming, response) => {
      calls += 1;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({
        protocolVersion: 1,
        requestId: 'create-1',
        ok: true,
        result: {
          projectId: 'p1',
          entryId: 'n1',
          entryType: 'note',
          created: calls === 1,
          duplicate: calls > 1,
        },
      }));
    });
    const client = new IntegrationClient(descriptor(port));
    await expect(client.createEntry(createRequest())).resolves.toMatchObject({ created: true, duplicate: false });
    await expect(client.createEntry(createRequest())).resolves.toMatchObject({ created: false, duplicate: true });
  });
});
