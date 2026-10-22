import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { parseArtifact } from './create-artifact.js';

interface ArtifactRow {
  id: string;
  project_id: string;
  name: string;
  version: string;
  framework: string;
  contract_path: string;
  compiler_version: string;
  created_at: Date;
  updated_at: Date;
}

function serialize(row: ArtifactRow) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    version: row.version,
    framework: row.framework,
    contractPath: row.contract_path,
    compilerVersion: row.compiler_version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

@Injectable()
export class ContractsService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  private async authorize(projectId: string, userId: string) {
    const { rows } = await this.db.query<{ member: boolean }>(
      `select exists (select 1 from organization_members m
         where m.organization_id=p.organization_id and m.user_id=$2) as member
       from projects p where p.id=$1`,
      [projectId, userId],
    );
    if (!rows[0]) throw new NotFoundException('Project not found');
    if (!rows[0].member)
      throw new ForbiddenException('Project organization membership required');
  }

  async create(projectId: string, userId: string, body: unknown) {
    await this.authorize(projectId, userId);
    const input = parseArtifact(body);
    try {
      // Recheck membership in the write statement, including concurrent revocation.
      const { rows } = await this.db.query<ArtifactRow>(
        `insert into contract_artifacts(project_id,name,version,framework,contract_path,compiler_version)
         select p.id,$3,$4,$5,$6,$7 from projects p
         join organization_members m on m.organization_id=p.organization_id and m.user_id=$2
         where p.id=$1 returning *`,
        [
          projectId,
          userId,
          input.name,
          input.version,
          input.framework,
          input.contractPath,
          input.compilerVersion,
        ],
      );
      if (!rows[0])
        throw new ForbiddenException(
          'Project organization membership required',
        );
      return serialize(rows[0]);
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string };
      if (
        pgError.code === '23505' &&
        pgError.constraint === 'contract_artifacts_project_name_version_key'
      ) {
        throw new ConflictException(
          'Artifact name and version already registered in this project',
        );
      }
      throw error;
    }
  }

  async list(projectId: string, userId: string) {
    await this.authorize(projectId, userId);
    const { rows } = await this.db.query<ArtifactRow>(
      `select a.* from contract_artifacts a join projects p on p.id=a.project_id
       join organization_members m on m.organization_id=p.organization_id and m.user_id=$2
       where a.project_id=$1 order by a.created_at asc,a.id asc`,
      [projectId, userId],
    );
    return rows.map(serialize);
  }

  async get(projectId: string, userId: string, contractId: string) {
    await this.authorize(projectId, userId);
    const { rows } = await this.db.query<ArtifactRow>(
      `select a.* from contract_artifacts a join projects p on p.id=a.project_id
       join organization_members m on m.organization_id=p.organization_id and m.user_id=$2
       where a.project_id=$1 and a.id=$3`,
      [projectId, userId, contractId],
    );
    if (!rows[0])
      throw new NotFoundException('Artifact not found in this project');
    return serialize(rows[0]);
  }
}
