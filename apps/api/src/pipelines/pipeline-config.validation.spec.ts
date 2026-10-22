import { BadRequestException } from '@nestjs/common';
import { parseCreate, parsePatch } from './pipeline-config.validation.js';

const valid = { name: 'Smart Contract CI', repository: 'intelli-collective/vault-contracts', branch: 'main', framework: 'hardhat', stages: ['compile', 'test', 'security'] };

describe('pipeline configuration validation', () => {
  it('accepts the documented create payload and trims strings', () => {
    expect(parseCreate({ ...valid, name: '  Smart Contract CI  ' })).toEqual(valid);
  });

  it('leaves framework undefined when omitted so the project framework applies', () => {
    const { framework, ...rest } = valid;
    expect(framework).toBe('hardhat');
    expect(parseCreate(rest).framework).toBeUndefined();
  });

  it.each([
    ['a non-object body', null],
    ['an array body', [valid]],
    ['an unknown field', { ...valid, userId: 'someone-else' }],
    ['an empty name', { ...valid, name: '   ' }],
    ['a repository URL', { ...valid, repository: 'https://github.com/intelli-collective/vault-contracts' }],
    ['a repository without owner', { ...valid, repository: 'vault-contracts' }],
    ['a repository ending in .git', { ...valid, repository: 'intelli-collective/vault-contracts.git' }],
    ['an empty branch', { ...valid, branch: '' }],
    ['a branch with spaces', { ...valid, branch: 'feature branch' }],
    ['a branch with ..', { ...valid, branch: 'feat/../main' }],
    ['a shell-like branch', { ...valid, branch: 'main;rm -rf /' }],
    ['an unsupported framework', { ...valid, framework: 'truffle' }],
    ['an unknown stage', { ...valid, stages: ['compile', 'deploy-mainnet'] }],
    ['an empty stage list', { ...valid, stages: [] }],
    ['duplicate stages', { ...valid, stages: ['test', 'test'] }],
    ['a missing repository', { name: valid.name, branch: valid.branch, stages: valid.stages }],
  ])('rejects %s', (_label, body) => {
    expect(() => parseCreate(body)).toThrow(BadRequestException);
  });

  it('accepts a partial patch with only allowed fields', () => {
    expect(parsePatch({ branch: 'release/v1.2', stages: ['checkout', 'build', 'test', 'slither', 'policy'] })).toEqual({ branch: 'release/v1.2', stages: ['checkout', 'build', 'test', 'slither', 'policy'] });
  });

  it('rejects an empty patch, null values and unknown fields', () => {
    expect(() => parsePatch({})).toThrow(BadRequestException);
    expect(() => parsePatch({ name: null })).toThrow(BadRequestException);
    expect(() => parsePatch({ projectId: 'x' })).toThrow(BadRequestException);
  });
});
