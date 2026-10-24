import { describe, expect, it } from 'vitest';
import { monitorInput, ruleInput, uuid } from './monitoring.validation.js';

const monitor = {
  name: 'Vault',
  network: 'sepolia',
  address: `0x${'aB'.repeat(20)}`,
};
const rule = {
  name: 'Large Withdrawal',
  eventName: 'Withdrawal',
  condition: { field: 'amount', operator: 'gt', value: '100' },
};

describe('monitoring input validation', () => {
  it('normalizes addresses and trims names', () => {
    expect(monitorInput({ ...monitor, name: ' Vault ' })).toEqual({
      ...monitor,
      address: monitor.address.toLowerCase(),
    });
  });

  it.each([
    null,
    [],
    'monitor',
    {},
    { ...monitor, address: '0x1234' },
    { ...monitor, address: `0x${'g'.repeat(40)}` },
    { ...monitor, network: 'mainnet' },
    { ...monitor, name: ' ' },
    { ...monitor, name: 'Vault\n' },
    { ...monitor, name: 'x'.repeat(121) },
    { ...monitor, userId: 'untrusted' },
    { ...monitor, createdAt: '2026-01-01' },
  ])('rejects invalid monitor %j', (input) => {
    expect(() => monitorInput(input)).toThrow();
  });

  it('retains exact uint256 strings and defaults enabled to true', () => {
    const value = ((1n << 256n) - 1n).toString();
    expect(
      ruleInput({ ...rule, condition: { ...rule.condition, value } }),
    ).toMatchObject({ enabled: true, condition: { value } });
    expect(ruleInput({ ...rule, enabled: false })).toMatchObject({
      enabled: false,
    });
  });

  it.each(['eq', 'gt', 'gte', 'lt', 'lte'])(
    'accepts the %s operator',
    (operator) => {
      expect(
        ruleInput({ ...rule, condition: { ...rule.condition, operator } })
          .condition.operator,
      ).toBe(operator);
    },
  );

  it.each([
    null,
    [],
    {},
    { ...rule, eventName: 'Withdrawal()' },
    { ...rule, enabled: 'true' },
    { ...rule, monitoredContractId: 'not-a-uuid' },
    { ...rule, condition: 'amount > 100' },
    { ...rule, condition: { ...rule.condition, operator: 'eval' } },
    {
      ...rule,
      condition: { ...rule.condition, field: 'amount;drop table users' },
    },
    { ...rule, condition: { ...rule.condition, expression: 'process.exit()' } },
    ...[
      100,
      9007199254740992,
      null,
      '1e18',
      '-1',
      '1.2',
      '00',
      '9'.repeat(1000),
      (1n << 256n).toString(),
    ].map((value) => ({ ...rule, condition: { ...rule.condition, value } })),
  ])('rejects unsafe or malformed rules %j', (input) => {
    expect(() => ruleInput(input)).toThrow();
  });

  it('validates optional contract UUIDs', () => {
    expect(uuid('01234567-89ab-4cde-8fab-0123456789AB')).toBe(
      '01234567-89ab-4cde-8fab-0123456789ab',
    );
    expect(() => uuid('not-a-uuid')).toThrow();
  });
});
