import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface ChainLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  blockHash: string;
  transactionHash: string;
  transactionIndex: string;
  logIndex: string;
  removed?: boolean;
}
export interface ChainBlock {
  hash: string;
  number: string;
  timestamp: string;
}
const hash = /^0x[0-9a-f]{64}$/i;
export const hexBlock = (value: number) => `0x${value.toString(16)}`;
export function quantity(value: unknown): number {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value))
    throw new Error('Invalid chain quantity');
  const number = Number(BigInt(value));
  if (!Number.isSafeInteger(number) || number < 0)
    throw new Error('Unsupported chain quantity');
  return number;
}

/** Read-only, bounded HTTP JSON-RPC. Credentials stay on the worker/API server. */
@Injectable()
export class ChainGateway {
  configured() {
    return Boolean(process.env.MONITORING_SEPOLIA_RPC_URL);
  }
  private async rpc(method: string, params: unknown[]): Promise<unknown> {
    const endpoint = process.env.MONITORING_SEPOLIA_RPC_URL;
    if (!endpoint)
      throw new ServiceUnavailableException('Sepolia RPC is not configured');
    try {
      const url = new URL(endpoint);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error();
      const text = await response.text();
      if (text.length > 8_000_000) throw new Error();
      const body = JSON.parse(text) as { result?: unknown; error?: unknown };
      if (body.error || body.result === undefined) throw new Error();
      return body.result;
    } catch {
      throw new ServiceUnavailableException(
        'Sepolia RPC request failed; retry is scheduled.',
      );
    }
  }
  async head() {
    if (quantity(await this.rpc('eth_chainId', [])) !== 11155111)
      throw new ServiceUnavailableException('RPC chain does not match Sepolia');
    return quantity(await this.rpc('eth_blockNumber', []));
  }
  async block(number: number): Promise<ChainBlock> {
    const b = (await this.rpc('eth_getBlockByNumber', [
      hexBlock(number),
      false,
    ])) as ChainBlock | null;
    if (!b || !hash.test(b.hash) || quantity(b.number) !== number)
      throw new Error('Invalid chain block');
    quantity(b.timestamp);
    return { ...b, hash: b.hash.toLowerCase() };
  }
  async logs(address: string, from: number, to: number): Promise<ChainLog[]> {
    const result = await this.rpc('eth_getLogs', [
      { address, fromBlock: hexBlock(from), toBlock: hexBlock(to) },
    ]);
    if (!Array.isArray(result) || result.length > 2000)
      throw new ServiceUnavailableException(
        'RPC range exceeded the supported log limit',
      );
    for (const item of result as ChainLog[]) {
      if (
        item.address?.toLowerCase() !== address.toLowerCase() ||
        !hash.test(item.blockHash) ||
        !hash.test(item.transactionHash) ||
        !Array.isArray(item.topics) ||
        !item.topics.every((t) => hash.test(t)) ||
        typeof item.data !== 'string' ||
        !/^0x(?:[0-9a-f]{2})*$/i.test(item.data) ||
        quantity(item.blockNumber) < from ||
        quantity(item.blockNumber) > to
      )
        throw new Error('Invalid chain log');
      quantity(item.logIndex);
      quantity(item.transactionIndex);
    }
    return (result as ChainLog[]).sort(
      (a, b) =>
        quantity(a.blockNumber) - quantity(b.blockNumber) ||
        quantity(a.transactionIndex) - quantity(b.transactionIndex) ||
        quantity(a.logIndex) - quantity(b.logIndex),
    );
  }
}
