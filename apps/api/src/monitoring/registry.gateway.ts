import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Interface, type InterfaceAbi } from 'ethers';
import { DatabaseService } from '../database/database.service.js';
import { uuid } from './monitoring.validation.js';

export interface RegistryContract {
  id: string;
  projectId: string;
  name: string;
  version: string;
  network: 'sepolia';
  address: string;
  abi: InterfaceAbi;
  release?: { commitSha?: string; pipelineRunId?: string; artifactId?: string };
}

/** Consumer of M2's deployed registry. Never creates or imports registry records. */
@Injectable()
export class RegistryGateway {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async list(projectId: string): Promise<{
    available: boolean;
    message: string | null;
    contracts: RegistryContract[];
  }> {
    const base = process.env.MONITORING_REGISTRY_API_URL;
    if (!base) {
      const { rows } = await this.db.query<{ count: string }>(
        'select count(*)::text as count from contract_artifacts where project_id=$1',
        [projectId],
      );
      return {
        available: false,
        contracts: [],
        message: `The M2 backend currently has ${rows[0].count} artifact record(s) for this project. Deployed addresses and ABIs are not available yet.`,
      };
    }
    try {
      const url = new URL(base);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error();
      const response = await fetch(
        `${base.replace(/\/$/, '')}/projects/${encodeURIComponent(projectId)}/contracts`,
        {
          headers: process.env.MONITORING_REGISTRY_API_TOKEN
            ? {
                Authorization: `Bearer ${process.env.MONITORING_REGISTRY_API_TOKEN}`,
              }
            : {},
          signal: AbortSignal.timeout(10000),
          redirect: 'error',
        },
      );
      if (!response.ok) throw new Error();
      const text = await response.text();
      if (text.length > 2_000_000) throw new Error();
      const data: unknown = JSON.parse(text);
      if (!Array.isArray(data) || data.length > 1000) throw new Error();
      const contracts = data.map((item: unknown): RegistryContract => {
        const c = item as Partial<RegistryContract>;
        if (
          c.projectId !== projectId ||
          c.network !== 'sepolia' ||
          typeof c.address !== 'string' ||
          !/^0x[0-9a-f]{40}$/i.test(c.address) ||
          typeof c.name !== 'string' ||
          !c.name.trim() ||
          c.name.length > 120 ||
          typeof c.version !== 'string' ||
          c.version.length > 80 ||
          !Array.isArray(c.abi)
        )
          throw new Error();
        const id = uuid(c.id);
        new Interface(c.abi);
        const release: RegistryContract['release'] = c.release
          ? {
              ...(c.release.commitSha
                ? { commitSha: c.release.commitSha }
                : {}),
              ...(c.release.pipelineRunId
                ? { pipelineRunId: uuid(c.release.pipelineRunId) }
                : {}),
              ...(c.release.artifactId
                ? { artifactId: uuid(c.release.artifactId) }
                : {}),
            }
          : undefined;
        if (release?.commitSha && !/^[0-9a-f]{7,40}$/i.test(release.commitSha))
          throw new Error();
        return {
          id,
          projectId,
          name: c.name,
          version: c.version,
          network: c.network,
          address: c.address.toLowerCase(),
          abi: c.abi,
          ...(release ? { release } : {}),
        };
      });
      return { available: true, message: null, contracts };
    } catch {
      throw new ServiceUnavailableException(
        'The deployed Contract Registry is unavailable or its response lacks valid project-scoped address/ABI metadata',
      );
    }
  }

  async get(projectId: string, contractId: string): Promise<RegistryContract> {
    const result = await this.list(projectId);
    const contract = result.contracts.find((c) => c.id === contractId);
    if (!contract)
      throw new ServiceUnavailableException(
        'Deployed contract address and ABI are not available from M2',
      );
    return contract;
  }
}
