import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectArtifacts, installCommand } from './pipeline-executor.js';

describe('pipeline executor helpers', () => {
  let workspace: string;
  beforeEach(async () => { workspace = await mkdtemp(join(tmpdir(), 'chainops-exec-spec-')); });
  afterEach(async () => { await rm(workspace, { recursive: true, force: true }); });

  it('chooses the dependency install from the lockfile present', async () => {
    expect(await installCommand('hardhat', workspace)).toBeNull();
    await writeFile(join(workspace, 'package.json'), '{}');
    expect(await installCommand('hardhat', workspace)).toBe('npm install --no-audit --no-fund');
    await writeFile(join(workspace, 'package-lock.json'), '{}');
    expect(await installCommand('hardhat', workspace)).toBe('npm ci --no-audit --no-fund');
    expect(await installCommand('foundry', workspace)).toBeNull();
  });

  it('captures Hardhat project artifacts with compiler metadata, skipping libraries, debug files and symlinks', async () => {
    const dir = join(workspace, 'artifacts', 'contracts', 'Vault.sol');
    await mkdir(dir, { recursive: true });
    await mkdir(join(workspace, 'artifacts', 'build-info'), { recursive: true });
    await mkdir(join(workspace, 'artifacts', '@openzeppelin', 'Ownable.sol'), { recursive: true });
    const artifact = (contractName: string, sourceName: string) => JSON.stringify({ _format: 'hh-sol-artifact-1', contractName, sourceName, abi: [{ type: 'constructor', inputs: [] }], bytecode: '0x6080', deployedBytecode: '0x60' });
    await writeFile(join(dir, 'Vault.json'), artifact('Vault', 'contracts/Vault.sol'));
    await writeFile(join(dir, 'Vault.dbg.json'), '{"_format":"hh-sol-dbg-1"}');
    await writeFile(join(workspace, 'artifacts', '@openzeppelin', 'Ownable.sol', 'Ownable.json'), artifact('Ownable', '@openzeppelin/contracts/access/Ownable.sol'));
    await writeFile(join(workspace, 'artifacts', 'build-info', 'abc.json'), JSON.stringify({ id: 'abc', solcVersion: '0.8.24', solcLongVersion: '0.8.24+commit.e11b9ed9', input: { sources: { 'contracts/Vault.sol': {} }, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' } } }));
    // A repository could plant a symlink to a host file; it must never be read.
    await symlink('/etc/hostname', join(dir, 'Leak.json'));

    const artifacts = await collectArtifacts('hardhat', workspace);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]).toMatchObject({
      contractName: 'Vault', sourcePath: 'contracts/Vault.sol', artifactPath: 'artifacts/contracts/Vault.sol/Vault.json',
      bytecode: '0x6080', compilerVersion: '0.8.24', metadata: { format: 'hardhat', buildInfoId: 'abc', evmVersion: 'paris', optimizer: { enabled: true, runs: 200 } },
    });
  });
});
