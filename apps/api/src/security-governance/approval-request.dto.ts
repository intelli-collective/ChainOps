import { BadRequestException } from '@nestjs/common';

export interface CreateApprovalRequestDto {
  title: string;
  description: string | null;
}

const fields = new Set(['title', 'description']);

/** Unknown fields are rejected, matching the existing policy DTO behavior. */
export function parseApprovalRequestDto(body: unknown): CreateApprovalRequestDto {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('An approval request object is required');
  }
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some(key => !fields.has(key))) {
    throw new BadRequestException('Unknown approval request field');
  }
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 200) {
    throw new BadRequestException('Title must be a non-empty string of at most 200 characters');
  }
  if (input.description !== undefined && typeof input.description !== 'string') {
    throw new BadRequestException('Description must be a string');
  }
  return { title: input.title.trim(), description: typeof input.description === 'string' ? input.description : null };
}
