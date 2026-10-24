import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const OWNER = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const REPOSITORY = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/;

export interface GitHubRepository {
  fullName: string;
  name: string;
  defaultBranch: string;
  description: string | null;
  updatedAt: string;
}

export interface GitHubBranch {
  name: string;
  commitSha: string;
}

export interface GitHubIntegrationStatus {
  // No organization-level GitHub App/OAuth integration exists yet (platform/M5 scope).
  // Until then M1 reads public repositories; GITHUB_TOKEN only raises API rate limits.
  mode: 'public';
  tokenConfigured: boolean;
  webhooks: 'not-configured';
}

/**
 * Read-only access to GitHub repositories. Branch heads and commit SHAs come from
 * `git ls-remote` (no API rate limit); repository listing uses the REST API.
 * Credentials stay on the server and are never returned to clients.
 */
@Injectable()
export class GitHubService {
  status(): GitHubIntegrationStatus {
    return { mode: 'public', tokenConfigured: Boolean(process.env.GITHUB_TOKEN), webhooks: 'not-configured' };
  }

  async listRepositories(owner: string): Promise<GitHubRepository[]> {
    if (!OWNER.test(owner)) throw new BadRequestException('owner must be a GitHub user or organization name.');
    const response = await fetch(`https://api.github.com/users/${owner}/repos?per_page=100&sort=updated&type=owner`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ChainOps',
        ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
      },
      signal: AbortSignal.timeout(15000),
    }).catch(() => { throw new BadGatewayException('GitHub could not be reached.'); });
    if (response.status === 404) throw new NotFoundException(`GitHub account "${owner}" was not found.`);
    if (response.status === 403 || response.status === 429) throw new BadGatewayException('GitHub API rate limit reached. Try again later or configure GITHUB_TOKEN on the server.');
    if (!response.ok) throw new BadGatewayException(`GitHub returned ${response.status}.`);
    const repos = (await response.json()) as { full_name: string; name: string; default_branch: string; description: string | null; updated_at: string; private: boolean; archived: boolean }[];
    return repos
      .filter((repo) => !repo.private && !repo.archived)
      .map((repo) => ({ fullName: repo.full_name, name: repo.name, defaultBranch: repo.default_branch, description: repo.description, updatedAt: repo.updated_at }));
  }

  async listBranches(repository: string): Promise<GitHubBranch[]> {
    if (!REPOSITORY.test(repository)) throw new BadRequestException('repository must be a GitHub "owner/repo" name.');
    const output = await this.lsRemote(repository, ['--heads']);
    return output
      .map((line) => line.split('\t'))
      .filter(([sha, ref]) => /^[0-9a-f]{40}$/.test(sha) && ref?.startsWith('refs/heads/'))
      .map(([sha, ref]) => ({ name: ref.slice('refs/heads/'.length), commitSha: sha }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Resolves a branch to the exact commit it points at right now.
  async resolveBranch(repository: string, branch: string): Promise<string> {
    const match = (await this.listBranches(repository)).find((item) => item.name === branch);
    if (!match) throw new BadRequestException(`Branch "${branch}" was not found in ${repository}.`);
    return match.commitSha;
  }

  private async lsRemote(repository: string, args: string[]): Promise<string[]> {
    try {
      const { stdout } = await run('git', ['ls-remote', ...args, `https://github.com/${repository}.git`], {
        timeout: 20000,
        maxBuffer: 8 * 1024 * 1024,
        // Never prompt for credentials: a private or missing repository fails fast.
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo' },
      });
      return stdout.split('\n').filter(Boolean);
    } catch (error) {
      const stderr = String((error as { stderr?: string }).stderr ?? '');
      if (/not found|could not read Username|Authentication failed/i.test(stderr)) {
        throw new NotFoundException(`Repository ${repository} was not found or is not public.`);
      }
      throw new BadGatewayException('GitHub could not be reached.');
    }
  }
}
