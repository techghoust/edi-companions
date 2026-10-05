import * as http from 'node:http';
import {
  CreateEntryRequest,
  CreateEntryResult,
  OpenProjectRequest,
  OpenProjectResult,
  parseProtocolResponse,
  ProtocolResponse,
  RuntimeDescriptor,
} from './protocol';

const RESPONSE_LIMIT = 256 * 1024;

export class IntegrationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

export class IntegrationClient {
  constructor(
    private readonly descriptor: RuntimeDescriptor,
    private readonly timeoutMs = 3_000,
  ) {}

  async health(): Promise<{ instanceId: string; protocolVersion: number }> {
    const value = await this.request('GET', '/v1/health');
    const health = value as Record<string, unknown>;
    if (health.instanceId !== this.descriptor.instanceId || health.protocolVersion !== this.descriptor.protocolVersion) {
      throw new IntegrationError('DISCOVERY_STALE', 'EDI runtime information is stale.', true);
    }
    return health as { instanceId: string; protocolVersion: number };
  }

  async openProject(request: OpenProjectRequest): Promise<OpenProjectResult> {
    return this.send<OpenProjectResult>(request);
  }

  async createEntry(request: CreateEntryRequest): Promise<CreateEntryResult> {
    return this.send<CreateEntryResult>(request);
  }

  private async send<T>(request: OpenProjectRequest | CreateEntryRequest): Promise<T> {
    const value = await this.request('POST', '/v1/requests', request, this.descriptor.token);
    const response: ProtocolResponse<T> = parseProtocolResponse(value, request.requestId);
    if (!response.ok) {
      throw new IntegrationError(response.error.code, response.error.message, response.error.retryable);
    }
    return response.result;
  }

  private request(method: 'GET' | 'POST', path: string, body?: unknown, token?: string): Promise<unknown> {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const request = http.request({
        host: '127.0.0.1',
        port: this.descriptor.port,
        path,
        method,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }, (response) => {
        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > RESPONSE_LIMIT) {
            response.destroy(new Error('EDI response is too large.'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          try {
            const parsed = raw ? JSON.parse(raw) : {};
            if ((response.statusCode ?? 500) >= 400) {
              const error = parsed?.error;
              reject(new IntegrationError(error?.code ?? 'EDI_REQUEST_FAILED', error?.message ?? 'EDI rejected the request.', Boolean(error?.retryable)));
              return;
            }
            resolve(parsed);
          } catch (error) {
            reject(new IntegrationError('MALFORMED_RESPONSE', `EDI returned malformed JSON: ${String(error)}`));
          }
        });
      });
      request.setTimeout(this.timeoutMs, () => request.destroy(new IntegrationError('CONNECTION_TIMEOUT', 'EDI did not respond in time.', true)));
      request.on('error', (error) => reject(error instanceof IntegrationError ? error : new IntegrationError('EDI_NOT_RUNNING', 'EDI is not running.', true)));
      if (payload) request.write(payload);
      request.end();
    });
  }
}
