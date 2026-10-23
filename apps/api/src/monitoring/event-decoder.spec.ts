import { describe, expect, it, vi, afterEach } from 'vitest';
import { Interface } from 'ethers';
import { decodeEvent, eventCatalog, matches } from './event-decoder.js';
import { ChainGateway, type ChainLog } from './chain.gateway.js';
import { runtimeRuleInput, settingsInput } from './runtime.validation.js';

const abi = ['event Withdrawal(address indexed owner,uint256 amount)'];
const iface = new Interface(abi),
  amount = ((1n << 256n) - 1n).toString();
const encoded = iface.encodeEventLog(iface.getEvent('Withdrawal')!, [
  '0x' + '12'.repeat(20),
  amount,
]);
const log: ChainLog = {
  address: '0x' + '34'.repeat(20),
  ...encoded,
  blockNumber: '0x64',
  blockHash: '0x' + 'a1'.repeat(32),
  transactionHash: '0x' + 'b2'.repeat(32),
  transactionIndex: '0x0',
  logIndex: '0x1',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('M3 chain decoding and rule safety', () => {
  it('derives signatures from the registry ABI and retains exact uint256 arguments', () => {
    expect(eventCatalog(abi)[0]).toMatchObject({
      name: 'Withdrawal',
      signature: 'Withdrawal(address,uint256)',
    });
    expect(decodeEvent(log, abi)).toMatchObject({
      eventName: 'Withdrawal',
      args: { amount },
      decodeError: null,
    });
  });
  it('retains unknown and malformed event evidence without throwing or executing it', () => {
    expect(
      decodeEvent({ ...log, topics: ['0x' + '00'.repeat(32)] }, abi)
        .decodeError,
    ).toBeTruthy();
    expect(decodeEvent({ ...log, data: '0x12' }, abi).decodeError).toBeTruthy();
  });
  it('compares numeric parameters with BigInt rather than unsafe JS numbers', () => {
    expect(
      matches(
        { field: 'amount', operator: 'gt', value: '9007199254740992' },
        '9007199254740993',
      ),
    ).toBe(true);
    expect(matches({ field: 'amount', operator: 'eq', value: '1' }, 1)).toBe(
      false,
    );
    expect(
      matches(
        { field: 'amount', operator: 'lt', value: '2' },
        'process.exit()',
      ),
    ).toBe(false);
  });
  it('validates bounded watcher settings and structured count rules', () => {
    expect(
      settingsInput({
        enabled: true,
        pollingSeconds: 10,
        confirmations: 12,
        startBlock: '100',
      }),
    ).toMatchObject({ startBlock: '100' });
    expect(() =>
      settingsInput({ enabled: true, pollingSeconds: 0, confirmations: 12 }),
    ).toThrow();
    expect(() =>
      runtimeRuleInput({
        name: 'Count',
        eventName: 'Withdrawal',
        condition: { field: 'count', operator: 'gt', value: '3' },
        mode: 'count',
        windowSeconds: 0,
      }),
    ).toThrow();
    expect(() =>
      runtimeRuleInput({
        name: 'Count',
        eventName: 'Withdrawal',
        condition: { field: 'amount', operator: 'gt', value: '3' },
        mode: 'count',
        windowSeconds: 60,
      }),
    ).toThrow();
  });
  it('fails closed when an RPC endpoint reports the wrong chain', async () => {
    vi.stubEnv(
      'MONITORING_SEPOLIA_RPC_URL',
      'https://rpc.example.test/private-key',
    );
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ result: '0x1' }))),
    );
    await expect(new ChainGateway().head()).rejects.toThrow(
      'RPC chain does not match Sepolia',
    );
  });
  it('does not expose a credential-bearing RPC URL on failure', async () => {
    vi.stubEnv(
      'MONITORING_SEPOLIA_RPC_URL',
      'https://rpc.example.test/secret-credential',
    );
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValue(
          new Error('https://rpc.example.test/secret-credential'),
        ),
    );
    await expect(new ChainGateway().head()).rejects.toThrow(
      'Sepolia RPC request failed; retry is scheduled.',
    );
  });
});
