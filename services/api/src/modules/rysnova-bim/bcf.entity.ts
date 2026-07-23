import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * BCF 协同审图议题（BIM Collaboration Format · 最小子集）。
 * 一个 Topic 承载 comments/viewpoints(jsonb)，支持 open→resolved→closed 流转与指派。
 * 关联设计/BIM 项目，供设计-工程-经销商多方协同挑错闭环。
 */
@Entity('bcf_topics')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'bimProjectId'])
export class BcfTopicEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'tenant_id' }) @Index() tenantId: string;
  @Column({ name: 'dealer_id', type: 'varchar', nullable: true }) dealerId: string | null;
  @Column({ name: 'store_id', type: 'varchar', nullable: true }) storeId: string | null;
  @Column({ name: 'topic_guid' }) topicGuid: string;
  @Column() title: string;
  @Column({ type: 'text', default: '' }) description: string;
  // clash | rfi | change | issue
  @Column({ name: 'topic_type', default: 'issue' }) topicType: string;
  @Column({ default: 'open' }) @Index() status: string; // open | resolved | closed
  @Column({ default: 'normal' }) priority: string;
  @Column({ name: 'creation_author' }) creationAuthor: string;
  @Column({ name: 'assigned_to', type: 'varchar', nullable: true }) assignedTo: string | null;
  @Column({ name: 'design_project_id', type: 'varchar', nullable: true }) designProjectId: string | null;
  @Column({ name: 'bim_project_id', type: 'varchar', nullable: true }) bimProjectId: string | null;
  @Column({ name: 'related_ifc_guids', type: 'jsonb', default: () => "'[]'::jsonb" }) relatedIfcGuids: string[];
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) comments: Array<Record<string, unknown>>;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) viewpoints: Array<Record<string, unknown>>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
