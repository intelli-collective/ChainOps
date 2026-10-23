import { Interface, type InterfaceAbi, type ParamType } from 'ethers';
import type { ChainLog } from './chain.gateway.js';
import type { AlertCondition } from './monitoring.validation.js';

function normalized(value: unknown, type: ParamType): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (type.baseType === 'array' && type.arrayChildren && Array.isArray(value))
    return value.map((v) => normalized(v, type.arrayChildren!));
  if (type.baseType === 'tuple' && type.components && Array.isArray(value))
    return Object.fromEntries(
      type.components.map((t, i) => [
        t.name || String(i),
        normalized(value[i], t),
      ]),
    );
  if (value && typeof value === 'object' && 'hash' in value)
    return { indexedHash: String(value.hash) };
  return value;
}
export function eventCatalog(abi: InterfaceAbi) {
  const events: {
    name: string;
    signature: string;
    fields: { name: string; type: string }[];
  }[] = [];
  new Interface(abi).forEachEvent((fragment) =>
    events.push({
      name: fragment.name,
      signature: fragment.format('sighash'),
      fields: fragment.inputs.map((i, n) => ({
        name: i.name || String(n),
        type: i.type,
      })),
    }),
  );
  return events;
}
export function decodeEvent(log: ChainLog, abi: InterfaceAbi) {
  try {
    const parsed = new Interface(abi).parseLog({
      topics: log.topics,
      data: log.data,
    });
    if (!parsed)
      return {
        eventName: null,
        signature: null,
        args: null,
        decodeError: 'No matching ABI event',
      };
    return {
      eventName: parsed.name,
      signature: parsed.signature,
      args: Object.fromEntries(
        parsed.fragment.inputs.map((type, i) => [
          type.name || String(i),
          normalized(parsed.args[i], type),
        ]),
      ),
      decodeError: null,
    };
  } catch {
    return {
      eventName: null,
      signature: null,
      args: null,
      decodeError: 'Log could not be decoded using the registered ABI',
    };
  }
}
export function matches(condition: AlertCondition, value: unknown): boolean {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(value))
    return false;
  const a = BigInt(value),
    b = BigInt(condition.value);
  switch (condition.operator) {
    case 'eq':
      return a === b;
    case 'gt':
      return a > b;
    case 'gte':
      return a >= b;
    case 'lt':
      return a < b;
    case 'lte':
      return a <= b;
  }
}
