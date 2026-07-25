import { describe, expect, it } from 'vitest';
import { findStrategicProject, strategicProjects } from '@/lib/strategic-projects/sample-data';

describe('strategicProjects sample data', () => {
  it('包含 Excel 导入的 4 个 V 项目', () => {
    expect(strategicProjects).toHaveLength(4);
    expect(strategicProjects.map((project) => project.name)).toEqual([
      'V3-RUUD水机空调业务发展',
      'V6-Rhautt Group品牌升级',
      'V8-热水品类2亿销售达成',
      'V9-客户满意度提升≥90%',
    ]);
  });

  it('V3/V6/V8/V9 有独立里程碑看板数据', () => {
    expect(findStrategicProject('v3')?.milestones.map((milestone) => milestone.title)).toContain(
      '热泵主机、空气侧设备顺利上市销售及市场动作规划落地',
    );
    expect(findStrategicProject('v6')?.milestones.map((milestone) => milestone.title)).toContain(
      '市场组织文化建设',
    );
    expect(findStrategicProject('v8')?.milestones.map((milestone) => milestone.title)).toContain(
      'KR1:壁挂炉10000台',
    );
    expect(findStrategicProject('v9')?.milestones.map((milestone) => milestone.title)).toContain(
      'AI助力服务效率提升',
    );
  });
});
