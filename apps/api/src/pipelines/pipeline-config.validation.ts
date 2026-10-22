import { BadRequestException } from '@nestjs/common';

// Stage keys a pipeline configuration may list. Stored as metadata only;
// nothing in this module executes them.
export const PIPELINE_STAGES = ['checkout', 'compile', 'build', 'test', 'security', 'slither', 'policy'] as const;
// Mirrors projects.framework (migrations/001_core_schema.sql).
export const PIPELINE_FRAMEWORKS = ['hardhat', 'foundry', 'other'] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export type PipelineFramework = (typeof PIPELINE_FRAMEWORKS)[number];
export interface PipelineConfigInput {
  name: string;
  repository: string;
  branch: string;
  framework?: PipelineFramework;
  stages: PipelineStage[];
}
export type PipelineConfigPatch = Partial<PipelineConfigInput>;

const FIELDS = ['name', 'repository', 'branch', 'framework', 'stages'] as const;
// GitHub owner/repo shape: owner is 1-39 alphanumerics or hyphens, repo up to 100 of [A-Za-z0-9._-].
const REPOSITORY = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/;
// Conservative subset of git ref-name rules.
const BRANCH = /^[A-Za-z0-9._/-]+$/;

function fields(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Request body must be a JSON object.');
  const unknown = Object.keys(body).filter((key) => !(FIELDS as readonly string[]).includes(key));
  if (unknown.length) throw new BadRequestException(`Unknown field(s): ${unknown.join(', ')}.`);
  return body as Record<string, unknown>;
}

function name(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) throw new BadRequestException('name must be a non-empty string of at most 120 characters.');
  return value.trim();
}

function repository(value: unknown): string {
  if (typeof value !== 'string' || !REPOSITORY.test(value.trim()) || value.trim().endsWith('.git')) throw new BadRequestException('repository must be a GitHub "owner/repo" name, e.g. "intelli-collective/vault-contracts".');
  return value.trim();
}

function branch(value: unknown): string {
  const ref = typeof value === 'string' ? value.trim() : '';
  if (!ref || ref.length > 255 || !BRANCH.test(ref) || ref.startsWith('-') || ref.startsWith('/') || ref.endsWith('/') || ref.endsWith('.') || ref.endsWith('.lock') || ref.includes('..') || ref.includes('//')) {
    throw new BadRequestException('branch must be a valid non-empty git branch name.');
  }
  return ref;
}

function framework(value: unknown): PipelineFramework {
  if (!(PIPELINE_FRAMEWORKS as readonly unknown[]).includes(value)) throw new BadRequestException(`framework must be one of: ${PIPELINE_FRAMEWORKS.join(', ')}.`);
  return value as PipelineFramework;
}

function stages(value: unknown): PipelineStage[] {
  if (!Array.isArray(value) || value.length === 0) throw new BadRequestException('stages must be a non-empty array.');
  const invalid = value.filter((stage) => !(PIPELINE_STAGES as readonly unknown[]).includes(stage));
  if (invalid.length) throw new BadRequestException(`Unsupported stage(s): ${invalid.map(String).join(', ')}. Allowed: ${PIPELINE_STAGES.join(', ')}.`);
  if (new Set(value).size !== value.length) throw new BadRequestException('stages must not contain duplicates.');
  return value as PipelineStage[];
}

export function parseCreate(body: unknown): PipelineConfigInput {
  const b = fields(body);
  return {
    name: name(b.name),
    repository: repository(b.repository),
    branch: branch(b.branch),
    // Omitted framework falls back to the project's framework in the service.
    framework: b.framework === undefined ? undefined : framework(b.framework),
    stages: stages(b.stages),
  };
}

export function parsePatch(body: unknown): PipelineConfigPatch {
  const b = fields(body);
  const patch: PipelineConfigPatch = {};
  if (b.name !== undefined) patch.name = name(b.name);
  if (b.repository !== undefined) patch.repository = repository(b.repository);
  if (b.branch !== undefined) patch.branch = branch(b.branch);
  if (b.framework !== undefined) patch.framework = framework(b.framework);
  if (b.stages !== undefined) patch.stages = stages(b.stages);
  if (Object.keys(patch).length === 0) throw new BadRequestException(`Provide at least one of: ${FIELDS.join(', ')}.`);
  return patch;
}
