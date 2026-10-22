import { ForbiddenException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { authConfig } from './config.js';

/** Reuse the existing cookie-session CSRF rule on protected write routes. */
export function requireCsrf(req: Request): void {
  const cookie = (req.cookies as Record<string, string> | undefined)?.chainops_csrf;
  const header = req.get('X-CSRF-Token');
  if (req.get('origin') !== authConfig().origin || !cookie || !header ||
    !/^[\w-]{43}$/.test(cookie) || !/^[\w-]{43}$/.test(header) ||
    !timingSafeEqual(Buffer.from(cookie), Buffer.from(header))) {
    throw new ForbiddenException('Invalid request origin or CSRF token');
  }
}
