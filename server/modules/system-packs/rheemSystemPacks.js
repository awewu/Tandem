const REQUIRED_STANDARDS_COVERAGE_DOMAINS = [
  'thermal-comfort',
  'ventilation-iaq',
  'hot-water-safety',
  'potable-water',
  'energy',
  'smart-interoperability'
];

const RHEEM_SYSTEM_PACKS = [
  {
    id: 'rheem-central-hot-water',
    name: 'Rheem 中央热水系统',
    category: 'hot_water',
    plugAndPlayRole: 'anchor',
    positioning: '面向别墅、大平层和多卫家庭的全屋稳定热水与零冷水体验',
    recommendedFor: ['villa', 'large_flat', 'multi_bathroom', 'bathtub', 'high_hot_water_demand'],
    painPoints: ['hot_water_waiting', 'temperature_fluctuation', 'bathtub_not_full', 'multi_point_hot_water'],
    requiredInputs: ['city', 'houseType', 'area', 'occupants', 'bathrooms', 'bathtub', 'hotWaterPoints'],
    standards: [
      { level: 'L1', code: 'GB 55020', edition: '2021', name: '建筑给水排水与节水通用规范', scope: '节水、给排水、生活热水、验收与运维强制底线', softwareCheck: 'mandatoryBlocker' },
      { level: 'L1', code: 'GB 5749', edition: '2022', name: '生活饮用水卫生标准', scope: '涉生活饮用水水质卫生底线', softwareCheck: 'mandatoryBlocker' },
      { level: 'L2', code: 'GB 50015', edition: '2019', name: '建筑给水排水设计标准', scope: '热水用水量、管网、循环与安全设计细化', softwareCheck: 'calculationRule' },
      { level: 'L2', code: 'GB 50242', edition: '2002', name: '建筑给水排水及采暖工程施工质量验收规范', scope: '施工验收', softwareCheck: 'acceptanceChecklist' },
      { level: 'L3', code: 'ASHRAE 188', edition: '2018', name: 'Legionellosis Risk Management', scope: '集中热水军团菌风险管理参考', softwareCheck: 'advisoryOptimization' }
    ],
    standardsCoverage: [
      {
        domain: 'hot-water-safety',
        requiredFor: ['central-hot-water', 'zero-cold-water', 'multi-bathroom'],
        primaryStandards: ['GB 55020', 'GB 50015', 'GB 50242', 'ASHRAE 188'],
        softwareChecks: ['hotWaterLoad', 'storageRecovery', 'circulationLoop', 'antiScald', 'acceptanceChecklist'],
        deliverableEvidence: ['热水负荷计算', '热水管路与循环策略', '施工交付清单'],
        quoteImpact: ['热源容量', '水箱容量', '循环泵', '保温管材', '恒温/防烫附件'],
        lifecycleHandoffImpact: ['water_temperature', 'tank_temperature', 'circulation_schedule', 'fault_alert']
      },
      {
        domain: 'potable-water',
        requiredFor: ['domestic-hot-water', 'water-contact-equipment'],
        primaryStandards: ['GB 5749', 'GB 55020'],
        softwareChecks: ['potableWaterRisk', 'deviceMaterialCompatibility', 'maintenanceInterval'],
        deliverableEvidence: ['涉水设备卫生合规说明', 'IoT 热水设备绑定清单'],
        quoteImpact: ['涉水材料', '过滤/软化预留', '维护耗材'],
        lifecycleHandoffImpact: ['maintenance_reminder', 'service_ticket']
      }
    ],
    modules: ['hotWaterLoad', 'heaterSelection', 'storageTank', 'circulationLoop', 'pipeSizing', 'antiScald', 'servicePlan'],
    deliverables: ['热水负荷计算', '主机/水箱/循环泵选型', '热水管路与循环策略', '施工交付清单', 'IoT 热水设备绑定清单'],
    iotCapabilities: ['water_temperature', 'tank_temperature', 'circulation_schedule', 'energy', 'fault_alert'],
    attachableTo: ['rheem-heating', 'rheem-whole-air', 'rheem-smart-control'],
    quoteTags: ['central_hot_water', 'zero_cold_water', 'rheem_anchor']
  },
  {
    id: 'rheem-heating',
    name: 'Rheem 采暖系统',
    category: 'heating',
    plugAndPlayRole: 'anchor',
    positioning: '面向冬季舒适、地暖/暖气片/热泵采暖的一体化热源与末端方案',
    recommendedFor: ['cold_winter', 'elderly_family', 'children_family', 'villa', 'comfort_upgrade'],
    painPoints: ['cold_rooms', 'uneven_heating', 'dry_winter', 'high_heating_cost'],
    requiredInputs: ['city', 'area', 'floorArea', 'insulation', 'floors', 'terminalPreference', 'heatSource'],
    standards: [
      { level: 'L1', code: 'GB 55015', edition: '2021', name: '建筑节能与可再生能源利用通用规范', scope: '节能、热源效率与可再生能源强制底线', softwareCheck: 'mandatoryBlocker' },
      { level: 'L2', code: 'GB 50736', edition: '2012', name: '民用建筑供暖通风与空气调节设计规范', scope: '采暖热负荷与室内设计参数细化参考', softwareCheck: 'calculationRule' },
      { level: 'L2', code: 'JGJ 142', edition: '2012', name: '辐射供暖供冷技术规程', scope: '地暖/辐射末端设计', softwareCheck: 'calculationRule' },
      { level: 'L3', code: 'ASHRAE 55', edition: '2023', name: 'Thermal Environmental Conditions', scope: '热舒适评价参考', softwareCheck: 'advisoryOptimization' }
    ],
    standardsCoverage: [
      {
        domain: 'thermal-comfort',
        requiredFor: ['heating', 'underfloor-heating', 'radiator', 'zone-control'],
        primaryStandards: ['GB 50736', 'JGJ 142', 'ASHRAE 55'],
        softwareChecks: ['heatingLoad', 'terminalSizing', 'supplyReturnTemperature', 'hydraulicBalance', 'zoneControl'],
        deliverableEvidence: ['采暖热负荷计算', '热源和末端选型', '地暖盘管/暖气片配置', '分区控制策略'],
        quoteImpact: ['热源容量', '末端数量', '分集水器', '温控器', '水力平衡附件'],
        lifecycleHandoffImpact: ['zone_temperature', 'supply_return_temperature', 'heating_mode', 'schedule']
      },
      {
        domain: 'energy',
        requiredFor: ['heating', 'renewable-energy', 'seasonal-efficiency'],
        primaryStandards: ['GB 55015'],
        softwareChecks: ['heatSourceEfficiency', 'seasonalEnergyEstimate', 'insulationAssumption'],
        deliverableEvidence: ['热源效率与能耗说明', '分区控制策略'],
        quoteImpact: ['高效热源', '节能控制', '保温升级建议'],
        lifecycleHandoffImpact: ['energy', 'schedule']
      }
    ],
    modules: ['heatingLoad', 'heatSourceSelection', 'underfloorLoop', 'radiatorSizing', 'hydraulicBalance', 'zoneControl'],
    deliverables: ['采暖热负荷计算', '热源和末端选型', '地暖盘管/暖气片配置', '分区控制策略', 'IoT 温控分区清单'],
    iotCapabilities: ['zone_temperature', 'supply_return_temperature', 'heating_mode', 'schedule', 'energy'],
    attachableTo: ['rheem-central-hot-water', 'rheem-whole-air', 'rheem-smart-control'],
    quoteTags: ['heating', 'zone_control', 'rheem_anchor']
  },
  {
    id: 'rheem-whole-air',
    name: 'Rheem 全空气系统',
    category: 'whole_air',
    plugAndPlayRole: 'anchor',
    positioning: '面向高端住宅的温度、湿度、新风、过滤、静音与全空气舒适体验',
    recommendedFor: ['premium_home', 'villa', 'large_flat', 'fresh_air_priority', 'humidity_control', 'quiet_comfort'],
    painPoints: ['poor_air_quality', 'humidity_issue', 'ac_draft', 'noise', 'temperature_difference'],
    requiredInputs: ['city', 'area', 'rooms', 'occupants', 'envelopeLevel', 'freshAirDemand', 'humidityDemand'],
    standards: [
      { level: 'L1', code: 'GB 55015', edition: '2021', name: '建筑节能与可再生能源利用通用规范', scope: '空调、通风、能效与可再生能源强制底线', softwareCheck: 'mandatoryBlocker' },
      { level: 'L2', code: 'GB 50736', edition: '2012', name: '民用建筑供暖通风与空气调节设计规范', scope: '空调负荷、新风与室内设计参数细化参考', softwareCheck: 'calculationRule' },
      { level: 'L2', code: 'GB/T 18883', edition: '2022', name: '室内空气质量标准', scope: '室内空气质量目标', softwareCheck: 'calculationRule' },
      { level: 'L2', code: 'GB 50243', edition: '2016', name: '通风与空调工程施工质量验收规范', scope: '风管与设备施工验收', softwareCheck: 'acceptanceChecklist' },
      { level: 'L3', code: 'ASHRAE 62.1/62.2', edition: '2022', name: 'Ventilation for Acceptable Indoor Air Quality', scope: '通风量与 IAQ 参考', softwareCheck: 'advisoryOptimization' },
      { level: 'L3', code: 'ASHRAE 55', edition: '2023', name: 'Thermal Environmental Conditions', scope: '热舒适参考', softwareCheck: 'advisoryOptimization' }
    ],
    standardsCoverage: [
      {
        domain: 'thermal-comfort',
        requiredFor: ['whole-air', 'air-conditioning', 'humidity-control'],
        primaryStandards: ['GB 55015', 'GB 50736', 'ASHRAE 55'],
        softwareChecks: ['coolingHeatingLoad', 'latentLoad', 'humidityTarget', 'airDistribution'],
        deliverableEvidence: ['冷热负荷计算', '新风/除湿/过滤配置', '风管与末端方案'],
        quoteImpact: ['全空气主机', '除湿模块', '风口/末端', '静压配置'],
        lifecycleHandoffImpact: ['temperature', 'humidity', 'fan_speed', 'mode']
      },
      {
        domain: 'ventilation-iaq',
        requiredFor: ['fresh-air', 'doas', 'filtration', 'iaq-monitoring'],
        primaryStandards: ['GB 50736', 'GB/T 18883', 'GB 50243', 'ASHRAE 62.1/62.2'],
        softwareChecks: ['freshAirVolume', 'filtration', 'ductStaticPressure', 'noiseControl', 'commissioningChecklist'],
        deliverableEvidence: ['新风/除湿/过滤配置', '噪音与静压校核', 'IoT 空气质量设备绑定清单'],
        quoteImpact: ['新风量', '过滤等级', '风管材料', '消音附件', '传感器点位'],
        lifecycleHandoffImpact: ['co2', 'pm25', 'filter_life', 'alert']
      },
      {
        domain: 'energy',
        requiredFor: ['whole-air', 'heat-recovery', 'energy-visibility'],
        primaryStandards: ['GB 55015'],
        softwareChecks: ['equipmentEfficiency', 'heatRecoveryAssumption', 'energyDashboardBinding'],
        deliverableEvidence: ['冷热负荷计算', '能效与运行策略说明'],
        quoteImpact: ['高效主机', '热回收模块', '能耗监测'],
        lifecycleHandoffImpact: ['energy', 'schedule']
      }
    ],
    modules: ['coolingHeatingLoad', 'freshAirVolume', 'dehumidification', 'filtration', 'ductStaticPressure', 'noiseControl', 'airDistribution'],
    deliverables: ['冷热负荷计算', '新风/除湿/过滤配置', '风管与末端方案', '噪音与静压校核', 'IoT 空气质量设备绑定清单'],
    iotCapabilities: ['temperature', 'humidity', 'co2', 'pm25', 'fan_speed', 'mode', 'filter_life', 'energy'],
    attachableTo: ['rheem-central-hot-water', 'rheem-heating', 'rheem-smart-control'],
    quoteTags: ['whole_air', 'iaq', 'premium_comfort', 'rheem_anchor']
  },
  {
    id: 'rheem-smart-control',
    name: 'Rheem 智能控制系统',
    category: 'smart_control',
    plugAndPlayRole: 'cross_cutting',
    positioning: '横向植入热水、采暖、全空气系统的统一控制、场景联动与全生命周期 IoT 接管能力',
    recommendedFor: ['multi_system', 'iot_ready', 'remote_control', 'energy_visibility', 'after_sales_care'],
    painPoints: ['too_many_controls', 'no_energy_visibility', 'maintenance_unknown', 'remote_care_needed'],
    requiredInputs: ['systems', 'zones', 'devices', 'networkAvailability', 'homeownerAccount'],
    standards: [
      { level: 'L1', code: 'GB/T 22239', edition: '2019', name: '网络安全等级保护基本要求', scope: '平台安全基线', softwareCheck: 'mandatoryBlocker' },
      { level: 'L3', code: 'IEC 62443', edition: 'current', name: 'Industrial Automation And Control Systems Security', scope: '控制系统安全参考', softwareCheck: 'advisoryOptimization' },
      { level: 'L3', code: 'ASHRAE 135', edition: 'current', name: 'BACnet', scope: '楼宇控制互操作参考', softwareCheck: 'advisoryOptimization' },
      { level: 'L3', code: 'Matter', edition: '1.5', name: 'Smart home interoperability', scope: '设备接入、互操作、能源管理与生命周期能力交换参考', softwareCheck: 'advisoryOptimization' },
      { level: 'L3', code: 'MQTT', edition: '5.0', name: 'IoT messaging', scope: '设备消息互联参考', softwareCheck: 'advisoryOptimization' }
    ],
    standardsCoverage: [
      {
        domain: 'smart-interoperability',
        requiredFor: ['device-binding', 'lifecycle-handoff', 'remote-service', 'energy-visibility'],
        primaryStandards: ['GB/T 22239', 'IEC 62443', 'ASHRAE 135', 'Matter', 'MQTT'],
        softwareChecks: ['deviceBinding', 'permission', 'capabilityRegistry', 'energyDashboard', 'lifecycleHandover'],
        deliverableEvidence: ['智能控制点表', 'IoT 设备绑定清单', '业主账号接管计划', '售后运维规则'],
        quoteImpact: ['网关/控制器', '传感器点位', '远程运维服务', '能耗监测服务'],
        lifecycleHandoffImpact: ['remote_control', 'scene', 'alert', 'energy', 'ota', 'service_ticket']
      }
    ],
    modules: ['deviceBinding', 'sceneControl', 'permission', 'energyDashboard', 'faultAlert', 'maintenanceReminder', 'lifecycleHandover'],
    deliverables: ['智能控制点表', 'IoT 设备绑定清单', '业主账号接管计划', '售后运维规则', '能耗与告警策略'],
    iotCapabilities: ['remote_control', 'scene', 'schedule', 'alert', 'energy', 'ota', 'service_ticket'],
    attachableTo: ['rheem-central-hot-water', 'rheem-heating', 'rheem-whole-air'],
    quoteTags: ['smart_control', 'iot_handover', 'life_cycle_care']
  }
];

module.exports = {
  RHEEM_SYSTEM_PACKS,
  REQUIRED_STANDARDS_COVERAGE_DOMAINS
};
