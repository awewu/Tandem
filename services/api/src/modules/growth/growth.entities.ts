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
  @Column({ name: 'brand_slug', type: 'varchar', nullable: true }) brandSlug: string | null;
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
  @Column({ name: 'answer_snapshot', type: 'text', nullable: true }) answerSnapshot: string | null;
  @Column({ name: 'we_cited', type: 'boolean', default: false }) weCited: boolean;
  @Column({ name: 'citation_rank', type: 'int', nullable: true }) citationRank: number | null;
  @Column({ name: 'competitors_cited', type: 'jsonb', default: [] }) competitorsCited: string[];
  @Column({ name: 'probed_at', type: 'timestamptz', default: () => 'now()' }) probedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
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

export const GROWTH_ENTITIES = [
  GrowthOpinionMentionEntity,
  GrowthOpinionAlertEntity,
  GrowthCopyAssetEntity,
  GrowthGeoProbeEntity,
  GrowthCampaignEntity,
  GrowthCampaignMetricEntity,
];
