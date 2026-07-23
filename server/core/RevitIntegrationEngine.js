/**
 * Revit集成引擎 - RevitIntegrationEngine
 * 双向数据同步、族库管理、参数映射、模型对比
 * 
 * 功能：
 * 1. IFC导入Revit优化（保留参数和系统）
 * 2. Revit参数导出（数据库同步）
 * 3. 族库管理（RFA文件库）
 * 4. 模型版本对比
 * 5. 冲突检测
 * 6. 施工进度同步
 */

class RevitIntegrationEngine {
  constructor() {
    this.version = '2.0.0';
    this.supportedRevitVersions = ['2020', '2021', '2022', '2023', '2024', '2025'];
    
    // 瑞美族库
    this.familyLibrary = this.loadFamilyLibrary();
    
    // 参数映射表
    this.parameterMapping = this.loadParameterMapping();
    
    // 系统映射
    this.systemMapping = this.loadSystemMapping();
  }

  /**
   * 加载瑞美族库
   */
  loadFamilyLibrary() {
    return {
      // HVAC设备族
      hvac: {
        outdoorUnits: [
          { 
            name: 'RH_VRV_Outdoor_6HP', 
            file: 'RH_VRV_Outdoor_6HP.rfa',
            params: { coolingCapacity: 16000, heatingCapacity: 18000, power: 5.2 },
            connectors: { chilledWater: 2, electrical: 1 }
          },
          { 
            name: 'RH_VRV_Outdoor_8HP', 
            file: 'RH_VRV_Outdoor_8HP.rfa',
            params: { coolingCapacity: 22400, heatingCapacity: 25200, power: 7.0 },
            connectors: { chilledWater: 2, electrical: 1 }
          },
          { 
            name: 'RH_VRV_Outdoor_10HP', 
            file: 'RH_VRV_Outdoor_10HP.rfa',
            params: { coolingCapacity: 28000, heatingCapacity: 31500, power: 8.8 },
            connectors: { chilledWater: 2, electrical: 1 }
          },
          { 
            name: 'RH_VRV_Outdoor_12HP', 
            file: 'RH_VRV_Outdoor_12HP.rfa',
            params: { coolingCapacity: 33500, heatingCapacity: 37500, power: 10.5 },
            connectors: { chilledWater: 2, electrical: 1 }
          },
          { 
            name: 'RH_VRV_Outdoor_14HP', 
            file: 'RH_VRV_Outdoor_14HP.rfa',
            params: { coolingCapacity: 40000, heatingCapacity: 45000, power: 12.5 },
            connectors: { chilledWater: 2, electrical: 1 }
          },
          { 
            name: 'RH_VRV_Outdoor_16HP', 
            file: 'RH_VRV_Outdoor_16HP.rfa',
            params: { coolingCapacity: 45000, heatingCapacity: 50000, power: 14.0 },
            connectors: { chilledWater: 2, electrical: 1 }
          }
        ],
        indoorUnits: [
          {
            name: 'RH_Cassette_4way_2HP',
            file: 'RH_Cassette_4way_2HP.rfa',
            params: { coolingCapacity: 5000, heatingCapacity: 5600, airflow: 800 },
            type: '四面出风嵌入式'
          },
          {
            name: 'RH_Cassette_4way_3HP',
            file: 'RH_Cassette_4way_3HP.rfa',
            params: { coolingCapacity: 7100, heatingCapacity: 8000, airflow: 1100 },
            type: '四面出风嵌入式'
          },
          {
            name: 'RH_WallMouned_2HP',
            file: 'RH_WallMouned_2HP.rfa',
            params: { coolingCapacity: 5000, heatingCapacity: 5600, airflow: 700 },
            type: '壁挂式'
          },
          {
            name: 'RH_Duct_3HP',
            file: 'RH_Duct_3HP.rfa',
            params: { coolingCapacity: 7100, heatingCapacity: 8000, airflow: 1000 },
            type: '风管机'
          },
          {
            name: 'RH_Duct_5HP',
            file: 'RH_Duct_5HP.rfa',
            params: { coolingCapacity: 12000, heatingCapacity: 13500, airflow: 1600 },
            type: '风管机'
          }
        ]
      },
      
      // 管路附件族
      piping: {
        pipes: [
          { name: 'RH_Pipe_Copper_9.52', file: 'RH_Pipe_Copper_9.52.rfa', diameter: 9.52, material: '紫铜' },
          { name: 'RH_Pipe_Copper_12.7', file: 'RH_Pipe_Copper_12.7.rfa', diameter: 12.7, material: '紫铜' },
          { name: 'RH_Pipe_Copper_15.88', file: 'RH_Pipe_Copper_15.88.rfa', diameter: 15.88, material: '紫铜' },
          { name: 'RH_Pipe_Copper_19.05', file: 'RH_Pipe_Copper_19.05.rfa', diameter: 19.05, material: '紫铜' },
          { name: 'RH_Pipe_PVC_25', file: 'RH_Pipe_PVC_25.rfa', diameter: 25, material: 'PVC' }
        ],
        fittings: [
          { name: 'RH_Elbow_90_Copper', file: 'RH_Elbow_90_Copper.rfa', type: '弯头' },
          { name: 'RH_Tee_Copper', file: 'RH_Tee_Copper.rfa', type: '三通' },
          { name: 'RH_Reducer_Copper', file: 'RH_Reducer_Copper.rfa', type: '变径' },
          { name: 'RH_Valve_Ball', file: 'RH_Valve_Ball.rfa', type: '球阀' }
        ]
      },
      
      // 新风系统族
      freshAir: {
        units: [
          { name: 'RH_FreshAir_250', file: 'RH_FreshAir_250.rfa', airflow: 250, params: { heatRecovery: 0.75, power: 0.08 } },
          { name: 'RH_FreshAir_350', file: 'RH_FreshAir_350.rfa', airflow: 350, params: { heatRecovery: 0.78, power: 0.12 } },
          { name: 'RH_FreshAir_500', file: 'RH_FreshAir_500.rfa', airflow: 500, params: { heatRecovery: 0.80, power: 0.18 } }
        ],
        ducts: [
          { name: 'RH_Duct_Rect_200x150', file: 'RH_Duct_Rect_200x150.rfa', size: '200x150' },
          { name: 'RH_Duct_Rect_250x200', file: 'RH_Duct_Rect_250x200.rfa', size: '250x200' },
          { name: 'RH_Duct_Round_160', file: 'RH_Duct_Round_160.rfa', diameter: 160 }
        ]
      },
      
      // 地暖系统族
      floorHeating: {
        manifolds: [
          { name: 'RH_Manifold_4way', file: 'RH_Manifold_4way.rfa', circuits: 4 },
          { name: 'RH_Manifold_6way', file: 'RH_Manifold_6way.rfa', circuits: 6 },
          { name: 'RH_Manifold_8way', file: 'RH_Manifold_8way.rfa', circuits: 8 }
        ],
        pipes: [
          { name: 'RH_Pipe_PE_RT_16', file: 'RH_Pipe_PE_RT_16.rfa', diameter: 16, material: 'PE-RT' },
          { name: 'RH_Pipe_PE_RT_20', file: 'RH_Pipe_PE_RT_20.rfa', diameter: 20, material: 'PE-RT' }
        ]
      }
    };
  }

  /**
   * 加载参数映射表
   */
  loadParameterMapping() {
    return {
      // 从平台参数 → Revit参数
      toRevit: {
        // 设备参数
        'device.coolingCapacity': '制冷量_W',
        'device.heatingCapacity': '制热量_W',
        'device.power': '额定功率_kW',
        'device.airflow': '风量_m3/h',
        'device.eer': '能效比_EER',
        'device.cop': '制热性能系数_COP',
        'device.noiseLevel': '噪音水平_dB',
        'device.weight': '重量_kg',
        'device.model': '设备型号',
        'device.serialNumber': '序列号',
        
        // 管路参数
        'pipe.diameter': '公称直径_mm',
        'pipe.material': '材质',
        'pipe.length': '长度_m',
        'pipe.insulation': '保温厚度_mm',
        'pipe.pressure': '工作压力_MPa',
        
        // 位置参数
        'position.x': '坐标X_mm',
        'position.y': '坐标Y_mm',
        'position.z': '坐标Z_mm',
        'position.room': '所在房间',
        'position.elevation': '标高_m',
        
        // 系统参数
        'system.type': '系统类型',
        'system.name': '系统名称',
        'system.designTemp': '设计温度_°C',
        'system.flowRate': '流量_m3/h',
        'system.pressure': '压力_Pa'
      },
      
      // 从Revit参数 → 平台参数
      fromRevit: {
        'Mark': 'device.mark',
        'Comments': 'device.comments',
        '制造商': 'device.manufacturer',
        '型号': 'device.model',
        '设备编号': 'device.id'
      }
    };
  }

  /**
   * 加载系统映射
   */
  loadSystemMapping() {
    return {
      // 平台系统 → Revit系统分类
      hvac: {
        revitCategory: 'Mechanical Equipment',
        revitSystemType: 'Supply Air',
        ifcType: 'IfcDistributionSystem.AIRCONDITIONING',
        color: { r: 0, g: 255, b: 255 }  // 青色
      },
      heating: {
        revitCategory: 'Mechanical Equipment',
        revitSystemType: 'Hydronic Return',
        ifcType: 'IfcDistributionSystem.HEATING',
        color: { r: 255, g: 0, b: 0 }     // 红色
      },
      freshAir: {
        revitCategory: 'Mechanical Equipment',
        revitSystemType: 'Ventilation',
        ifcType: 'IfcDistributionSystem.VENTILATION',
        color: { r: 0, g: 255, b: 0 }     // 绿色
      },
      plumbing: {
        revitCategory: 'Mechanical Equipment',
        revitSystemType: 'Domestic Hot Water',
        ifcType: 'IfcDistributionSystem.DOMESTICHOTWATER',
        color: { r: 0, g: 0, b: 255 }     // 蓝色
      }
    };
  }

  /**
   * 生成Revit优化的IFC文件
   * 包含完整的参数和系统信息，确保Revit正确识别
   */
  generateRevitOptimizedIFC(projectData) {
    console.log('[RevitIntegration] 生成Revit优化IFC...');
    
    const { 
      projectName, 
      projectId, 
      buildingInfo, 
      devices = [], 
      pipes = [], 
      ducts = [],
      systems = [],
      version = '2024'
    } = projectData;
    
    // 验证Revit版本
    if (!this.supportedRevitVersions.includes(version)) {
      console.warn(`[RevitIntegration] 警告: Revit ${version} 可能不完全兼容`);
    }
    
    const timestamp = new Date().toISOString();
    const lines = [];
    let entityId = 1;
    
    // HEADER - 优化版本声明
    lines.push('ISO-10303-21;');
    lines.push('HEADER;');
    lines.push("FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0, MEPView, GeneralUsage]'), '2;1');");
    lines.push(`FILE_NAME('${projectName}_Revit${version}.ifc', '${timestamp}', ('Rheem BIM'), ('Rheem HVAC'), 'Rheem Revit Optimizer v2.0', 'Rheem AI Platform', '${timestamp}');`);
    lines.push("FILE_SCHEMA(('IFC4'));");
    lines.push('ENDSEC;');
    
    // DATA SECTION
    lines.push('DATA;');
    
    // 1. Project with properties
    const projectRef = entityId++;
    const projectPropsRef = entityId++;
    lines.push(`#${projectRef}=IFCPROJECT('${this.generateGUID()}',#${entityId},'${projectName}','瑞美暖通BIM项目',$,$,$,(#${entityId + 1}),#${entityId + 2});`);
    
    // Project properties
    lines.push(`#${projectPropsRef}=IFCPROPERTYSET('${this.generateGUID()}',#${entityId},'PSet_ProjectCommon',$,(#${entityId + 1},#${entityId + 2},#${entityId + 3}));`);
    entityId++;
    lines.push(`#${entityId}=IFCPROPERTYSINGLEVALUE('项目编号',$,IFCIDENTIFIER('${projectId}'),$);`);
    entityId++;
    lines.push(`#${entityId}=IFCPROPERTYSINGLEVALUE('设计阶段',$,IFCIDENTIFIER('施工图设计'),$);`);
    entityId++;
    lines.push(`#${entityId}=IFCPROPERTYSINGLEVALUE('Revit版本',$,IFCIDENTIFIER('${version}'),$);`);
    entityId++;
    
    // Owner History
    const ownerHistoryRef = entityId++;
    lines.push(`#${ownerHistoryRef}=IFCOWNERHISTORY(#${entityId},#${entityId + 1},$,.ADDED.,${Date.now()},#${entityId},#${entityId + 1},${Date.now()});`);
    lines.push(`#${entityId}=IFCPERSON($,'Rheem','BIM Engineer',$,$,$,$,$);`);
    entityId++;
    lines.push(`#${entityId}=IFCORGANIZATION($,'Rheem HVAC','瑞美舒适家居',$,$);`);
    entityId++;
    
    // Units
    const unitAssignRef = entityId++;
    lines.push(`#${unitAssignRef}=IFCUNITASSIGNMENT((#${entityId},#${entityId + 1},#${entityId + 2},#${entityId + 3},#${entityId + 4},#${entityId + 5}));`);
    lines.push(`#${entityId}=IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);`);
    entityId++;
    lines.push(`#${entityId}=IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.);`);
    entityId++;
    lines.push(`#${entityId}=IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.);`);
    entityId++;
    lines.push(`#${entityId}=IFCSIUNIT(*,.THERMODYNAMICTEMPERATUREUNIT.,$,.DEGREE_CELSIUS.);`);
    entityId++;
    lines.push(`#${entityId}=IFCSIUNIT(*,.POWERUNIT.,$,.WATT.);`);
    entityId++;
    lines.push(`#${entityId}=IFCSIUNIT(*,.VOLUMETRICFLOWRATEUNIT.,$,.CUBIC_METRE_PER_SECOND.);`);
    entityId++;
    
    // Building
    const buildingRef = entityId++;
    const buildingPlacementRef = entityId++;
    lines.push(`#${buildingPlacementRef}=IFCLOCALPLACEMENT($,#${entityId});`);
    lines.push(`#${entityId}=IFCAXIS2PLACEMENT3D(#${entityId + 1},$,$);`);
    entityId++;
    lines.push(`#${entityId}=IFCCARTESIANPOINT((0.,0.,0.));`);
    entityId++;
    lines.push(`#${buildingRef}=IFCBUILDING('${this.generateGUID()}',#${ownerHistoryRef},'${buildingInfo.name || '住宅'}','${buildingInfo.description || '暖通项目建筑'}',$,#${buildingPlacementRef},$,$,$,.ELEMENT.,${buildingInfo.area || 100},0,$,$,$);`);
    
    // Building properties
    const buildingPropsRef = entityId++;
    lines.push(`#${buildingPropsRef}=IFCPROPERTYSET('${this.generateGUID()}',#${ownerHistoryRef},'PSet_BuildingCommon',$,(#${entityId},#${entityId + 1}));`);
    entityId++;
    lines.push(`#${entityId}=IFCPROPERTYSINGLEVALUE('建筑面积',$,IFCAREAMEASURE(${buildingInfo.area || 100}),$);`);
    entityId++;
    lines.push(`#${entityId}=IFCPROPERTYSINGLEVALUE('建筑类型',$,IFCIDENTIFIER('${buildingInfo.type || '住宅'}'),$);`);
    entityId++;
    
    // Storey
    const storeyRef = entityId++;
    const storeyPlacementRef = entityId++;
    lines.push(`#${storeyPlacementRef}=IFCLOCALPLACEMENT(#${buildingPlacementRef},#${entityId});`);
    lines.push(`#${entityId}=IFCAXIS2PLACEMENT3D(#${entityId + 1},$,$);`);
    entityId++;
    lines.push(`#${entityId}=IFCCARTESIANPOINT((0.,0.,0.));`);
    entityId++;
    lines.push(`#${storeyRef}=IFCBUILDINGSTOREY('${this.generateGUID()}',#${ownerHistoryRef},'F1','一层',$,#${storeyPlacementRef},$,$,$,.ELEMENT.,0.);`);
    
    // Systems with proper classification
    const systemRefs = {};
    systems.forEach((system, index) => {
      const sysRef = entityId++;
      const sysType = this.systemMapping[system.type] || this.systemMapping.hvac;
      
      lines.push(`#${sysRef}=IFCDISTRIBUTIONSYSTEM('${this.generateGUID()}',#${ownerHistoryRef},'${system.name || system.type}','${sysType.ifcType}',$,#${storeyRef},$,$);`);
      systemRefs[system.type] = sysRef;
      
      // System properties
      const sysPropsRef = entityId++;
      lines.push(`#${sysPropsRef}=IFCPROPERTYSET('${this.generateGUID()}',#${ownerHistoryRef},'PSet_MEPSystem',$,(#${entityId}));`);
      entityId++;
      lines.push(`#${entityId}=IFCPROPERTYSINGLEVALUE('系统类型',$,IFCIDENTIFIER('${system.type}'),$);`);
      entityId++;
    });
    
    // Export devices with full parameters
    const deviceRefs = [];
    devices.forEach((device, index) => {
      const deviceRef = entityId++;
      const localPlacementRef = entityId++;
      const axisPlacementRef = entityId++;
      
      // Position
      const x = (device.position?.x || 0) / 1000; // mm to m
      const y = (device.position?.y || 0) / 1000;
      const z = (device.position?.z || 2800) / 1000;
      
      lines.push(`#${axisPlacementRef}=IFCAXIS2PLACEMENT3D(#${entityId},$,$);`);
      lines.push(`#${entityId}=IFCCARTESIANPOINT((${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}));`);
      entityId++;
      lines.push(`#${localPlacementRef}=IFCLOCALPLACEMENT(#${storeyPlacementRef},#${axisPlacementRef});`);
      
      // Determine IFC type
      let ifcType = 'IFCUNITARYEQUIPMENT';
      let predefinedType = 'AIRHANDLER';
      let category = 'Mechanical Equipment';
      
      if (device.type === 'outdoor' || device.type === 'outdoorUnit') {
        ifcType = 'IFCCONDENSER';
        predefinedType = 'AIRCOOLED';
      } else if (device.type === 'indoor' || device.type === 'indoorUnit') {
        ifcType = 'IFCEVAPORATOR';
        predefinedType = 'DEHUMIDIFIER';
      } else if (device.type === 'waterHeater') {
        ifcType = 'IFCWATERHEATER';
        predefinedType = 'STORAGE';
      } else if (device.type === 'freshAirUnit') {
        ifcType = 'IFCAIRTOAIRHEATRECOVERY';
        predefinedType = 'FIXEDPLATECOUNTERFLOW';
      }
      
      lines.push(`#${deviceRef}=${ifcType}('${this.generateGUID()}',#${ownerHistoryRef},'${device.name || device.type + '_' + index}','${device.description || '瑞美暖通设备'}',$,$,#${localPlacementRef},$,${predefinedType});`);
      deviceRefs.push(deviceRef);
      
      // Device properties with full parameters
      const propsRef = entityId++;
      const propCount = 6;
      const propRefs = [];
      
      for (let i = 0; i < propCount; i++) {
        propRefs.push(`#${entityId + i}`);
      }
      
      lines.push(`#${propsRef}=IFCPROPERTYSET('${this.generateGUID()}',#${ownerHistoryRef},'PSet_MechanicalEquipmentCommon',$,(${propRefs.join(',')}));`);
      
      // Properties
      lines.push(`#${entityId}=IFCPROPERTYSINGLEVALUE('设备型号',$,IFCIDENTIFIER('${device.model || 'RH-' + device.type}'),$);`);
      entityId++;
      lines.push(`#${entityId}=IFCPROPERTYSINGLEVALUE('制冷量',$,IFCPOWERMEASURE(${device.coolingCapacity || 5000}),$);`);
      entityId++;
      lines.push(`#${entityId}=IFCPROPERTYSINGLEVALUE('制热量',$,IFCPOWERMEASURE(${device.heatingCapacity || 5600}),$);`);
      entityId++;
      lines.push(`#${entityId}=IFCPROPERTYSINGLEVALUE('额定功率',$,IFCPOWERMEASURE(${device.power || 1500}),$);`);
      entityId++;
      lines.push(`#${entityId}=IFCPROPERTYSINGLEVALUE('风量',$,IFCVOLUMETRICFLOWRATEMEASURE(${((device.airflow || 800) / 3600).toFixed(6)}),$);`);
      entityId++;
      lines.push(`#${entityId}=IFCPROPERTYSINGLEVALUE('设备编号',$,IFCIDENTIFIER('${device.id || 'RH-' + index}'),$);`);
      entityId++;
      
      // Associate properties
      lines.push(`#${entityId}=IFCRELDEFINESBYPROPERTIES('${this.generateGUID()}',#${ownerHistoryRef},$,$,(#${deviceRef}),#${propsRef});`);
      entityId++;
      
      // Assign to system
      const targetSystem = device.system || 'hvac';
      if (systemRefs[targetSystem]) {
        lines.push(`#${entityId}=IFCRELASSIGNSTOGROUP('${this.generateGUID()}',#${ownerHistoryRef},$,$,(#${deviceRef}),$,#${systemRefs[targetSystem]});`);
        entityId++;
      }
    });
    
    // Export pipes with parameters
    const pipeRefs = [];
    pipes.forEach((pipe, index) => {
      const pipeRef = entityId++;
      const localPlacementRef = entityId++;
      
      lines.push(`#${localPlacementRef}=IFCLOCALPLACEMENT(#${storeyPlacementRef},#${entityId});`);
      entityId++;
      
      const diameter = pipe.diameter || 25;
      const length = pipe.length || 1000;
      const material = pipe.material || 'Copper';
      const pipeType = pipe.type || 'CHILLEDWATER';
      
      lines.push(`#${pipeRef}=IFCPIPESEGMENT('${this.generateGUID()}',#${ownerHistoryRef},'${pipe.name || 'Pipe_' + index}','${material}管段',$,#${localPlacementRef},$,$,${pipeType});`);
      pipeRefs.push(pipeRef);
      
      // Pipe properties
      const pipePropsRef = entityId++;
      lines.push(`#${pipePropsRef}=IFCPROPERTYSET('${this.generateGUID()}',#${ownerHistoryRef},'PSet_PipeSegmentOccurrence',$,(#${entityId},#${entityId + 1},#${entityId + 2}));`);
      entityId++;
      lines.push(`#${entityId}=IFCPROPERTYSINGLEVALUE('公称直径',$,IFCPOSITIVELENGTHMEASURE(${diameter / 1000}),$);`);
      entityId++;
      lines.push(`#${entityId}=IFCPROPERTYSINGLEVALUE('长度',$,IFCPOSITIVELENGTHMEASURE(${length / 1000}),$);`);
      entityId++;
      lines.push(`#${entityId}=IFCPROPERTYSINGLEVALUE('材质',$,IFCIDENTIFIER('${material}'),$);`);
      entityId++;
      
      // Geometry representation
      const startX = (pipe.start?.x || 0) / 1000;
      const startY = (pipe.start?.y || 0) / 1000;
      const startZ = (pipe.start?.z || 2500) / 1000;
      const endX = (pipe.end?.x || startX + length/1000);
      const endY = (pipe.end?.y || startY);
      const endZ = (pipe.end?.z || startZ);
      
      const polylineRef = entityId++;
      const startPointRef = entityId++;
      const endPointRef = entityId++;
      
      lines.push(`#${startPointRef}=IFCCARTESIANPOINT((${startX.toFixed(4)},${startY.toFixed(4)},${startZ.toFixed(4)}));`);
      lines.push(`#${endPointRef}=IFCCARTESIANPOINT((${endX.toFixed(4)},${endY.toFixed(4)},${endZ.toFixed(4)}));`);
      lines.push(`#${polylineRef}=IFCPOLYLINE((#${startPointRef},#${endPointRef}));`);
      
      // Assign to system
      const targetSystem = pipe.system || 'hvac';
      if (systemRefs[targetSystem]) {
        lines.push(`#${entityId}=IFCRELASSIGNSTOGROUP('${this.generateGUID()}',#${ownerHistoryRef},$,$,(#${pipeRef}),$,#${systemRefs[targetSystem]});`);
        entityId++;
      }
    });
    
    // Spatial relationships
    const allElements = [...deviceRefs, ...pipeRefs];
    if (allElements.length > 0) {
      lines.push(`#${entityId}=IFCRELCONTAINEDINSPATIALSTRUCTURE('${this.generateGUID()}',#${ownerHistoryRef},$,$,(${allElements.map(e => `#${e}`).join(',')}),#${storeyRef});`);
      entityId++;
    }
    
    // RelAggregates: Building → Storey
    lines.push(`#${entityId}=IFCRELAGGREGATES('${this.generateGUID()}',#${ownerHistoryRef},'BuildingStorey','',#${buildingRef},(#${storeyRef}));`);
    entityId++;
    
    // Project → Building
    lines.push(`#${entityId}=IFCRELAGGREGATES('${this.generateGUID()}',#${ownerHistoryRef},'ProjectBuilding','',#${projectRef},(#${buildingRef}));`);
    entityId++;
    
    lines.push('ENDSEC;');
    lines.push('END-ISO-10303-21;');
    
    const ifcContent = lines.join('\n');
    
    return {
      format: 'IFC',
      version: 'IFC4',
      revitVersion: version,
      schema: 'IFC4.0.2.1',
      mvd: 'CoordinationView_V2.0 + MEPView + GeneralUsage',
      filename: `${projectName}_Revit${version}_${Date.now()}.ifc`,
      content: ifcContent,
      size: ifcContent.length,
      entities: this.countEntities(ifcContent),
      statistics: {
        devices: devices.length,
        pipes: pipes.length,
        systems: systems.length,
        properties: entityId - 1
      },
      optimization: {
        parameters: true,
        systems: true,
        geometry: true,
        colors: true
      },
      revitTips: this.generateRevitTips(version),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 生成Revit导入提示
   */
  generateRevitTips(version) {
    return {
      beforeImport: [
        `确保Revit ${version}已安装最新IFC导入插件`,
        '在Revit中创建新项目或打开现有项目',
        '建议使用项目模板包含MEP系统浏览器'
      ],
      importSteps: [
        '点击插入 > 导入 > IFC',
        `选择本文件: ${this.filename}`,
        '在导入选项中勾选"创建新的项目参数"',
        '确保"导入元素的几何"已勾选',
        '点击确定开始导入'
      ],
      afterImport: [
        '在系统浏览器中查看导入的MEP系统',
        '检查设备参数是否正确映射到Revit参数',
        '验证管路系统连接关系',
        '如有需要，运行"复制/监视"工具协调链接模型'
      ],
      troubleshooting: [
        '如设备未显示，检查视图范围和可见性设置',
        '如系统未连接，检查IFC中的端口定义',
        '如参数缺失，确认IFC包含PSet_MechanicalEquipmentCommon',
        '大型文件导入可能需要较长时间，请耐心等待'
      ]
    };
  }

  /**
   * 获取匹配的设备族
   */
  getMatchingFamily(deviceSpecs, category) {
    const families = this.familyLibrary[category] || [];
    
    // 根据容量匹配
    if (deviceSpecs.coolingCapacity) {
      return families.find(f => 
        f.params?.coolingCapacity >= deviceSpecs.coolingCapacity * 0.9 &&
        f.params?.coolingCapacity <= deviceSpecs.coolingCapacity * 1.1
      ) || families[0];
    }
    
    return families[0];
  }

  /**
   * 导出Revit参数到平台
   */
  exportRevitParameters(revitData) {
    const { elements, parameters, projectInfo } = revitData;
    
    const exportedDevices = elements.map(element => {
      const mappedParams = {};
      
      // 映射参数
      Object.entries(parameters[element.id] || {}).forEach(([revitParam, value]) => {
        const platformParam = this.parameterMapping.fromRevit[revitParam];
        if (platformParam) {
          mappedParams[platformParam] = value;
        }
      });
      
      return {
        id: element.id,
        type: this.mapRevitCategoryToPlatform(element.category),
        name: element.name,
        position: element.position,
        parameters: mappedParams,
        revitUniqueId: element.uniqueId
      };
    });
    
    return {
      project: projectInfo,
      devices: exportedDevices,
      syncTimestamp: new Date(),
      mappingRules: this.parameterMapping.fromRevit
    };
  }

  /**
   * 映射Revit类别到平台类型
   */
  mapRevitCategoryToPlatform(category) {
    const mapping = {
      '机械设备': 'mechanical',
      '机械设备': 'mechanical',
      '管道': 'piping',
      '风管': 'duct',
      '管件': 'fitting',
      '风管件': 'ductFitting'
    };
    
    return mapping[category] || 'mechanical';
  }

  /**
   * 模型版本对比
   */
  compareModels(oldModel, newModel) {
    const changes = {
      added: [],
      removed: [],
      modified: [],
      unchanged: []
    };
    
    const oldElements = new Map(oldModel.devices.map(d => [d.id, d]));
    const newElements = new Map(newModel.devices.map(d => [d.id, d]));
    
    // 检测新增
    newModel.devices.forEach(device => {
      if (!oldElements.has(device.id)) {
        changes.added.push(device);
      }
    });
    
    // 检测删除
    oldModel.devices.forEach(device => {
      if (!newElements.has(device.id)) {
        changes.removed.push(device);
      }
    });
    
    // 检测修改
    newModel.devices.forEach(newDevice => {
      const oldDevice = oldElements.get(newDevice.id);
      if (oldDevice) {
        const diff = this.compareDevice(oldDevice, newDevice);
        if (diff.hasChanges) {
          changes.modified.push({
            device: newDevice,
            changes: diff.changes
          });
        } else {
          changes.unchanged.push(newDevice);
        }
      }
    });
    
    return {
      summary: {
        totalOld: oldModel.devices.length,
        totalNew: newModel.devices.length,
        added: changes.added.length,
        removed: changes.removed.length,
        modified: changes.modified.length
      },
      changes
    };
  }

  /**
   * 对比两个设备
   */
  compareDevice(oldDevice, newDevice) {
    const changes = [];
    const ignoreFields = ['timestamp', 'revitUniqueId'];
    
    const compareRecursive = (oldObj, newObj, path = '') => {
      Object.keys(newObj).forEach(key => {
        if (ignoreFields.includes(key)) return;
        
        const currentPath = path ? `${path}.${key}` : key;
        const oldVal = oldObj?.[key];
        const newVal = newObj[key];
        
        if (typeof newVal === 'object' && newVal !== null) {
          compareRecursive(oldVal, newVal, currentPath);
        } else if (oldVal !== newVal) {
          changes.push({
            field: currentPath,
            old: oldVal,
            new: newVal
          });
        }
      });
    };
    
    compareRecursive(oldDevice, newDevice);
    
    return {
      hasChanges: changes.length > 0,
      changes
    };
  }

  /**
   * 冲突检测
   */
  detectConflicts(modelA, modelB) {
    const conflicts = [];
    
    // 空间冲突检测
    modelA.devices.forEach(deviceA => {
      modelB.devices.forEach(deviceB => {
        const distance = this.calculateDistance(deviceA.position, deviceB.position);
        if (distance < 500) { // 500mm内认为是冲突
          conflicts.push({
            type: 'spatial',
            severity: distance < 200 ? 'high' : 'medium',
            elementA: deviceA,
            elementB: deviceB,
            distance,
            message: `${deviceA.name} 与 ${deviceB.name} 空间冲突，距离 ${distance.toFixed(0)}mm`
          });
        }
      });
    });
    
    // 系统连接冲突
    // ...
    
    return {
      totalConflicts: conflicts.length,
      highSeverity: conflicts.filter(c => c.severity === 'high').length,
      mediumSeverity: conflicts.filter(c => c.severity === 'medium').length,
      lowSeverity: conflicts.filter(c => c.severity === 'low').length,
      conflicts
    };
  }

  /**
   * 计算两点距离
   */
  calculateDistance(pos1, pos2) {
    const dx = (pos1.x || 0) - (pos2.x || 0);
    const dy = (pos1.y || 0) - (pos2.y || 0);
    const dz = (pos1.z || 0) - (pos2.z || 0);
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  }

  /**
   * 生成GUID
   */
  generateGUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16).toUpperCase();
    });
  }

  /**
   * 统计实体数量
   */
  countEntities(content) {
    const matches = content.match(/^#\d+=IFC/g);
    return matches ? matches.length : 0;
  }
}

module.exports = RevitIntegrationEngine;
