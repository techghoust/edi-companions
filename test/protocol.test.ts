import { describe, expect, it } from 'vitest';
import { parseProtocolResponse, parseRuntimeDescriptor } from '../src/integration/protocol';

describe('runtime descriptor', () => {
  it('accepts a valid protocol v1 descriptor', () => {
    const descriptor = parseRuntimeDescriptor({
      protocolVersion: 1,
      port: 43127,
      token: 'a'.repeat(64),
      pid: 12044,
      instanceId: 'instance-123',
    });
    expect(descriptor.port).toBe(43127);
  });

  it('rejects unsupported protocols and invalid ports', () => {
    expect(() => parseRuntimeDescriptor({ protocolVersion: 2, port: 1, token: 'a'.repeat(64), pid: 1, instanceId: 'instance-123' })).toThrow(/Unsupported/);
    expect(() => parseRuntimeDescriptor({ protocolVersion: 1, port: 70000, token: 'a'.repeat(64), pid: 1, instanceId: 'instance-123' })).toThrow(/port/);
  });
});

describe('protocol responses', () => {
  it('rejects mismatched request identifiers', () => {
    expect(() => parseProtocolResponse({ protocolVersion: 1, requestId: 'other', ok: true, result: {} }, 'expected')).toThrow(/mismatched/);
  });
});
