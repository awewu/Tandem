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
  // 生成该内容所用的 GEO 策略键（AgenticGEO 归因基础：实验 lift → 归因到策略 → 反哺权重）
  @Column({ name: 'strategy_keys', type: 'jsonb', default: [] }) strategyKeys: string[];
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

// ── cockpit · 北极星地基（Phase 1 · migration 068）────────────────────────────
// 北极星="活跃盈利经销商数"；盈利=混合口径(profit_proxy 代理 + profit_actual 可选真实)。
@Entity('dealer_success_snapshot')
@Index(['tenantId', 'period', 'active'])
@Index(['tenantId', 'dealerId', 'period'], { unique: true })
export class DealerSuccessSnapshotEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar' }) dealerId: string;
  @Column({ type: 'varchar' }) period: string;                         // YYYY-MM
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'numeric', precision: 16, scale: 2, default: 0 }) gmv: string;
  @Column({ name: 'profit_proxy', type: 'numeric', precision: 16, scale: 2, default: 0 }) profitProxy: string;
  @Column({ name: 'profit_actual', type: 'numeric', precision: 16, scale: 2, nullable: true }) profitActual: string | null;
  @Column({ name: 'close_rate', type: 'numeric', precision: 6, scale: 4, default: 0 }) closeRate: string;
  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true }) nps: string | null;
  @Column({ type: 'numeric', precision: 6, scale: 4, nullable: true }) retention: string | null;
  @Column({ type: 'int', default: 0 }) deals: number;
  @Column({ name: 'computed_at', type: 'timestamptz', default: () => 'now()' }) computedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

// 成交事件 inbox（幂等）：dealer_success 由此求和重算，重投靠唯一约束去重。
@Entity('growth_dealer_deal_inbox')
@Index(['tenantId', 'dealerId', 'period'])
@Index(['tenantId', 'sourceEventId'], { unique: true })
export class GrowthDealerDealInboxEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'source_event_id', type: 'varchar' }) sourceEventId: string;
  @Column({ name: 'dealer_id', type: 'varchar' }) dealerId: string;
  @Column({ type: 'numeric', precision: 16, scale: 2, default: 0 }) amount: string;
  @Column({ type: 'varchar' }) period: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// AARRR 漏斗事件（幂等：每合格事件一行，source_event_id 唯一去重，COUNT 分组即漏斗）
@Entity('growth_funnel_event')
@Index(['tenantId', 'period', 'stage'])
@Index(['tenantId', 'sourceEventId'], { unique: true })
export class GrowthFunnelEventEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'source_event_id', type: 'varchar' }) sourceEventId: string;
  @Column({ type: 'varchar' }) stage: 'reach' | 'lead' | 'visit' | 'proposal' | 'revenue' | 'referral';
  @Column({ name: 'subject_id', type: 'varchar', nullable: true }) subjectId: string | null;
  // 获客渠道（归一自事件 payload.source，见 geo-attribution.ts）：北极星分渠道归因用。
  // 现存历史行为 null（未归因），诚实计入总数但不算 GEO。
  @Column({ type: 'varchar', nullable: true }) channel: string | null;
  @Column({ type: 'varchar' }) period: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// 驾驶舱指标日快照（趋势）：(tenant, metric_key, snapshot_date) 唯一 → 同日幂等 upsert
@Entity('growth_metric_daily_snapshot')
@Index(['tenantId', 'metricKey', 'snapshotDate'], { unique: true })
export class GrowthMetricDailySnapshotEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'metric_key', type: 'varchar' }) metricKey: string;
  @Column({ type: 'numeric', default: 0 }) value: string;
  @Column({ name: 'snapshot_date', type: 'date', default: () => 'CURRENT_DATE' }) snapshotDate: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('growth_north_star_snapshot')
@Index(['tenantId', 'metric', 'period'], { unique: true })
export class GrowthNorthStarSnapshotEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ type: 'varchar' }) metric: string;                          // active_profitable_dealers / network_gmv / ...
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 }) value: string;
  @Column({ type: 'varchar' }) period: string;
  @Column({ name: 'computed_at', type: 'timestamptz', default: () => 'now()' }) computedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

// ── GEO 第 7 层 · 闭环实验（探测→缺口→内容→复投→验证 lift）─────────────────
@Entity('growth_geo_experiment')
@Index(['tenantId', 'brandSlug', 'status', 'createdAt'])
export class GrowthGeoExperimentEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'brand_slug', type: 'varchar' }) brandSlug: string;
  @Column({ name: 'question_id', type: 'uuid', nullable: true }) questionId: string | null;
  @Column({ type: 'text' }) question: string;
  @Column({ type: 'text', nullable: true }) hypothesis: string | null;
  @Column({ type: 'varchar', default: 'baseline' })
  status: 'baseline' | 'content-linked' | 'verifying' | 'improved' | 'no-change' | 'regressed' | 'killed';
  @Column({ name: 'baseline_batch_id', type: 'uuid', nullable: true }) baselineBatchId: string | null;
  @Column({ name: 'baseline_cited_rate', type: 'int', nullable: true }) baselineCitedRate: number | null;
  @Column({ name: 'baseline_at', type: 'timestamptz', nullable: true }) baselineAt: Date | null;
  @Column({ name: 'copy_asset_id', type: 'uuid', nullable: true }) copyAssetId: string | null;
  @Column({ name: 'content_published_at', type: 'timestamptz', nullable: true }) contentPublishedAt: Date | null;
  @Column({ name: 'verify_batch_id', type: 'uuid', nullable: true }) verifyBatchId: string | null;
  @Column({ name: 'verify_cited_rate', type: 'int', nullable: true }) verifyCitedRate: number | null;
  @Column({ name: 'verify_at', type: 'timestamptz', nullable: true }) verifyAt: Date | null;
  @Column({ type: 'int', nullable: true }) lift: number | null;
  @Column({ name: 'kill_criteria', type: 'text', nullable: true }) killCriteria: string | null;
  @Column({ type: 'text', nullable: true }) conclusion: string | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

export { GeoTargetEntity, GeoCognitionAssetEntity } from './geo-focus.entity';
import { GeoTargetEntity, GeoCognitionAssetEntity } from './geo-focus.entity';

export const GROWTH_ENTITIES = [
  GeoTargetEntity,
  GeoCognitionAssetEntity,
  GrowthOpinionMentionEntity,
  GrowthOpinionAlertEntity,
  GrowthCopyAssetEntity,
  GrowthGeoProbeEntity,
  GrowthGeoQuestionEntity,
  GrowthGeoExperimentEntity,
  GrowthGeoProbeBatchEntity,
  GrowthGeoProbeJobEntity,
  GrowthGeoAnswerSnapshotEntity,
  GrowthCampaignEntity,
  GrowthCampaignMetricEntity,
  GrowthMarketingMaterialEntity,
  DealerSuccessSnapshotEntity,
  GrowthDealerDealInboxEntity,
  GrowthFunnelEventEntity,
  GrowthMetricDailySnapshotEntity,
  GrowthNorthStarSnapshotEntity,
];
