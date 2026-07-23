/**
 * W-BIM-2-3 · Legacy artifact migration script.
 *
 * 目标：把 A 系统（156KB legacy 产物）迁移到 B 系统（NestJS file-artifact + object storage evidence）。
 *
 * 迁移策略：
 * 1. 影子迁移（dry-run）：只读，输出报告
 * 2. 双读期：新旧系统同时可读
 * 3. 切流：写入新系统
 * 4. 清理期：停用旧系统
 *
 * 用法：
 *   npx ts-node scripts/migrate-legacy-artifacts.ts --dry-run --source=<legacy-source>
 *
 * 待用户确认：
 * - legacy 数据源（数据库连接字符串 / CSV / S3 bucket / API endpoint）
 * - 租户/经销商映射规则
 * - 文件内容获取方式（本地路径 / base64 / 对象存储 key）
 */

import { createHash } from 'crypto';

interface LegacyArtifactRow {
  legacyId: string;
  tenantId: string;
  dealerId?: string | null;
  storeId?: string | null;
  customerId?: string | null;
  entityType: string; // e.g. 'design', 'contract', 'delivery'
  entityId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  contentBase64?: string;
  contentPath?: string;
  createdAt: string;
  updatedAt: string;
}

interface MigrationConfig {
  dryRun: boolean;
  source: string;
  batchSize: number;
  tenantMap?: Record<string, string>;
  storageProvider: string;
}

interface MigrationResult {
  processed: number;
  created: number;
  skipped: number;
  errors: Array<{ legacyId: string; error: string }>;
  evidenceRecords: number;
}

class LegacyArtifactMigrator {
  constructor(private readonly config: MigrationConfig) {}

  async run(): Promise<MigrationResult> {
    const result: MigrationResult = { processed: 0, created: 0, skipped: 0, errors: [], evidenceRecords: 0 };
    const rows = await this.fetchLegacyRows();
    for (const row of rows) {
      result.processed++;
      try {
        const shouldSkip = await this.alreadyMigrated(row.legacyId);
        if (shouldSkip) {
          result.skipped++;
          continue;
        }
        if (this.config.dryRun) {
          console.log(`[DRY-RUN] would migrate ${row.legacyId} -> ${row.entityType}/${row.entityId}`);
          result.created++;
          continue;
        }
        const artifactId = await this.createArtifact(row);
        await this.recordEvidence(row, artifactId);
        result.created++;
        result.evidenceRecords++;
      } catch (err: any) {
        result.errors.push({ legacyId: row.legacyId, error: err.message ?? String(err) });
      }
    }
    return result;
  }

  private async fetchLegacyRows(): Promise<LegacyArtifactRow[]> {
    // TODO: implement based on confirmed legacy source
    throw new Error(`Legacy source not configured: ${this.config.source}`);
  }

  private async alreadyMigrated(legacyId: string): Promise<boolean> {
    // TODO: query new system mapping table
    return false;
  }

  private async createArtifact(row: LegacyArtifactRow): Promise<string> {
    // TODO: call FileArtifactService or use repository
    // 1. decode/write content
    // 2. compute SHA-256
    // 3. insert FileArtifactEntity
    // 4. return new artifact id
    const content = await this.getContent(row);
    const hash = createHash('sha256').update(content).digest('hex');
    console.log(`[MIGRATE] ${row.legacyId} -> hash=${hash}`);
    return `artifact-${row.legacyId}`;
  }

  private async recordEvidence(row: LegacyArtifactRow, artifactId: string): Promise<void> {
    // TODO: call ObjectStorageEvidenceService.record with source hash = legacy hash
    console.log(`[EVIDENCE] ${artifactId} -> ${row.entityType}/${row.entityId}`);
  }

  private async getContent(row: LegacyArtifactRow): Promise<Buffer> {
    if (row.contentBase64) {
      return Buffer.from(row.contentBase64, 'base64');
    }
    if (row.contentPath) {
      // const fs = await import('fs');
      // return fs.promises.readFile(row.contentPath);
      throw new Error('contentPath not implemented yet');
    }
    throw new Error(`No content source for legacy artifact ${row.legacyId}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sourceArg = args.find((a) => a.startsWith('--source='));
  const source = sourceArg ? sourceArg.split('=')[1] : process.env.LEGACY_ARTIFACT_SOURCE;
  if (!source) {
    console.error('Usage: npx ts-node scripts/migrate-legacy-artifacts.ts --dry-run --source=<source>');
    process.exit(1);
  }

  const migrator = new LegacyArtifactMigrator({
    dryRun,
    source,
    batchSize: 100,
    storageProvider: process.env.STORAGE_PROVIDER ?? 'local',
  });

  const result = await migrator.run();
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { LegacyArtifactMigrator, MigrationConfig, MigrationResult, LegacyArtifactRow };
