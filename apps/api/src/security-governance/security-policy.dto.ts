import { BadRequestException } from '@nestjs/common';

export interface CreateSecurityPolicyDto {
  name: string;
  blockCritical: boolean;
  blockHigh: boolean;
  requireApproval: boolean;
}

const fields = new Set(['name', 'blockCritical', 'blockHigh', 'requireApproval']);

/** The API has no global ValidationPipe or class-validator dependency yet. */
export function parseSecurityPolicyDto(body: unknown): CreateSecurityPolicyDto {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('A security policy object is required');
  }
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(key => !fields.has(key))) {
    throw new BadRequestException('Unknown security policy field');
  }
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 120) {
    throw new BadRequestException('Name must be a non-empty string of at most 120 characters');
  }
  if (typeof input.blockCritical !== 'boolean' || typeof input.blockHigh !== 'boolean' || typeof input.requireApproval !== 'boolean') {
    throw new BadRequestException('Policy flags must be booleans');
  }
  return {
    name: input.name.trim(),
    blockCritical: input.blockCritical,
    blockHigh: input.blockHigh,
    requireApproval: input.requireApproval,
  };
}
