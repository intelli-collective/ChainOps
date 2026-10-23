import { BadRequestException } from '@nestjs/common';

function object(body: unknown, keys: string[]): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new BadRequestException('Expected an object');
  if (Object.keys(body).some((key) => !keys.includes(key)))
    throw new BadRequestException('Unexpected request fields');
  return body as Record<string, unknown>;
}
function string(
  body: Record<string, unknown>,
  key: string,
  limit: number,
  optional = false,
) {
  const value = body[key];
  if (optional && (value === undefined || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.length > limit)
    throw new BadRequestException(`Invalid ${key}`);
  return value.trim();
}
export function parseRegistration(body: unknown) {
  const input = object(body, ['name', 'version', 'address', 'networkId']);
  const address = string(input, 'address', 42).toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(address) || /^0x0{40}$/.test(address))
    throw new BadRequestException('Enter a valid, nonzero EVM address');
  return {
    name: string(input, 'name', 120),
    version: string(input, 'version', 80, true) || 'v1.0',
    address,
    networkId: string(input, 'networkId', 80),
  };
}
export function parseDeploymentDraft(body: unknown) {
  const input = object(body, ['artifactId', 'networkId', 'parameters']);
  const artifactId = string(input, 'artifactId', 120),
    networkId = string(input, 'networkId', 80);
  if (
    !Array.isArray(input.parameters) ||
    input.parameters.length > 100 ||
    input.parameters.some((p) => typeof p !== 'string' || p.length > 16000)
  )
    throw new BadRequestException('Invalid constructor parameters');
  return { artifactId, networkId, parameters: input.parameters as string[] };
}
