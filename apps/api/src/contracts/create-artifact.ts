import { BadRequestException } from '@nestjs/common';

export interface CreateArtifact {
  name: string;
  version: string;
  framework: 'hardhat' | 'foundry' | 'other';
  contractPath: string;
  compilerVersion: string;
}

// The API currently validates unknown input explicitly; class-validator is not installed.
export function parseArtifact(body: unknown): CreateArtifact {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Provide artifact metadata');
  }
  const input = body as Record<string, unknown>;
  const limits = {
    name: 120,
    version: 80,
    framework: 24,
    contractPath: 512,
    compilerVersion: 80,
  };
  if (Object.keys(input).some((key) => !Object.hasOwn(limits, key))) {
    throw new BadRequestException('Unknown artifact metadata field');
  }
  const result: Record<string, string> = {};
  for (const [key, max] of Object.entries(limits)) {
    const value = input[key];
    if (
      typeof value !== 'string' ||
      !value.trim() ||
      value.trim().length > max ||
      Array.from(value).some(
        (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
      )
    ) {
      throw new BadRequestException(
        `${key} must be a non-empty string of at most ${max} characters without control characters`,
      );
    }
    result[key] = value.trim();
  }
  if (!['hardhat', 'foundry', 'other'].includes(result.framework)) {
    throw new BadRequestException(
      'framework must be hardhat, foundry, or other',
    );
  }
  return result as unknown as CreateArtifact;
}
