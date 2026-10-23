import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ProjectAccessService } from '../security-governance/project-access.service.js';
import { ReleaseGuard } from './release.guard.js';
import type { ReleaseRequest } from './release.guard.js';

describe('M2 cookie session and CSRF protection', () => {
  const member = vi.fn(),
    projectId = '11111111-1111-4111-8111-111111111111';
  let guard: ReleaseGuard;
  beforeEach(() => {
    member.mockReset();
    member.mockResolvedValue('current-user');
    guard = new ReleaseGuard({
      requireMember: member,
    } as unknown as ProjectAccessService);
    vi.stubEnv('AUTH_WEB_ORIGIN', 'https://chainops.example');
    vi.stubEnv(
      'AUTH_JWT_SECRET',
      'test-only-secret-with-at-least-32-characters',
    );
  });
  function request(method: string, headers: Record<string, string> = {}) {
    const req = {
      method,
      params: { projectId },
      cookies: { chainops_csrf: 'c'.repeat(43) },
      get: (key: string) => headers[key],
    } as unknown as ReleaseRequest;
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    return { req, context };
  }
  it('requires a live session and project membership on reads', async () => {
    const { req, context } = request('GET');
    expect(await guard.canActivate(context)).toBe(true);
    expect(req.releaseUserId).toBe('current-user');
    expect(member).toHaveBeenCalledWith(projectId, req);
    member.mockRejectedValueOnce(new UnauthorizedException());
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    member.mockRejectedValueOnce(new ForbiddenException());
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('rejects missing CSRF, mismatched tokens, and a foreign origin on mutations', async () => {
    for (const headers of [
      {},
      { origin: 'https://evil.example', 'X-CSRF-Token': 'c'.repeat(43) },
      { origin: 'https://chainops.example', 'X-CSRF-Token': 'd'.repeat(43) },
    ]) {
      const { context } = request('POST', headers);
      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
    expect(member).not.toHaveBeenCalled();
    expect(
      await guard.canActivate(
        request('POST', {
          origin: 'https://chainops.example',
          'X-CSRF-Token': 'c'.repeat(43),
        }).context,
      ),
    ).toBe(true);
  });
});
