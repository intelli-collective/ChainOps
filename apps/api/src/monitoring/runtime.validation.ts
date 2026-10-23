import { BadRequestException } from '@nestjs/common';
import { ruleInput, uuid } from './monitoring.validation.js';

export function inputObject(
  value: unknown,
  keys: string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new BadRequestException('Unexpected input fields');
  return value as Record<string, unknown>;
}
export function integer(
  value: unknown,
  min: number,
  max: number,
  field: string,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw new BadRequestException(
      `${field} must be an integer from ${min} to ${max}`,
    );
  return value;
}
export function settingsInput(value: unknown) {
  const b = inputObject(value, [
    'enabled',
    'pollingSeconds',
    'confirmations',
    'startBlock',
  ]);
  if (typeof b.enabled !== 'boolean')
    throw new BadRequestException('enabled must be a boolean');
  if (
    b.startBlock !== undefined &&
    (typeof b.startBlock !== 'string' ||
      !/^(0|[1-9][0-9]{0,14})$/.test(b.startBlock))
  )
    throw new BadRequestException(
      'startBlock must be a non-negative decimal string of at most 15 digits',
    );
  return {
    enabled: b.enabled,
    pollingSeconds: integer(b.pollingSeconds, 2, 300, 'pollingSeconds'),
    confirmations: integer(b.confirmations, 1, 128, 'confirmations'),
    startBlock: b.startBlock as string | undefined,
  };
}
export function runtimeRuleInput(value: unknown) {
  const b = inputObject(value, [
    'name',
    'eventName',
    'condition',
    'enabled',
    'monitoredContractId',
    'description',
    'severity',
    'mode',
    'windowSeconds',
  ]);
  const {
    description = '',
    severity = 'warning',
    mode = 'parameter',
    windowSeconds,
    ...base
  } = b;
  const rule = ruleInput(base);
  if (typeof description !== 'string' || description.length > 1000)
    throw new BadRequestException(
      'description must be at most 1000 characters',
    );
  if (!['info', 'warning', 'critical'].includes(String(severity)))
    throw new BadRequestException('Unsupported severity');
  if (!['parameter', 'count'].includes(String(mode)))
    throw new BadRequestException('Unsupported rule mode');
  if (mode === 'count' && rule.condition.field !== 'count')
    throw new BadRequestException('Count rules must use the count field');
  const window =
    mode === 'count'
      ? integer(windowSeconds, 60, 86400, 'windowSeconds')
      : null;
  if (mode === 'parameter' && windowSeconds !== undefined)
    throw new BadRequestException('Parameter rules have no time window');
  return {
    ...rule,
    description,
    severity: severity as string,
    mode: mode as string,
    windowSeconds: window,
  };
}
export function subscriptionInput(value: unknown) {
  const b = inputObject(value, ['signature']);
  if (
    typeof b.signature !== 'string' ||
    !b.signature ||
    b.signature.length > 1024
  )
    throw new BadRequestException('An ABI event signature is required');
  return b.signature;
}
export function targetInput(value: unknown) {
  const b = inputObject(value, ['registryContractId']);
  return uuid(b.registryContractId);
}
export function noteInput(value: unknown) {
  const b = inputObject(value ?? {}, ['note']);
  if (
    b.note !== undefined &&
    (typeof b.note !== 'string' || b.note.length > 2000)
  )
    throw new BadRequestException('note must be at most 2000 characters');
  return (b.note ?? '') as string;
}
export function pageInput(query: Record<string, unknown>) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 25 : Number(query.limit);
  integer(page, 1, 100000, 'page');
  integer(limit, 1, 100, 'limit');
  return { page, limit, offset: (page - 1) * limit };
}
