import { BadRequestException } from '@nestjs/common';

// Stage keys a pipeline configuration may list. `compile` is accepted as an older
// name for `build`. Security stages (security/slither/policy) are evaluated by M4.
export const PIPELINE_STAGES = ['checkout', 'compile', 'build', 'test', 'security', 'slither', 'policy'] as const;
// Mirrors projects.framework (migrations/001_core_schema.sql).
export const PIPELINE_FRAMEWORKS = ['hardhat', 'foundry', 'other'] as const;
export const PIPELINE_TRIGGERS = ['push', 'pull_request', 'tag'] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export type PipelineFramework = (typeof PIPELINE_FRAMEWORKS)[number];
export type PipelineTrigger = (typeof PIPELINE_TRIGGERS)[number];
export interface PipelineConfigInput {
  name: string;
  repository: string;
  branch: string;
  framework?: PipelineFramework;
  stages: PipelineStage[];
  // null = use the framework default command.
  buildCommand?: string | null;
  testCommand?: string | null;
  triggers?: PipelineTrigger[];
  slitherConfig?: string | null;
}
export type PipelineConfigPatch = Partial<PipelineConfigInput>;

const FIELDS = ['name', 'repository', 'branch', 'framework', 'stages', 'buildCommand', 'testCommand', 'triggers', 'slitherConfig'] as const;
// GitHub owner/repo shape: owner is 1-39 alphanumerics or hyphens, repo up to 100 of [A-Za-z0-9._-].
const REPOSITORY = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/;
// Conservative subset of git ref-name rules.
const BRANCH = /^[A-Za-z0-9._/-]+$/;
const CONFIG_PATH = /^[A-Za-z0-9._/-]{1,200}$/;

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

// Commands run inside the isolated build container, never on the API host.
function command(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 300 || Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    throw new BadRequestException(`${label} must be a single-line command of at most 300 characters, or null for the framework default.`);
  }
  return value.trim();
}

function triggers(value: unknown): PipelineTrigger[] {
  if (!Array.isArray(value) || value.some((item) => !(PIPELINE_TRIGGERS as readonly unknown[]).includes(item))) {
    throw new BadRequestException(`triggers must be an array of: ${PIPELINE_TRIGGERS.join(', ')}.`);
  }
  if (new Set(value).size !== value.length) throw new BadRequestException('triggers must not contain duplicates.');
  return value as PipelineTrigger[];
}

function slitherConfig(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !CONFIG_PATH.test(value.trim()) || value.includes('..')) throw new BadRequestException('slitherConfig must be a relative file path such as "slither.config.json".');
  return value.trim();
}

function optional(b: Record<string, unknown>, target: PipelineConfigPatch) {
  if (b.buildCommand !== undefined) target.buildCommand = command(b.buildCommand, 'buildCommand');
  if (b.testCommand !== undefined) target.testCommand = command(b.testCommand, 'testCommand');
  if (b.triggers !== undefined) target.triggers = triggers(b.triggers);
  if (b.slitherConfig !== undefined) target.slitherConfig = slitherConfig(b.slitherConfig);
}

export function parseCreate(body: unknown): PipelineConfigInput {
  const b = fields(body);
  const input: PipelineConfigInput = {
    name: name(b.name),
    repository: repository(b.repository),
    branch: branch(b.branch),
    // Omitted framework falls back to the project's framework in the service.
    framework: b.framework === undefined ? undefined : framework(b.framework),
    stages: stages(b.stages),
  };
  optional(b, input);
  return input;
}

export function parsePatch(body: unknown): PipelineConfigPatch {
  const b = fields(body);
  const patch: PipelineConfigPatch = {};
  if (b.name !== undefined) patch.name = name(b.name);
  if (b.repository !== undefined) patch.repository = repository(b.repository);
  if (b.branch !== undefined) patch.branch = branch(b.branch);
  if (b.framework !== undefined) patch.framework = framework(b.framework);
  if (b.stages !== undefined) patch.stages = stages(b.stages);
  optional(b, patch);
  if (Object.keys(patch).length === 0) throw new BadRequestException(`Provide at least one of: ${FIELDS.join(', ')}.`);
  return patch;
}

// Effective commands when the configuration leaves them empty.
export function defaultCommands(fw: PipelineFramework): { build: string; test: string } {
  return fw === 'foundry' ? { build: 'forge build', test: 'forge test' } : { build: 'npx hardhat compile', test: 'npx hardhat test' };
}
