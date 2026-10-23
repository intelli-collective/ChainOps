import { spawn } from 'node:child_process';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { Readable } from 'node:stream';
import type { PipelineFramework } from './pipeline-config.validation.js';

const MAX_SOURCE_BYTES = 200 * 1024 * 1024;
const MAX_ARTIFACT_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ARTIFACTS = 200;

export const IMAGES: Record<PipelineFramework, string> = {
  hardhat: process.env.PIPELINE_NODE_IMAGE ?? 'node:22-bookworm-slim',
  other: process.env.PIPELINE_NODE_IMAGE ?? 'node:22-bookworm-slim',
  foundry: process.env.PIPELINE_FOUNDRY_IMAGE ?? 'ghcr.io/foundry-rs/foundry:stable',
};

export class InfrastructureError extends Error {}

/** Downloads the exact commit as a tarball and extracts it into the workspace. */
export async function downloadSource(repository: string, commitSha: string, workspace: string): Promise<void> {
  const response = await fetch(`https://codeload.github.com/${repository}/tar.gz/${commitSha}`, { signal: AbortSignal.timeout(120000) })
    .catch((error: unknown) => { throw new InfrastructureError(`Could not download the source: ${String(error)}`); });
  if (!response.ok || !response.body) throw new InfrastructureError(`GitHub returned ${response.status} for ${repository}@${commitSha}.`);
  await new Promise<void>((resolve, reject) => {
    // --strip-components drops the "<repo>-<sha>/" prefix; GNU tar refuses paths with "..".
    const tar = spawn('tar', ['-xz', '-C', workspace, '--strip-components=1', '--no-same-owner'], { stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';
    let received = 0;
    tar.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    tar.on('error', (error) => reject(new InfrastructureError(`tar failed: ${error.message}`)));
    tar.on('close', (code) => (code === 0 ? resolve() : reject(new InfrastructureError(`Could not extract the source: ${stderr.trim() || `tar exited ${code}`}`))));
    const body = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
    body.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > MAX_SOURCE_BYTES) {
        body.destroy();
        tar.kill();
        reject(new InfrastructureError('The repository archive is larger than 200 MB.'));
      }
    });
    body.on('error', (error) => reject(new InfrastructureError(`Download interrupted: ${error.message}`)));
    body.pipe(tar.stdin);
  });
}

/** Dependency install step for Node-based projects, chosen from the lockfile present. */
export async function installCommand(framework: PipelineFramework, workspace: string): Promise<string | null> {
  if (framework === 'foundry') return null;
  const files = new Set(await readdir(workspace));
  if (files.has('package-lock.json')) return 'npm ci --no-audit --no-fund';
  if (files.has('yarn.lock')) return 'npx --yes yarn@1 install --frozen-lockfile --non-interactive';
  if (files.has('pnpm-lock.yaml')) return 'npx --yes pnpm@9 install --frozen-lockfile';
  if (files.has('package.json')) return 'npm install --no-audit --no-fund';
  return null;
}

export interface ContainerResult {
  exitCode: number;
  killedFor: 'cancel' | 'timeout' | null;
}

export interface ContainerOptions {
  name: string;
  image: string;
  workspace: string;
  script: string;
  timeoutMs: number;
  onOutput: (text: string) => void;
  // Polled while the container runs; returning true stops it.
  shouldCancel: () => Promise<boolean>;
}

/**
 * Runs one stage in a throwaway container. Only the run workspace is mounted; the
 * container has no capabilities, cannot gain privileges, and is CPU/memory/pid
 * limited. The command runs inside the container's shell, never on the host.
 */
export function runContainer(options: ContainerOptions): Promise<ContainerResult> {
  const uid = process.getuid?.() ?? 1000;
  const gid = process.getgid?.() ?? 1000;
  const args = [
    'run', '--rm', '--name', options.name,
    '--memory', process.env.PIPELINE_MEMORY ?? '2g', '--cpus', process.env.PIPELINE_CPUS ?? '2', '--pids-limit', '512',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--user', `${uid}:${gid}`,
    '-e', 'HOME=/tmp', '-e', 'CI=true', '-e', 'npm_config_cache=/tmp/.npm', '-e', 'npm_config_update_notifier=false', '-e', 'FORCE_COLOR=0',
    '-v', `${options.workspace}:/workspace`, '-w', '/workspace',
    '--entrypoint', 'sh',
    options.image, '-c', options.script,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let killedFor: ContainerResult['killedFor'] = null;
    const stop = (reason: 'cancel' | 'timeout') => {
      if (killedFor) return;
      killedFor = reason;
      spawn('docker', ['kill', options.name], { stdio: 'ignore' }).on('error', () => undefined);
    };
    const timer = setTimeout(() => stop('timeout'), options.timeoutMs);
    const poll = setInterval(() => {
      options.shouldCancel().then((cancel) => cancel && stop('cancel'), () => undefined);
    }, 2000);
    child.stdout.on('data', (chunk: Buffer) => options.onOutput(chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => options.onOutput(chunk.toString()));
    child.on('error', (error) => {
      clearTimeout(timer); clearInterval(poll);
      reject(new InfrastructureError(`Docker is not available on the worker: ${error.message}`));
    });
    child.on('close', (code) => {
      clearTimeout(timer); clearInterval(poll);
      resolve({ exitCode: code ?? 1, killedFor });
    });
  });
}

export interface CollectedArtifact {
  contractName: string;
  sourcePath: string;
  artifactPath: string;
  abi: unknown[];
  bytecode: string;
  deployedBytecode: string;
  compilerVersion: string | null;
  metadata: Record<string, unknown>;
}

// Regular files only (no symlinks), inside the workspace, below the size cap.
async function safeJsonFiles(root: string, workspace: string, skipDirs: Set<string>): Promise<string[]> {
  const found: string[] = [];
  async function walk(dir: string) {
    let entries: import('node:fs').Dirent[];
    try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { if (!skipDirs.has(entry.name)) await walk(path); continue; }
      if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name.endsWith('.dbg.json')) continue;
      if (relative(workspace, path).startsWith('..')) continue;
      const stat = await lstat(path);
      if (stat.isFile() && stat.size <= MAX_ARTIFACT_FILE_BYTES) found.push(path);
    }
  }
  await walk(root);
  return found.sort();
}

const isLibrary = (source: string) => source.startsWith('@') || source.startsWith('hardhat/') || source.includes('node_modules') || source.startsWith('lib/');

async function json(path: string): Promise<Record<string, unknown> | null> {
  try { return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>; } catch { return null; }
}

/** Reads compiled contract artifacts (ABI, bytecode, compiler metadata) produced by the build. */
export async function collectArtifacts(framework: PipelineFramework, workspace: string): Promise<CollectedArtifact[]> {
  const results: CollectedArtifact[] = [];
  if (framework === 'foundry') {
    for (const path of await safeJsonFiles(join(workspace, 'out'), workspace, new Set(['build-info']))) {
      const data = await json(path);
      const meta = data?.metadata as { compiler?: { version?: string }; settings?: { compilationTarget?: Record<string, string>; optimizer?: unknown; evmVersion?: string } } | undefined;
      const target = Object.entries(meta?.settings?.compilationTarget ?? {})[0];
      const bytecode = (data?.bytecode as { object?: string } | undefined)?.object;
      if (!data || !Array.isArray(data.abi) || !target || typeof bytecode !== 'string' || isLibrary(target[0])) continue;
      results.push({
        contractName: target[1], sourcePath: target[0], artifactPath: relative(workspace, path).split(sep).join('/'),
        abi: data.abi, bytecode, deployedBytecode: (data.deployedBytecode as { object?: string } | undefined)?.object ?? '0x',
        compilerVersion: meta?.compiler?.version ?? null,
        metadata: { format: 'foundry', optimizer: meta?.settings?.optimizer ?? null, evmVersion: meta?.settings?.evmVersion ?? null },
      });
      if (results.length >= MAX_ARTIFACTS) break;
    }
    return results;
  }
  // Hardhat: artifacts/<sourceName>/<Contract>.json plus build-info/*.json for compiler details.
  const compilers = new Map<string, { solcVersion?: string; solcLongVersion?: string; id?: string; settings?: Record<string, unknown> }>();
  for (const path of await safeJsonFiles(join(workspace, 'artifacts', 'build-info'), workspace, new Set())) {
    const info = await json(path);
    const input = info?.input as { sources?: Record<string, unknown>; settings?: Record<string, unknown> } | undefined;
    for (const source of Object.keys(input?.sources ?? {})) {
      compilers.set(source, { solcVersion: info?.solcVersion as string, solcLongVersion: info?.solcLongVersion as string, id: info?.id as string, settings: input?.settings });
    }
  }
  for (const path of await safeJsonFiles(join(workspace, 'artifacts'), workspace, new Set(['build-info']))) {
    const data = await json(path);
    if (!data || data._format !== 'hh-sol-artifact-1' || typeof data.sourceName !== 'string' || isLibrary(data.sourceName)) continue;
    if (!Array.isArray(data.abi) || typeof data.bytecode !== 'string' || typeof data.contractName !== 'string') continue;
    const compiler = compilers.get(data.sourceName);
    results.push({
      contractName: data.contractName, sourcePath: data.sourceName, artifactPath: relative(workspace, path).split(sep).join('/'),
      abi: data.abi, bytecode: data.bytecode, deployedBytecode: typeof data.deployedBytecode === 'string' ? data.deployedBytecode : '0x',
      compilerVersion: compiler?.solcVersion ?? null,
      metadata: {
        format: 'hardhat', solcLongVersion: compiler?.solcLongVersion ?? null, buildInfoId: compiler?.id ?? null,
        optimizer: compiler?.settings?.optimizer ?? null, evmVersion: compiler?.settings?.evmVersion ?? null,
      },
    });
    if (results.length >= MAX_ARTIFACTS) break;
  }
  return results;
}
