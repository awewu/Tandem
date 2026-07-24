import { describe, expect, it } from 'vitest';
import { findStrategicProject, strategicProjects } from '@/lib/strategic-projects/sample-data';

describe('strategicProjects sample data', () => {
  it('包含截图里的 9 个 V 项目', () => {
    expect(strategicProjects).toHaveLength(9);
    expect(strategicProjects.map((project) => project.name)).toEqual([
      'V1-创新引领',
      'V2-供应链成本优化',
      'V3-RUUD水机空调业务发展',
      'V4-热泵产品竞争力提升',
      'V5-Digital Empowerment Biz',
      'V6-Rhautt Group品牌升级',
      'V7-企业文化建设',
      'V8-热水品类2亿销售达成',
      'V9-客户满意度提升≥90%',
    ]);
  });

  it('V3 和 V6 有独立里程碑看板数据', () => {
    expect(findStrategicProject('v3')?.milestones.map((milestone) => milestone.title)).toContain(
      '热泵主机、空气侧设备顺利上市',
    );
    expect(findStrategicProject('v6')?.milestones.map((milestone) => milestone.title)).toContain(
      '市场组织文化建设',
    );
  });
});
