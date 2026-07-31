import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * 增长中枢 / Nexus Growth (D5 · 板块三对内底座) 数据实体。
 * 全部 tenant 绑定 + RLS（见 migration 009）。AI 产出默认 draft，非 approved 不可导出/发布。
 * 事实源：docs/BOARD-3-NEXUS-GROWTH-BLUEPRINT.md §3。
 */

// ── E1 舆情监测 · 条目 ──────────────────────────────────────────────────────
@Entity('growth_opinion_mention')
@Index(['tenantId', 'capturedAt'])
export class GrowthOpinionMentionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'varchar' }) source: string;                     // weibo/xiaohongshu/zhihu/douyin/dianping/news/ai-answer
  @Column({ type: 'text', nullable: true }) url: string | null;
  @Column({ name: 'author_hash', type: 'varchar', nullable: true }) authorHash: string | null; // PIPL 脱敏哈希
  @Column({ type: 'text' }) content: string;
  @Column({ type: 'varchar', default: 'neutral' }) sentiment: string; // positive/negative/neutral
  @Column({ type: 'varchar', default: 'general' }) intent: string;    // inquiry/complaint/compare/smear/general
  @Column({ type: 'varchar', default: 'P3' }) @Index() severity: string; // P0..P3
  @Column({ type: 'jsonb', default: [] }) entities: string[];         // 识别到的品牌/产品/门店实体
  @Column({ name: 'captured_at', type: 'timestamptz', default: () => 'now()' }) capturedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── E1 舆情监测 · 危机预警 ───────────────────────────────────────────────────
@Entity('growth_opinion_alert')
@Index(['tenantId', 'status'])
export class GrowthOpinionAlertEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'mention_ids', type: 'jsonb', default: [] }) mentionIds: string[];
  @Column({ type: 'varchar', default: 'P1' }) severity: string;
  @Column({ type: 'varchar', default: 'open' }) status: string;      // open/ack/resolved
  @Column({ name: 'playbook_draft', type: 'text', nullable: true }) playbookDraft: string | null; // 危机话术草稿（待核准）
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

// ── E2 文案 Copilot · 文案资产 ───────────────────────────────────────────────
@Entity('growth_copy_asset')
@Index(['tenantId', 'status'])
export class GrowthCopyAssetEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'varchar' }) channel: string;                     // xiaohongshu/douyin/zhihu/wechat/seo/ad
  @Column({ type: 'varchar', default: 'manual' }) source: string;
  @Column({ name: 'probe_job_id', type: 'uuid', nullable: true }) probeJobId: string | null;
  @Column({ name: 'brand_slug', type: 'varchar', nullable: true }) brandSlug: string | null;
  @Column({ type: 'varchar', nullable: true }) category: string | null;
  @Column({ type: 'text', nullable: true }) question: string | null;
  @Column({ type: 'text' }) prompt: string;
  @Column({ type: 'text', nullable: true }) draft: string | null;
  @Column({ type: 'varchar', default: 'draft' }) @Index() status: string; // draft/approved/published/rejected
  @Column({ type: 'varchar', nullable: true }) reviewer: string | null;
  @Column({ type: 'varchar', nullable: true }) model: string | null;
  @Column({ name: 'tokens_cost', type: 'numeric', precision: 12, scale: 4, default: 0 }) tokensCost: string;
  @Column({ name: 'compliance_flags', type: 'jsonb', default: [] }) complianceFlags: string[]; // 命中的合规词
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

// ── E3 GEO 分析 · 探测 ──────────────────────────────────────────────────────
@Entity('growth_geo_probe')
@Index(['tenantId', 'engine'])
export class GrowthGeoProbeEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'text' }) question: string;
  @Column({ type: 'varchar' }) engine: string;                      // doubao/kimi/deepseek/wenxiaoyan/chatgpt/perplexity/...
  @Column({ name: 'brand_slug', type: 'varchar', nullable: true }) brandSlug: string | null;
  @Column({ type: 'varchar', nullable: true }) category: string | null;
  @Column({ type: 'varchar', nullable: true }) stage: string | null;
  @Column({ name: 'batch_id', type: 'uuid', nullable: true }) batchId: string | null;
  @Column({ name: 'question_id', type: 'uuid', nullable: true }) questionId: string | null;
  @Column({ name: 'answer_snapshot', type: 'text', nullable: true }) answerSnapshot: string | null;
  @Column({ name: 'we_cited', type: 'boolean', default: false }) weCited: boolean;
  @Column({ name: 'citation_rank', type: 'int', nullable: true }) citationRank: number | null;
  @Column({ name: 'competitors_cited', type: 'jsonb', default: [] }) competitorsCited: string[];
  @Column({ type: 'int', default: 0 }) aivs: number;
  @Column({ name: 'risk_level', type: 'varchar', default: 'low' }) riskLevel: string;
  @Column({ name: 'risk_reasons', type: 'jsonb', default: [] }) riskReasons: string[];
  @Column({ name: 'probed_at', type: 'timestamptz', default: () => 'now()' }) probedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('growth_geo_question')
@Index(['tenantId', 'brandSlug', 'category'])
@Index(['tenantId', 'stage', 'enabled'])
export class GrowthGeoQuestionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'brand_slug', type: 'varchar' }) brandSlug: string;
  @Column({ type: 'varchar' }) category: string;
  @Column({ type: 'varchar' }) stage: 'pre' | 'mid' | 'post' | 'followup';
  @Column({ type: 'text' }) question: string;
  @Column({ type: 'int', default: 100 }) priority: number;
  @Column({ type: 'boolean', default: true }) enabled: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('growth_geo_probe_batch')
@Index(['tenantId', 'brandSlug', 'category'])
@Index(['tenantId', 'status', 'createdAt'])
export class GrowthGeoProbeBatchEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'brand_slug', type: 'varchar' }) brandSlug: string;
  @Column({ type: 'varchar' }) category: string;
  @Column({ type: 'varchar', default: 'hermes-center-ai' }) engine: string;
  @Column({ type: 'varchar', default: 'pending' }) status: 'pending' | 'running' | 'succeeded' | 'failed' | 'blocked';
  @Column({ name: 'total_probes', type: 'int', default: 0 }) totalProbes: number;
  @Column({ name: 'completed_probes', type: 'int', default: 0 }) completedProbes: number;
  @Column({ name: 'cited_rate', type: 'int', default: 0 }) citedRate: number;
  @Column({ name: 'avg_aivs', type: 'int', default: 0 }) avgAivs: number;
  @Column({ name: 'high_risk_count', type: 'int', default: 0 }) highRiskCount: number;
  @Column({ name: 'competitor_hit_count', type: 'int', default: 0 }) competitorHitCount: number;
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true }) startedAt: Date | null;
  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true }) finishedAt: Date | null;
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

// ── E4 营销自动化 · 战役 ─────────────────────────────────────────────────────
@Entity('growth_campaign')
@Index(['tenantId', 'status'])
export class GrowthCampaignEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'varchar' }) name: string;
  @Column({ type: 'varchar' }) channel: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) budget: string;
  @Column({ type: 'jsonb', default: {} }) utm: Record<string, unknown>;
  @Column({ type: 'varchar', default: 'draft' }) status: string;    // draft/approved/running/paused/closed
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

// ── E4 营销自动化 · 战役指标 ─────────────────────────────────────────────────
@Entity('growth_campaign_metric')
@Index(['tenantId', 'campaignId'])
export class GrowthCampaignMetricEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'campaign_id', type: 'uuid' }) campaignId: string;
  @Column({ type: 'int', default: 0 }) impressions: number;
  @Column({ type: 'int', default: 0 }) clicks: number;
  @Column({ type: 'int', default: 0 }) leads: number;
  @Column({ type: 'int', default: 0 }) signed: number;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) cac: string;
  @Column({ type: 'numeric', precision: 8, scale: 4, default: 0 }) roi: string;
  @Column({ type: 'varchar', nullable: true }) period: string | null;
  // 归因幂等键（inbox）：realtime 行 = 触发它的 outbox 事件 id；人工录入行为 NULL。
  // 部分唯一索引 (tenant_id, source_event_id) 使同一 lead.captured 事件重投不重复计数。
  @Column({ name: 'source_event_id', type: 'uuid', nullable: true }) sourceEventId: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('growth_geo_probe_job')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'engine'])
export class GrowthGeoProbeJobEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'text' }) question: string;
  @Column({ type: 'varchar' }) engine: string;
  @Column({ name: 'brand_slug', type: 'varchar', nullable: true }) brandSlug: string | null;
  @Column({ type: 'varchar', nullable: true }) category: string | null;
  @Column({ type: 'varchar', nullable: true }) stage: string | null;
  @Column({ name: 'batch_id', type: 'uuid', nullable: true }) batchId: string | null;
  @Column({ name: 'question_id', type: 'uuid', nullable: true }) questionId: string | null;
  @Column({ type: 'jsonb', default: [] }) competitors: string[];
  @Column({ type: 'varchar', default: 'pending' }) status: 'pending' | 'running' | 'succeeded' | 'failed' | 'blocked';
  @Column({ name: 'error_message', type: 'text', nullable: true }) errorMessage: string | null;
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true }) startedAt: Date | null;
  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true }) finishedAt: Date | null;
  @Column({ name: 'probe_id', type: 'uuid', nullable: true }) probeId: string | null;
  @Column({ name: 'snapshot_id', type: 'uuid', nullable: true }) snapshotId: string | null;
  @Column({ type: 'int', default: 0 }) aivs: number;
  @Column({ name: 'risk_level', type: 'varchar', default: 'low' }) riskLevel: string;
  @Column({ name: 'risk_reasons', type: 'jsonb', default: [] }) riskReasons: string[];
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('growth_geo_answer_snapshot')
@Index(['tenantId', 'jobId'])
export class GrowthGeoAnswerSnapshotEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'job_id', type: 'uuid' }) jobId: string;
  @Column({ type: 'varchar' }) engine: string;
  @Column({ type: 'text' }) question: string;
  @Column({ name: 'answer_text', type: 'text' }) answerText: string;
  @Column({ type: 'jsonb', default: [] }) citations: Array<Record<string, unknown>>;
  @Column({ name: 'raw_html', type: 'text', nullable: true }) rawHtml: string | null;
  @Column({ name: 'raw_response', type: 'jsonb', default: {} }) rawResponse: Record<string, unknown>;
  @Column({ name: 'screenshot_artifact_id', type: 'uuid', nullable: true }) screenshotArtifactId: string | null;
  @Column({ name: 'captured_at', type: 'timestamptz', default: () => 'now()' }) capturedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('growth_marketing_material')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'materialType'])
@Index(['tenantId', 'brandSlug'])
export class GrowthMarketingMaterialEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'varchar' }) title: string;
  @Column({ name: 'material_type', type: 'varchar' }) materialType: string;
  @Column({ name: 'brand_slug', type: 'varchar', nullable: true }) brandSlug: string | null;
  @Column({ type: 'varchar', nullable: true }) channel: string | null;
  @Column({ name: 'target_audience', type: 'varchar', nullable: true }) targetAudience: string | null;
  @Column({ type: 'text', nullable: true }) summary: string | null;
  @Column({ type: 'jsonb', default: [] }) tags: string[];
  @Column({ name: 'file_artifact_id', type: 'uuid', nullable: true }) fileArtifactId: string | null;
  @Column({ name: 'file_url', type: 'text', nullable: true }) fileUrl: string | null;
  @Column({ name: 'thumbnail_url', type: 'text', nullable: true }) thumbnailUrl: string | null;
  @Column({ name: 'file_format', type: 'varchar', nullable: true }) fileFormat: string | null;
  @Column({ name: 'version_label', type: 'varchar', default: 'v1' }) versionLabel: string;
  @Column({ type: 'varchar', default: 'active' }) status: string;
  @Column({ name: 'reviewer', type: 'varchar', nullable: true }) reviewer: string | null;
  @Column({ name: 'review_note', type: 'text', nullable: true }) reviewNote: string | null;
  @Column({ name: 'compliance_flags', type: 'jsonb', default: [] }) complianceFlags: string[];
  @Column({ name: 'valid_from', type: 'timestamptz', nullable: true }) validFrom: Date | null;
  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true }) validUntil: Date | null;
  @Column({ name: 'download_count', type: 'int', default: 0 }) downloadCount: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true }) archivedAt: Date | null;
}

export const GROWTH_ENTITIES = [
  GrowthOpinionMentionEntity,
  GrowthOpinionAlertEntity,
  GrowthCopyAssetEntity,
  GrowthGeoProbeEntity,
  GrowthGeoQuestionEntity,
  GrowthGeoProbeBatchEntity,
  GrowthGeoProbeJobEntity,
  GrowthGeoAnswerSnapshotEntity,
  GrowthCampaignEntity,
  GrowthCampaignMetricEntity,
  GrowthMarketingMaterialEntity,
];
