import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { ReleaseIntegration } from './release.integration.js';
import {
  parseDeploymentDraft,
  parseRegistration,
} from './release.validation.js';

export function isUUID(value: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new BadRequestException('Invalid resource ID');
}
interface RegistryRow {
  id: string;
  project_id: string;
  name: string;
  version: string;
  address: string;
  network_id: string;
  chain_id: string;
  network_name: string;
  environment: string;
  provenance: string;
  deployment_id: string | null;
  created_at: Date;
  evidence?: Record<string, unknown>;
}
@Injectable()
export class ReleaseService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ReleaseIntegration)
    private readonly integration: ReleaseIntegration,
  ) {}
  artifacts(projectId: string) {
    return this.integration.artifacts(projectId);
  }
  networks(projectId: string) {
    return this.integration.networks(projectId);
  }
  async preflight(projectId: string, body: unknown) {
    parseDeploymentDraft(body);
    await this.integration.artifacts(projectId);
    // Fail closed until authoritative artifact, policy and signer adapters exist.
    // A stored artifact definition or PENDING approval request is not authorization.
    return {
      eligible: false,
      reason:
        'Validated artifact publication, approval evidence, and a signing adapter are not connected.',
      checks: [
        { label: 'Validated artifact publication connected', passed: false },
        { label: 'Approved policy evidence connected', passed: false },
        { label: 'Deployment signer configured', passed: false },
      ],
    };
  }
  async submit(projectId: string, body: unknown, key: string | undefined) {
    if (!key || !/^[a-zA-Z0-9-]{16,120}$/.test(key))
      throw new BadRequestException('A valid Idempotency-Key is required');
    const result = await this.preflight(projectId, body);
    throw new ConflictException(result.reason);
  }
  async deployments(projectId: string, userId: string, id?: string) {
    if (id) isUUID(id);
    const { rows } = await this.db.query<{
      id: string;
      status: string;
      evidence: Record<string, unknown>;
      transaction_hash: string | null;
    }>(
      `select d.id,d.status,d.evidence,d.transaction_hash from deployment_records d
       join projects p on p.id=d.project_id join organization_members m on m.organization_id=p.organization_id and m.user_id=$2
       where d.project_id=$1 ${id ? 'and d.id=$3' : ''} order by d.created_at desc,d.id desc`,
      id ? [projectId, userId, id] : [projectId, userId],
    );
    const records = rows.map((r) => ({
      ...r.evidence,
      id: r.id,
      projectId,
      status: r.status,
      ...(r.transaction_hash ? { transactionHash: r.transaction_hash } : {}),
    }));
    if (id && !records[0])
      throw new NotFoundException('Deployment not found in this project');
    return id ? records[0] : records;
  }
  async reconcile(projectId: string, userId: string, id: string) {
    await this.deployments(projectId, userId, id);
    // Do not turn an unavailable provider into a failed transaction.
    throw new ConflictException(
      'RPC reconciliation is not connected. The recorded transaction outcome has not changed.',
    );
  }
  private serialize(row: RegistryRow) {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      version: row.version,
      address: row.address,
      network: {
        id: row.network_id,
        name: row.network_name,
        chainId: Number(row.chain_id),
        environment: row.environment,
        rpcLabel: 'Configured RPC',
        connected: false,
        signingAvailable: false,
      },
      provenance: row.provenance,
      status: row.provenance === 'external' ? 'Registered' : 'Active',
      monitoring: 'Not enabled',
      createdAt: row.created_at.toISOString(),
      ...(row.deployment_id
        ? {
            deploymentId: row.deployment_id,
            artifact: row.evidence?.artifact,
            transactionHash: row.evidence?.transactionHash,
          }
        : {}),
    };
  }
  async registry(projectId: string, userId: string, id?: string) {
    if (id) isUUID(id);
    const { rows } = await this.db.query<RegistryRow>(
      `select r.*,d.evidence from registered_contracts r
       join projects p on p.id=r.project_id join organization_members m on m.organization_id=p.organization_id and m.user_id=$2
       left join deployment_records d on d.project_id=r.project_id and d.id=r.deployment_id
       where r.project_id=$1 ${id ? 'and r.id=$3' : ''} order by r.created_at desc,r.id desc`,
      id ? [projectId, userId, id] : [projectId, userId],
    );
    if (id && !rows[0])
      throw new NotFoundException('Contract not found in this project');
    return id
      ? this.serialize(rows[0])
      : rows.map((row) => this.serialize(row));
  }
  async register(projectId: string, userId: string, body: unknown) {
    const input = parseRegistration(body);
    const network = (await this.integration.networks(projectId)).find(
      (n) => n.id === input.networkId,
    );
    if (!network)
      throw new BadRequestException('Select a configured project network');
    try {
      const { rows } = await this.db.query<RegistryRow>(
        `insert into registered_contracts(project_id,name,version,address,network_id,chain_id,network_name,environment,provenance)
         select p.id,$3,$4,$5,$6,$7,$8,$9,'external' from projects p
         join organization_members m on m.organization_id=p.organization_id and m.user_id=$2 where p.id=$1 returning *`,
        [
          projectId,
          userId,
          input.name,
          input.version,
          input.address,
          network.id,
          network.chainId,
          network.name,
          network.environment,
        ],
      );
      if (!rows[0]) throw new ForbiddenException('Project membership required');
      return this.serialize(rows[0]);
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw new ConflictException(
          'This address is already registered on that network',
        );
      throw error;
    }
  }
}
