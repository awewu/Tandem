/**
 * 图纸导出引擎
 * 为设计院生成施工图纸和材料清单
 * 支持系统原理图、平面布置图、材料清单导出
 */

export interface DrawingExportRequest {
  projectName: string;
  buildingType: string;
  buildingArea: number;
  unitCount: number;
  equipmentList: Array<{
    name: string;
    model: string;
    power: number;
    quantity: number;
    position?: { x: number; y: number };
  }>;
  tankList: Array<{
    volume: number;
    quantity: number;
    position?: { x: number; y: number };
  }>;
  pipeRouting?: {
    mainPipeDN: number;
    branchPipeDN: number;
    circulationPipeDN: number;
    estimatedLength: number;
  };
  drawingType: 'schematic' | 'layout' | 'isometric' | 'bill' | 'all';
}

export interface DrawingExportResult {
  success: boolean;
  drawings: Array<{
    type: string;
    name: string;
    format: string;
    content: string; // SVG or base64
    downloadUrl?: string;
  }>;
  materialBill: MaterialBill;
  specifications: string[];
}

export interface MaterialBill {
  projectName: string;
  exportDate: string;
  categories: Array<{
    name: string;
    items: Array<{
      no: string;
      name: string;
      model: string;
      brand: string;
      unit: string;
      quantity: number;
      unitWeight?: number; // kg
      totalWeight?: number; // kg
      remark?: string;
    }>;
  }>;
  summary: {
    totalItems: number;
    totalWeight: number;
    estimatedCost: number;
  };
}

export class DrawingExportEngine {
  /**
   * 生成系统原理图 (Schematic Diagram)
   */
  generateSchematicDiagram(request: DrawingExportRequest): string {
    const { equipmentList, tankList } = request;
    
    // 生成SVG格式的系统原理图
    const svg = this.createSVGSchematic(equipmentList, tankList);
    
    return svg;
  }
  
  /**
   * 生成平面布置图 (Layout Plan)
   */
  generateLayoutPlan(request: DrawingExportRequest): string {
    const { buildingArea, equipmentList, tankList } = request;
    
    // 简化版平面布置图（SVG格式）
    const svg = this.createSVGLayout(buildingArea, equipmentList, tankList);
    
    return svg;
  }
  
  /**
   * 生成材料清单 (Bill of Materials)
   */
  generateMaterialBill(request: DrawingExportRequest): MaterialBill {
    const { projectName, equipmentList, tankList, pipeRouting } = request;
    
    const categories: MaterialBill['categories'] = [];
    
    // 1. 主机设备
    const equipmentItems = equipmentList.map((eq, index) => ({
      no: `E-${String(index + 1).padStart(3, '0')}`,
      name: eq.name,
      model: eq.model,
      brand: '恒热/指定品牌',
      unit: '台',
      quantity: eq.quantity,
      unitWeight: 150, // 估算重量 kg
      totalWeight: 150 * eq.quantity,
      remark: `制热量${eq.power}kW`,
    }));
    
    if (equipmentItems.length > 0) {
      categories.push({
        name: '主机设备',
        items: equipmentItems,
      });
    }
    
    // 2. 储热水箱
    const tankItems = tankList.map((tank, index) => ({
      no: `T-${String(index + 1).padStart(3, '0')}`,
      name: '储热水箱',
      model: `${tank.volume}L`,
      brand: '定制',
      unit: '个',
      quantity: tank.quantity,
      unitWeight: tank.volume / 10, // 估算：每10L约1kg
      totalWeight: (tank.volume / 10) * tank.quantity,
      remark: '含保温',
    }));
    
    if (tankItems.length > 0) {
      categories.push({
        name: '储热水箱',
        items: tankItems,
      });
    }
    
    // 3. 管材管件（基于估算长度）
    if (pipeRouting) {
      const pipeItems = [
        {
          no: 'P-001',
          name: 'PPR给水管',
          model: `DN${pipeRouting.mainPipeDN}`,
          brand: '国产优质',
          unit: '米',
          quantity: Math.round(pipeRouting.estimatedLength * 0.3),
          unitWeight: 0.5,
          totalWeight: Math.round(pipeRouting.estimatedLength * 0.3 * 0.5),
          remark: 'S4级',
        },
        {
          no: 'P-002',
          name: 'PPR给水管',
          model: `DN${pipeRouting.branchPipeDN}`,
          brand: '国产优质',
          unit: '米',
          quantity: Math.round(pipeRouting.estimatedLength * 0.5),
          unitWeight: 0.3,
          totalWeight: Math.round(pipeRouting.estimatedLength * 0.5 * 0.3),
          remark: 'S4级',
        },
        {
          no: 'P-003',
          name: 'PPR热水循环管',
          model: `DN${pipeRouting.circulationPipeDN}`,
          brand: '国产优质',
          unit: '米',
          quantity: Math.round(pipeRouting.estimatedLength * 0.2),
          unitWeight: 0.25,
          totalWeight: Math.round(pipeRouting.estimatedLength * 0.2 * 0.25),
          remark: 'S3.2级',
        },
        {
          no: 'I-001',
          name: '橡塑保温棉',
          model: '20mm厚',
          brand: '华美/神州',
          unit: '米',
          quantity: Math.round(pipeRouting.estimatedLength * 1.2),
          unitWeight: 0.15,
          totalWeight: Math.round(pipeRouting.estimatedLength * 1.2 * 0.15),
          remark: 'B1级阻燃',
        },
      ];
      
      categories.push({
        name: '管材保温',
        items: pipeItems,
      });
    }
    
    // 4. 阀门
    const valveItems = [
      {
        no: 'V-001',
        name: '闸阀',
        model: 'DN32',
        brand: '埃美柯/盾安',
        unit: '个',
        quantity: 4,
        remark: '主机进出',
      },
      {
        no: 'V-002',
        name: '止回阀',
        model: 'DN32',
        brand: '埃美柯/盾安',
        unit: '个',
        quantity: 2,
        remark: '主机出水',
      },
      {
        no: 'V-003',
        name: '安全阀',
        model: 'DN25',
        brand: '埃美柯/盾安',
        unit: '个',
        quantity: tankList.length,
        remark: '水箱配',
      },
      {
        no: 'V-004',
        name: '自动排气阀',
        model: 'DN20',
        brand: '埃美柯/盾安',
        unit: '个',
        quantity: 2,
        remark: '系统高点',
      },
      {
        no: 'V-005',
        name: 'Y型过滤器',
        model: 'DN32',
        brand: '埃美柯/盾安',
        unit: '个',
        quantity: equipmentList.length,
        remark: '主机进水',
      },
    ];
    
    categories.push({
      name: '阀门',
      items: valveItems,
    });
    
    // 5. 泵类
    const pumpQty = Math.ceil(equipmentList.reduce((sum, e) => sum + e.quantity, 0) / 2);
    const pumpItems = [
      {
        no: 'PU-001',
        name: '热水循环泵',
        model: 'DN25 0.5kW',
        brand: '格兰富/威乐',
        unit: '台',
        quantity: pumpQty,
        unitWeight: 15,
        totalWeight: 15 * pumpQty,
        remark: '变频型',
      },
    ];
    
    categories.push({
      name: '泵类',
      items: pumpItems,
    });
    
    // 6. 电气控制
    const electricalItems = [
      {
        no: 'EL-001',
        name: '控制柜',
        model: '定制',
        brand: '恒热',
        unit: '套',
        quantity: 1,
        unitWeight: 50,
        totalWeight: 50,
        remark: '含PLC/触摸屏',
      },
      {
        no: 'EL-002',
        name: '电缆',
        model: 'YJV 3×4',
        brand: '上上/远东',
        unit: '米',
        quantity: 100,
        unitWeight: 0.3,
        totalWeight: 30,
        remark: '主机电源',
      },
      {
        no: 'EL-003',
        name: '电缆',
        model: 'YJV 3×2.5',
        brand: '上上/远东',
        unit: '米',
        quantity: 50,
        unitWeight: 0.2,
        totalWeight: 10,
        remark: '循环泵电源',
      },
    ];
    
    categories.push({
      name: '电气控制',
      items: electricalItems,
    });
    
    // 7. 辅材
    const accessoryItems = [
      {
        no: 'A-001',
        name: '管道支架',
        model: 'L40×4',
        brand: '国产',
        unit: '套',
        quantity: Math.ceil(pipeRouting?.estimatedLength || 100 / 2),
        unitWeight: 2,
        totalWeight: Math.ceil((pipeRouting?.estimatedLength || 100) / 2) * 2,
        remark: '含膨胀螺栓',
      },
      {
        no: 'A-002',
        name: '管卡',
        model: 'DN25-DN50',
        brand: '国产',
        unit: '套',
        quantity: Math.ceil((pipeRouting?.estimatedLength || 100) / 1.5),
        remark: 'U型卡',
      },
      {
        no: 'A-003',
        name: '生料带',
        model: '聚四氟乙烯',
        brand: '国产',
        unit: '卷',
        quantity: 10,
        remark: '密封',
      },
    ];
    
    categories.push({
      name: '辅材',
      items: accessoryItems,
    });
    
    // 计算汇总
    const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);
    const totalWeight = categories.reduce((sum, c) => 
      sum + c.items.reduce((itemSum, i) => itemSum + (i.totalWeight || 0), 0), 0);
    
    return {
      projectName,
      exportDate: new Date().toISOString().split('T')[0],
      categories,
      summary: {
        totalItems,
        totalWeight: Math.round(totalWeight),
        estimatedCost: 0, // 由报价引擎计算
      },
    };
  }
  
  /**
   * 生成技术规格书
   */
  generateSpecifications(request: DrawingExportRequest): string[] {
    const { equipmentList, tankList } = request;
    
    const totalPower = equipmentList.reduce((sum, e) => sum + e.power * e.quantity, 0);
    const totalVolume = tankList.reduce((sum, t) => sum + t.volume * t.quantity, 0);
    
    return [
      '## 热水系统设计技术规格书',
      '',
      '### 一、设计依据',
      '1. GB 50015-2019《建筑给水排水设计标准》',
      '2. GB 50736-2012《民用建筑供暖通风与空气调节设计规范》',
      '3. GB/T 23137-2020《家用和类似用途热泵热水器》',
      '',
      '### 二、设计参数',
      `- 系统总制热量: ${totalPower} kW`,
      `- 储热水箱总容积: ${totalVolume} L`,
      `- 热水供水温度: 60℃`,
      `- 冷水计算温度: 15℃（三亚地区）`,
      '',
      '### 三、系统说明',
      '1. 本系统采用空气源热泵作为热源，提供24小时热水供应',
      '2. 系统采用开式（闭式）系统，设置储热水箱蓄热',
      '3. 热水管网采用机械循环系统，保证即开即热',
      '4. 主机采用N+1配置，确保系统可靠性',
      '',
      '### 四、设备要求',
      '1. 热泵主机COP≥4.0（标准工况下）',
      '2. 储热水箱保温厚度≥50mm，24小时温降≤5℃',
      '3. 管道保温采用B1级橡塑保温材料',
      '4. 控制系统具备定时启停、温度设定、故障报警功能',
      '',
      '### 五、施工要求',
      '1. 设备安装应水平，基础承重≥设备重量2倍',
      '2. 管道安装坡度≥0.003，高点设排气，低点设泄水',
      '3. 管道试压0.6MPa，保压30分钟无泄漏',
      '4. 保温施工应在管道试压合格后进行',
      '',
      '### 六、调试要求',
      '1. 系统注水后检查各连接点无渗漏',
      '2. 主机调试应检查高低压、电流、出水温度正常',
      '3. 循环系统调试应检查各用水点压力平衡',
      '4. 系统连续运行72小时无故障',
    ];
  }
  
  /**
   * 创建SVG系统原理图
   */
  private createSVGSchematic(
    equipmentList: DrawingExportRequest['equipmentList'],
    tankList: DrawingExportRequest['tankList']
  ): string {
    const width = 800;
    const height = 600;
    
    // 简化的SVG原理图
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    svg += `<rect width="${width}" height="${height}" fill="white"/>`;
    svg += `<text x="${width/2}" y="30" text-anchor="middle" font-size="20" font-weight="bold">空气源热泵热水系统原理图</text>`;
    
    // 绘制热泵主机
    let yPos = 80;
    equipmentList.forEach((eq, index) => {
      svg += `<rect x="50" y="${yPos}" width="120" height="60" fill="#e6f4ff" stroke="#1a5fb4" stroke-width="2"/>`;
      svg += `<text x="110" y="${yPos + 35}" text-anchor="middle" font-size="12">热泵主机${index + 1}</text>`;
      svg += `<text x="110" y="${yPos + 50}" text-anchor="middle" font-size="10">${eq.power}kW</text>`;
      yPos += 80;
    });
    
    // 绘制储热水箱
    yPos = 80;
    tankList.forEach((tank, index) => {
      svg += `<rect x="300" y="${yPos}" width="100" height="80" fill="#fffbe6" stroke="#faad14" stroke-width="2"/>`;
      svg += `<text x="350" y="${yPos + 35}" text-anchor="middle" font-size="12">储热水箱${index + 1}</text>`;
      svg += `<text x="350" y="${yPos + 55}" text-anchor="middle" font-size="10">${tank.volume}L</text>`;
      yPos += 100;
    });
    
    // 绘制管道（简化）
    svg += `<line x1="170" y1="110" x2="300" y2="110" stroke="#333" stroke-width="2"/>`;
    svg += `<text x="235" y="105" text-anchor="middle" font-size="10">热水管</text>`;
    
    svg += `<line x1="170" y1="130" x2="300" y2="130" stroke="#333" stroke-width="2" stroke-dasharray="5,5"/>`;
    svg += `<text x="235" y="145" text-anchor="middle" font-size="10">回水管</text>`;
    
    // 图例
    svg += `<rect x="500" y="80" width="250" height="200" fill="#f5f5f5" stroke="#ddd"/>`;
    svg += `<text x="625" y="105" text-anchor="middle" font-size="14" font-weight="bold">图例</text>`;
    svg += `<rect x="520" y="120" width="30" height="20" fill="#e6f4ff" stroke="#1a5fb4"/>`;
    svg += `<text x="560" y="135" font-size="12">热泵主机</text>`;
    svg += `<rect x="520" y="150" width="30" height="20" fill="#fffbe6" stroke="#faad14"/>`;
    svg += `<text x="560" y="165" font-size="12">储热水箱</text>`;
    svg += `<line x1="520" y1="185" x2="550" y2="185" stroke="#333" stroke-width="2"/>`;
    svg += `<text x="560" y="190" font-size="12">热水管</text>`;
    svg += `<line x1="520" y1="205" x2="550" y2="205" stroke="#333" stroke-width="2" stroke-dasharray="5,5"/>`;
    svg += `<text x="560" y="210" font-size="12">回水管</text>`;
    
    svg += `</svg>`;
    
    return svg;
  }
  
  /**
   * 创建SVG平面布置图（简化版）
   */
  private createSVGLayout(
    buildingArea: number,
    equipmentList: DrawingExportRequest['equipmentList'],
    tankList: DrawingExportRequest['tankList']
  ): string {
    const width = 800;
    const height = 600;
    
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`;
    svg += `<rect width="${width}" height="${height}" fill="white"/>`;
    svg += `<text x="${width/2}" y="30" text-anchor="middle" font-size="20" font-weight="bold">设备平面布置图</text>`;
    svg += `<text x="${width/2}" y="50" text-anchor="middle" font-size="12">建筑面积: ${buildingArea}㎡</text>`;
    
    // 绘制机房轮廓
    svg += `<rect x="100" y="100" width="600" height="400" fill="#f9f9f9" stroke="#333" stroke-width="2"/>`;
    svg += `<text x="400" y="90" text-anchor="middle" font-size="14">热泵机房</text>`;
    
    // 绘制设备位置
    let xPos = 150;
    equipmentList.forEach((eq, index) => {
      svg += `<rect x="${xPos}" y="150" width="100" height="80" fill="#e6f4ff" stroke="#1a5fb4" stroke-width="2"/>`;
      svg += `<text x="${xPos + 50}" y="195" text-anchor="middle" font-size="11">主机${index + 1}</text>`;
      svg += `<text x="${xPos + 50}" y="210" text-anchor="middle" font-size="9">${eq.power}kW</text>`;
      xPos += 140;
    });
    
    // 绘制水箱位置
    xPos = 150;
    tankList.forEach((tank, index) => {
      svg += `<circle cx="${xPos + 50}" cy="350" r="50" fill="#fffbe6" stroke="#faad14" stroke-width="2"/>`;
      svg += `<text x="${xPos + 50}" y="345" text-anchor="middle" font-size="11">水箱${index + 1}</text>`;
      svg += `<text x="${xPos + 50}" y="360" text-anchor="middle" font-size="9">${tank.volume}L</text>`;
      xPos += 140;
    });
    
    // 尺寸标注（简化）
    svg += `<line x1="100" y1="520" x2="700" y2="520" stroke="#666" stroke-width="1"/>`;
    svg += `<line x1="100" y1="515" x2="100" y2="525" stroke="#666"/>`;
    svg += `<line x1="700" y1="515" x2="700" y2="525" stroke="#666"/>`;
    svg += `<text x="400" y="540" text-anchor="middle" font-size="12">6000mm</text>`;
    
    svg += `</svg>`;
    
    return svg;
  }
}

// 导出单例
export const drawingExportEngine = new DrawingExportEngine();
