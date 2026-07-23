---
name: hvac-calc
description: HVAC engineering calculations for 瑞诺瓦AI舒适家. Use when implementing heating load, cooling load, fresh air, pipe sizing, floor heating, or energy efficiency calculations.
---

# HVAC Calculation Standards — 瑞诺瓦AI舒适家

## Standards Reference
- **GB 50736-2012** — 民用建筑供暖通风与空调设计规范（主标准）
- **GB 50015-2019** — 建筑给水排水设计标准（热水）
- **AHRI 210/240** — 住宅热泵/空调能效（SEER2/HSPF2/EER）
- **AHRI 920** — DOAS 专用机组能效（ISMRE/ISCOP/IEER）
- **ASHRAE 62.1** — 通风新风量标准

## Key Engines (already implemented)
```
server/core/ChinaClimateDB.js     — GB50736附录A，33城市干球/湿球/焓值
server/core/HydraulicEngine.js    — Darcy-Weisbach压降，管径选型，泵扬程
apps/dealer-workbench/src/lib/floorheat.ts  — 2D有限差分地暖热分布
apps/dealer-workbench/src/lib/hydraulic.ts  — 客户端液压求解器
apps/dealer-workbench/src/lib/cfd.ts        — Stable Fluids气流仿真
```

## Critical Formulas

### Heating Load (GB 50736)
```
Q_room = Σ(K_i × A_i × ΔT) + Q_infiltration
ΔT = T_indoor(20°C) - T_outdoor_design (from ChinaClimateDB)
Heat index: 严寒80-100 / 寒冷60-80 / 夏热冬冷40-60 W/m²
```

### Hot Water (GB 50015)
```
Q_day = m × q0   (q0=60L/人日@60°C)
q_h = Q_day/24 × Kh  (Kh=4.2 住宅)
HP power = m×q0×ρ×Cp×ΔT / (86400 × COP)
```

### Fresh Air (GB 50736)
```
Bedroom/Living: 30 m³/h·person
換气次数法: V_room × 0.5~1.0 次/h → take max
```

### Pipe Sizing (HydraulicEngine)
```
D = √(4Q/πv)   v_ideal: heating=0.8m/s, main=1.2m/s
ΔP = λ(L/D)(ρv²/2)   λ: 层流=64/Re, 紊流=0.3164/Re^0.25
```

### Floor Heating Surface Temp (GB 50736)
```
Target: 26~29°C average, peak ≤ 30°C (人员长期停留区)
Supply temp: 35~45°C (低温辐射)
Pipe spacing: 100/150/200mm
```

### AHRI Energy Ratings
| Product | Standard | Metric | Min |
|---------|---------|--------|-----|
| 住宅热泵 | AHRI 210/240 | SEER2 ≥ 15 | HSPF2 ≥ 8.8 |
| DOAS | AHRI 920 | IEER ≥ 14.0 | ISMRE ≥ 10.5 |

## DB: Products with Energy Data
```sql
SELECT sku, name, energy_ratings FROM products WHERE energy_ratings != '{}';
-- energy_ratings JSONB: {"seer2":17.4,"hspf2":9.2,"cop_47":4.2,"standard":"AHRI_210_240"}
```
