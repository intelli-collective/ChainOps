import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { DatabaseService } from '../database/database.service.js';
import { requireProject } from './access.js';
import { decryptSecret, encryptSecret } from './secrets.js';
import { body, oneOf, optionalText, text } from './validation.js';

const NETWORKS = ['hardhat-local', 'sepolia', 'holesky', 'ethereum-mainnet', 'custom'] as const;
type Network = (typeof NETWORKS)[number];
// Known chain ids; `custom` accepts any.
const CHAIN_IDS: Partial<Record<Network, number>> = { 'hardhat-local': 31337, sepolia: 11155111, holesky: 17000, 'ethereum-mainnet': 1 };
const KEY = /^[A-Z_][A-Z0-9_]{0,127}$/;
const MASK = '••••••••';

interface EnvironmentRow {
  id: string; name: string; description: string | null; network: Network; chain_id: string; rpc_url_encrypted: string; rpc_url_masked: string;
  last_check_at: Date | null; last_check_ok: boolean | null; last_check_message: string | null; created_at: Date; updated_at: Date;
}
interface VariableRow {
  id: string; key: string; environment_id: string | null; environment_name: string | null; value_encrypted: string; is_secret: boolean;
  updated_at: Date; updated_by_name: string | null;
}

/** Shows scheme, host and a short API version segment; anything that may hold a key is masked. */
export function maskRpcUrl(raw: string): string {
  const url = new URL(raw);
  const segments = url.pathname.split('/').filter(Boolean);
  const kept = segments.length && /^(v\d+|rpc|api)$/i.test(segments[0]) ? `/${segments[0]}` : '';
  const hidden = segments.length > (kept ? 1 : 0) || url.search ? `/${MASK}` : '';
  return `${url.protocol}//${url.host}${kept}${hidden}`;
}

function parseRpcUrl(value: unknown, network: Network): string {
  if (typeof value !== 'string' || value.length > 500) throw new BadRequestException('rpcUrl must be a URL of at most 500 characters.');
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new BadRequestException('rpcUrl must be a valid URL.'); }
  if (url.username || url.password) throw new BadRequestException('Put credentials in an environment variable, not in the RPC URL user info.');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && network === 'hardhat-local')) throw new BadRequestException('rpcUrl must use https (http is allowed only for the local Hardhat network).');
  return url.toString();
}

function isPrivateAddress(address: string): boolean {
  if (address.includes(':')) return address === '::1' || /^f[cd]/i.test(address) || /^fe80/i.test(address) || address.startsWith('::ffff:127.') || address === '::';
  const [a, b] = address.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

@Injectable()
export class EnvironmentsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  private present(row: EnvironmentRow) {
    return {
      id: row.id, name: row.name, description: row.description, network: row.network, chainId: Number(row.chain_id),
      rpcUrlMasked: row.rpc_url_masked,
      lastCheck: row.last_check_at ? { at: row.last_check_at.toISOString(), ok: row.last_check_ok, message: row.last_check_message } : null,
      createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
    };
  }

  async list(userId: string, projectId: string) {
    const access = await requireProject(this.db, projectId, userId, 'read');
    const { rows } = await this.db.query<EnvironmentRow>('select * from environments where project_id = $1 order by created_at', [projectId]);
    return { canManage: access.canManage, environments: rows.map((row) => this.present(row)) };
  }

  async create(userId: string, projectId: string, input: unknown) {
    await requireProject(this.db, projectId, userId, 'manage');
    const b = body(input, ['name', 'description', 'network', 'chainId', 'rpcUrl']);
    const network = oneOf(b.network, NETWORKS, 'network');
    const chainId = this.chainId(b.chainId, network);
    const rpcUrl = parseRpcUrl(b.rpcUrl, network);
    try {
      const { rows } = await this.db.query<EnvironmentRow>(
        `insert into environments (project_id, name, description, network, chain_id, rpc_url_encrypted, rpc_url_masked, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
        [projectId, text(b.name, 'name', 80), optionalText(b.description, 'description', 300) ?? null, network, chainId, encryptSecret(rpcUrl), maskRpcUrl(rpcUrl), userId]);
      return this.present(rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('An environment with that name already exists.');
      throw error;
    }
  }

  private chainId(value: unknown, network: Network): number {
    const id = typeof value === 'number' ? value : Number.NaN;
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestException('chainId must be a positive integer.');
    const expected = CHAIN_IDS[network];
    if (expected !== undefined && expected !== id) throw new BadRequestException(`${network} uses chain id ${expected}.`);
    return id;
  }

  private async row(projectId: string, environmentId: string): Promise<EnvironmentRow> {
    const { rows } = await this.db.query<EnvironmentRow>('select * from environments where project_id = $1 and id = $2', [projectId, environmentId]);
    if (!rows[0]) throw new NotFoundException('Environment not found');
    return rows[0];
  }

  async update(userId: string, projectId: string, environmentId: string, input: unknown) {
    await requireProject(this.db, projectId, userId, 'manage');
    const current = await this.row(projectId, environmentId);
    const b = body(input, ['name', 'description', 'network', 'chainId', 'rpcUrl']);
    const network = b.network === undefined ? current.network : oneOf(b.network, NETWORKS, 'network');
    const chainId = b.chainId === undefined ? Number(current.chain_id) : this.chainId(b.chainId, network);
    if (b.chainId === undefined && b.network !== undefined) this.chainId(chainId, network);
    const sets = ['network = $3', 'chain_id = $4'];
    const values: unknown[] = [projectId, environmentId, network, chainId];
    const set = (column: string, value: unknown) => { values.push(value); sets.push(`${column} = $${values.length}`); };
    if (b.name !== undefined) set('name', text(b.name, 'name', 80));
    if (b.description !== undefined) set('description', optionalText(b.description, 'description', 300));
    if (b.rpcUrl !== undefined) {
      const rpcUrl = parseRpcUrl(b.rpcUrl, network);
      set('rpc_url_encrypted', encryptSecret(rpcUrl));
      set('rpc_url_masked', maskRpcUrl(rpcUrl));
      sets.push('last_check_at = null', 'last_check_ok = null', 'last_check_message = null');
    }
    try {
      const { rows } = await this.db.query<EnvironmentRow>(`update environments set ${sets.join(', ')} where project_id = $1 and id = $2 returning *`, values);
      return this.present(rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException('An environment with that name already exists.');
      throw error;
    }
  }

  async remove(userId: string, projectId: string, environmentId: string) {
    await requireProject(this.db, projectId, userId, 'manage');
    const { rowCount } = await this.db.query('delete from environments where project_id = $1 and id = $2', [projectId, environmentId]);
    if (!rowCount) throw new NotFoundException('Environment not found');
    return { ok: true };
  }

  /** Calls eth_chainId on the stored RPC endpoint and records whether it matches. */
  async check(userId: string, projectId: string, environmentId: string) {
    await requireProject(this.db, projectId, userId, 'manage');
    const env = await this.row(projectId, environmentId);
    const url = new URL(decryptSecret(env.rpc_url_encrypted));
    let ok = false;
    let message: string;
    try {
      if (env.network !== 'hardhat-local') {
        // Only the local network may point at private addresses (prevents probing internal services).
        const host = url.hostname.replace(/^\[|\]$/g, '');
        const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
        if (addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error('RPC host resolves to a private address');
      }
      const response = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'error',
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }), signal: AbortSignal.timeout(8000),
      });
      const result = ((await response.json()) as { result?: string }).result;
      const remote = typeof result === 'string' ? Number.parseInt(result, 16) : Number.NaN;
      ok = remote === Number(env.chain_id);
      message = Number.isNaN(remote) ? `Unexpected response (HTTP ${response.status}).` : ok ? `Connected · chain id ${remote}` : `Chain id mismatch: endpoint reports ${remote}, expected ${env.chain_id}.`;
    } catch (error) {
      message = `Connection failed: ${(error as Error).message.slice(0, 200)}`;
    }
    const { rows } = await this.db.query<EnvironmentRow>(
      'update environments set last_check_at = now(), last_check_ok = $3, last_check_message = $4 where project_id = $1 and id = $2 returning *',
      [projectId, environmentId, ok, message]);
    return this.present(rows[0]);
  }

  // ---- Environment variables ----

  async variables(userId: string, projectId: string) {
    const access = await requireProject(this.db, projectId, userId, 'read');
    const { rows } = await this.db.query<VariableRow>(
      `select v.id, v.key, v.environment_id, e.name as environment_name, v.value_encrypted, v.is_secret, v.updated_at, u.full_name as updated_by_name
         from environment_variables v left join environments e on e.id = v.environment_id left join users u on u.id = v.updated_by
        where v.project_id = $1 order by v.key, e.name nulls first`, [projectId]);
    return {
      canManage: access.canManage,
      variables: rows.map((row) => ({
        id: row.id, key: row.key, environmentId: row.environment_id, environmentName: row.environment_name, isSecret: row.is_secret,
        // Secret values are write-only: never returned after they are stored.
        value: row.is_secret ? null : decryptSecret(row.value_encrypted), maskedValue: MASK,
        updatedAt: row.updated_at.toISOString(), updatedBy: row.updated_by_name,
      })),
    };
  }

  private value(raw: unknown): string {
    if (typeof raw !== 'string' || raw.length === 0 || raw.length > 4096) throw new BadRequestException('value must be 1–4096 characters.');
    return raw;
  }

  async createVariable(userId: string, projectId: string, input: unknown) {
    await requireProject(this.db, projectId, userId, 'manage');
    const b = body(input, ['key', 'value', 'isSecret', 'environmentId']);
    if (typeof b.key !== 'string' || !KEY.test(b.key)) throw new BadRequestException('key must be UPPER_SNAKE_CASE (letters, digits, underscores).');
    if (b.isSecret !== undefined && typeof b.isSecret !== 'boolean') throw new BadRequestException('isSecret must be a boolean.');
    if (b.environmentId !== undefined && b.environmentId !== null && (typeof b.environmentId !== 'string' || !/^[0-9a-f-]{36}$/i.test(b.environmentId))) {
      throw new BadRequestException('environmentId must be an environment id or null (project-wide).');
    }
    const environmentId = typeof b.environmentId === 'string' ? b.environmentId : null;
    if (environmentId) await this.row(projectId, environmentId);
    try {
      const { rows } = await this.db.query<{ id: string }>(
        `insert into environment_variables (project_id, environment_id, key, value_encrypted, is_secret, created_by, updated_by)
         values ($1, $2, $3, $4, $5, $6, $6) returning id`,
        [projectId, environmentId, b.key, encryptSecret(this.value(b.value)), b.isSecret ?? true, userId]);
      return (await this.variables(userId, projectId)).variables.find((v) => v.id === rows[0].id);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') throw new ConflictException(`${b.key} already exists in that scope.`);
      throw error;
    }
  }

  async updateVariable(userId: string, projectId: string, variableId: string, input: unknown) {
    await requireProject(this.db, projectId, userId, 'manage');
    const b = body(input, ['value', 'isSecret']);
    const { rows } = await this.db.query<{ is_secret: boolean }>('select is_secret from environment_variables where project_id = $1 and id = $2', [projectId, variableId]);
    if (!rows[0]) throw new NotFoundException('Variable not found');
    if (b.isSecret !== undefined && typeof b.isSecret !== 'boolean') throw new BadRequestException('isSecret must be a boolean.');
    // A secret can only become visible together with a new value; the old one is never revealed.
    if (rows[0].is_secret && b.isSecret === false && b.value === undefined) throw new BadRequestException('Provide a new value to make a secret visible.');
    const sets = ['updated_by = $3'];
    const values: unknown[] = [projectId, variableId, userId];
    if (b.value !== undefined) { values.push(encryptSecret(this.value(b.value))); sets.push(`value_encrypted = $${values.length}`); }
    if (b.isSecret !== undefined) { values.push(b.isSecret); sets.push(`is_secret = $${values.length}`); }
    if (sets.length === 1) throw new BadRequestException('Provide value or isSecret.');
    await this.db.query(`update environment_variables set ${sets.join(', ')} where project_id = $1 and id = $2`, values);
    return (await this.variables(userId, projectId)).variables.find((v) => v.id === variableId);
  }

  async removeVariable(userId: string, projectId: string, variableId: string) {
    await requireProject(this.db, projectId, userId, 'manage');
    const { rowCount } = await this.db.query('delete from environment_variables where project_id = $1 and id = $2', [projectId, variableId]);
    if (!rowCount) throw new NotFoundException('Variable not found');
    return { ok: true };
  }
}
