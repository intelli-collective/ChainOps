import { BadRequestException } from '@nestjs/common';

// Sepolia is the network represented in the current monitoring frontend.
export const SUPPORTED_MONITORING_NETWORKS = ['sepolia'] as const;
const operators = ['eq', 'gt', 'gte', 'lt', 'lte'] as const;
export type AlertCondition = {
  field: string;
  operator: (typeof operators)[number];
  value: string;
};

function object(value: unknown, allowed: string[]): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  ) {
    throw new BadRequestException(
      'Expected an object with only supported fields',
    );
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max = 120): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.trim().length > max ||
    Array.from(value).some((character) => character.charCodeAt(0) < 32)
  ) {
    throw new BadRequestException(
      `${label} must be a non-empty string of at most ${max} characters`,
    );
  }
  return value.trim();
}

export function uuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new BadRequestException('Expected a UUID');
  }
  return value.toLowerCase();
}

export function monitorInput(value: unknown) {
  const body = object(value, ['name', 'network', 'address']);
  const name = text(body.name, 'name');
  if (
    typeof body.network !== 'string' ||
    !SUPPORTED_MONITORING_NETWORKS.includes(body.network as 'sepolia')
  ) {
    throw new BadRequestException('Supported monitoring network: sepolia');
  }
  if (
    typeof body.address !== 'string' ||
    !/^0x[0-9a-fA-F]{40}$/.test(body.address)
  ) {
    throw new BadRequestException(
      'address must be an EVM 20-byte hexadecimal address',
    );
  }
  return { name, network: body.network, address: body.address.toLowerCase() };
}

export function ruleInput(value: unknown) {
  const body = object(value, [
    'name',
    'eventName',
    'condition',
    'enabled',
    'monitoredContractId',
  ]);
  const name = text(body.name, 'name');
  const eventName = text(body.eventName, 'eventName', 128);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(eventName))
    throw new BadRequestException('eventName must be an event identifier');
  const condition = object(body.condition, ['field', 'operator', 'value']);
  if (
    typeof condition.field !== 'string' ||
    !/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(condition.field)
  ) {
    throw new BadRequestException(
      'condition.field must be a parameter identifier',
    );
  }
  if (!operators.includes(condition.operator as (typeof operators)[number]))
    throw new BadRequestException('Unsupported condition operator');
  // Keep uint256 thresholds exact across JSON and JavaScript. Never execute expressions.
  if (
    typeof condition.value !== 'string' ||
    !/^(0|[1-9][0-9]{0,77})$/.test(condition.value) ||
    BigInt(condition.value) >= 1n << 256n
  ) {
    throw new BadRequestException(
      'condition.value must be an unsigned uint256 decimal string',
    );
  }
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean')
    throw new BadRequestException('enabled must be a boolean');
  return {
    name,
    eventName,
    condition: condition as AlertCondition,
    enabled: body.enabled ?? true,
    monitoredContractId:
      body.monitoredContractId === undefined
        ? null
        : uuid(body.monitoredContractId),
  };
}
