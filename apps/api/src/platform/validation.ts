import { BadRequestException } from '@nestjs/common';
import { isRole, type Role } from './access.js';

// Manual validation, matching the rest of the API (no class-validator dependency).
export function body(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Request body must be a JSON object.');
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) throw new BadRequestException(`Unknown field(s): ${unknown.join(', ')}.`);
  return value as Record<string, unknown>;
}

// Control characters (other than newline where allowed) are rejected in text input.
const hasControl = (value: string, allowNewline = false) =>
  Array.from(value).some((char) => { const code = char.charCodeAt(0); return (code < 32 && !(allowNewline && code === 10)) || code === 127; });

export function text(value: unknown, label: string, max: number, options: { optional?: boolean } = {}): string | undefined {
  if (value === undefined && options.optional) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || hasControl(value)) {
    throw new BadRequestException(`${label} must be non-empty text of at most ${max} characters.`);
  }
  return value.trim();
}

export function optionalText(value: unknown, label: string, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max || hasControl(value, true)) {
    throw new BadRequestException(`${label} must be text of at most ${max} characters.`);
  }
  return value.trim() || null;
}

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export function slug(value: unknown, label = 'slug'): string {
  if (typeof value !== 'string' || value.length > 80 || !SLUG.test(value)) {
    throw new BadRequestException(`${label} must use lowercase letters, numbers and single hyphens (max 80).`);
  }
  return value;
}

export function slugify(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'project';
}

export function email(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new BadRequestException('Enter a valid email address.');
  return normalized;
}

export function role(value: unknown): Role {
  if (!isRole(value)) throw new BadRequestException('role must be one of: owner, developer, reviewer, viewer.');
  return value;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (!(allowed as readonly unknown[]).includes(value)) throw new BadRequestException(`${label} must be one of: ${allowed.join(', ')}.`);
  return value as T;
}
