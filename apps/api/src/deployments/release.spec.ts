import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { DatabaseService } from '../database/database.service.js';
import { ReleaseIntegration } from './release.integration.js';
import { ReleaseService } from './release.service.js';
import {
  parseDeploymentDraft,
  parseRegistration,
} from './release.validation.js';

const project = '11111111-1111-4111-8111-111111111111',
  user = '22222222-2222-4222-8222-222222222222';
const input = {
  name: 'Vault',
  version: 'v1.0',
  networkId: 'sepolia',
  address: `0x${'a'.repeat(40)}`,
};
describe('release validation', () => {
  it('rejects spoofed state, approval, network URLs and malformed parameters', () => {
    expect(() =>
      parseRegistration({ ...input, provenance: 'deployment' }),
    ).toThrow();
    expect(() =>
      parseRegistration({ ...input, address: `0x${'0'.repeat(40)}` }),
    ).toThrow();
    expect(() =>
      parseDeploymentDraft({
        artifactId: 'a',
        networkId: 'n',
        parameters: [],
        status: 'CONFIRMED',
      }),
    ).toThrow();
    expect(() =>
      parseDeploymentDraft({
        artifactId: 'a',
        networkId: 'n',
        parameters: [],
        rpcUrl: 'https://example.com',
      }),
    ).toThrow();
    expect(() =>
      parseDeploymentDraft({
        artifactId: 'a',
        networkId: 'n',
        parameters: [5],
      }),
    ).toThrow();
    expect(parseRegistration({ ...input, version: '' }).version).toBe('v1.0');
    expect(
      parseRegistration({ ...input, address: input.address.toUpperCase() })
        .address,
    ).toBe(input.address);
  });
});
describe('release service authorization boundaries', () => {
  const query = vi.fn();
  let integration: ReleaseIntegration, service: ReleaseService;
  beforeEach(() => {
    query.mockReset();
    integration = new ReleaseIntegration();
    service = new ReleaseService(
      { query } as unknown as DatabaseService,
      integration,
    );
  });
  it('fails closed with no upstream evidence and never writes or sends a transaction', async () => {
    const draft = {
      artifactId: 'artifact',
      networkId: 'sepolia',
      parameters: [],
    };
    expect(await service.artifacts(project)).toEqual([]);
    expect(await service.networks(project)).toEqual([]);
    expect((await service.preflight(project, draft)).eligible).toBe(false);
    await expect(
      service.submit(project, draft, crypto.randomUUID()),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(query).not.toHaveBeenCalled();
  });
  it('requires an idempotency key and rejects client-supplied approval decisions', async () => {
    await expect(service.submit(project, {}, undefined)).rejects.toThrow(
      'Idempotency-Key',
    );
    await expect(
      service.preflight(project, {
        artifactId: 'a',
        networkId: 'n',
        parameters: [],
        approved: true,
      }),
    ).rejects.toThrow('Unexpected');
  });
  it('scopes registry and transaction queries to both project and member', async () => {
    query.mockResolvedValue({ rows: [] });
    expect(await service.registry(project, user)).toEqual([]);
    expect(query.mock.calls[0][0]).toContain('organization_members');
    expect(query.mock.calls[0][1]).toEqual([project, user]);
    await expect(
      service.deployments(
        project,
        user,
        '33333333-3333-4333-8333-333333333333',
      ),
    ).rejects.toThrow('not found');
    expect(query.mock.calls[1][1]).toEqual([
      project,
      user,
      '33333333-3333-4333-8333-333333333333',
    ]);
  });
  it('rejects unconfigured networks before inserting', async () => {
    await expect(service.register(project, user, input)).rejects.toThrow(
      'configured project network',
    );
    expect(query).not.toHaveBeenCalled();
  });
  it('rechecks membership in the insert and preserves external provenance', async () => {
    integration.networks = async () => [
      {
        id: 'sepolia',
        chainId: 11155111,
        name: 'Sepolia',
        environment: 'Public testnet',
        rpcLabel: 'Configured RPC',
        connected: false,
        signingAvailable: false,
      },
    ];
    query.mockResolvedValueOnce({ rows: [] });
    await expect(service.register(project, user, input)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(query.mock.calls[0][0]).toContain('organization_members');
    expect(query.mock.calls[0][0]).toContain("'external'");
    query.mockRejectedValueOnce({ code: '23505' });
    await expect(service.register(project, user, input)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('never changes an ambiguous transaction into a failed transaction on missing RPC', async () => {
    query.mockResolvedValue({
      rows: [
        {
          id: project,
          status: 'UNKNOWN',
          evidence: {},
          transaction_hash: `0x${'a'.repeat(64)}`,
        },
      ],
    });
    await expect(service.reconcile(project, user, project)).rejects.toThrow(
      'outcome has not changed',
    );
    expect(query).toHaveBeenCalledTimes(1);
  });
});
