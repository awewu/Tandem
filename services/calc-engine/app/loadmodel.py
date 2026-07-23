"""Rhautt Nexus · 内置暖通负荷"筛选估算"模型（零依赖，纯标准库）

目的：当高保真库 (hvacpy / ASHRAE HOF) 不可用时，仍能给出**透明、可复算**的
负荷估算，而不是只返回占位。本模型刻意简化，定位为**方案前期筛选估算**，
trust_level = "estimate"——不等同于可溯源的 "verified"，不得直接喂 M15 门禁。

方法（稳态包络 + 通风 + 内扰，单位统一为 W）：
  envelope_W = U_avg * shell_area * ΔT
  vent_W     = 0.34 * V(m³/h) * ΔT        # 0.34 ≈ 空气体积比热(Wh/m³·K)
  internal_W = 人员显热 + 设备照明(W/m²·面积)  # 仅计入制冷
所有系数、ΔT、假设都随结果一并返回，便于审阅与回算。

参考量级：ASHRAE Fundamentals（包络/通风稳态法）、ASHRAE 62.1 通风量级。
系数为工程筛选缺省值，正式设计须用可溯源工具（hvacpy/逐时模拟）复核。
"""
from typing import Any, Dict

# 室内设计温度（°C）
INDOOR_HEATING_C = 20.0
INDOOR_COOLING_C = 26.0

# 城市气象设计温度（°C）：winter/summer 室外设计干球（筛选量级，可替换为权威气象库）
CLIMATE: Dict[str, Dict[str, float]] = {
    "harbin":    {"winter": -24.0, "summer": 30.0},
    "beijing":   {"winter": -9.0,  "summer": 33.0},
    "tianjin":   {"winter": -7.0,  "summer": 33.0},
    "xian":      {"winter": -5.0,  "summer": 35.0},
    "shanghai":  {"winter": -2.0,  "summer": 35.0},
    "nanjing":   {"winter": -4.0,  "summer": 35.0},
    "wuhan":     {"winter": -2.0,  "summer": 36.0},
    "chengdu":   {"winter": 1.0,   "summer": 32.0},
    "chongqing": {"winter": 4.0,   "summer": 37.0},
    "hangzhou":  {"winter": -2.0,  "summer": 36.0},
    "changsha":  {"winter": 0.0,   "summer": 36.0},
    "qingdao":   {"winter": -5.0,  "summer": 30.0},
    "guangzhou": {"winter": 8.0,   "summer": 35.0},
    "shenzhen":  {"winter": 10.0,  "summer": 34.0},
}
DEFAULT_CLIMATE = {"winter": -5.0, "summer": 34.0}

# 建筑类型缺省参数
BUILDING: Dict[str, Dict[str, float]] = {
    # u_avg: 包络平均传热系数 W/m²K | shell_factor: 包络面积/楼面积
    # equip_wm2: 设备+照明显热 W/m² | base_ach: 基础换气次数 1/h | occ_sensible_w: 人均显热 W
    "residential": {"u_avg": 1.1, "shell_factor": 2.6, "equip_wm2": 15.0, "base_ach": 0.5, "occ_sensible_w": 110.0},
    "office":      {"u_avg": 1.0, "shell_factor": 2.2, "equip_wm2": 25.0, "base_ach": 0.6, "occ_sensible_w": 75.0},
    "commercial":  {"u_avg": 1.2, "shell_factor": 2.0, "equip_wm2": 30.0, "base_ach": 0.8, "occ_sensible_w": 75.0},
}

VENT_PER_PERSON_M3H = 30.0   # ASHRAE 62.1 量级（人均新风 m³/h）
AIR_VOL_HEAT = 0.34          # 空气体积比热 Wh/(m³·K)


def _round(x: float, n: int = 2) -> float:
    return round(float(x), n)


def screening_load(
    area_m2: float,
    ceiling_height_m: float = 3.0,
    city: str = "beijing",
    building_type: str = "residential",
    occupants: int = 0,
) -> Dict[str, Any]:
    """返回包含分项明细、总负荷与全部假设的负荷估算字典。"""
    if area_m2 <= 0 or ceiling_height_m <= 0:
        raise ValueError("area_m2 与 ceiling_height_m 必须为正数")

    bt = BUILDING.get(building_type, BUILDING["residential"])
    clim = CLIMATE.get(city.strip().lower(), DEFAULT_CLIMATE)

    dt_heating = INDOOR_HEATING_C - clim["winter"]      # 冬季室内外温差
    dt_cooling = clim["summer"] - INDOOR_COOLING_C      # 夏季室内外温差
    dt_cooling = max(dt_cooling, 0.0)

    shell_area = area_m2 * bt["shell_factor"]
    volume_m3 = area_m2 * ceiling_height_m

    # 通风量：人均新风与基础换气取大者
    vent_m3h = max(occupants * VENT_PER_PERSON_M3H, volume_m3 * bt["base_ach"])

    # ── 采暖（不计内扰，偏保守）──
    env_h = bt["u_avg"] * shell_area * dt_heating
    vent_h = AIR_VOL_HEAT * vent_m3h * dt_heating
    heating_w = env_h + vent_h

    # ── 制冷（包络 + 通风 + 内扰）──
    env_c = bt["u_avg"] * shell_area * dt_cooling
    vent_c = AIR_VOL_HEAT * vent_m3h * dt_cooling
    internal_c = occupants * bt["occ_sensible_w"] + area_m2 * bt["equip_wm2"]
    cooling_w = env_c + vent_c + internal_c

    return {
        "cooling_load_kw": _round(cooling_w / 1000.0),
        "heating_load_kw": _round(heating_w / 1000.0),
        "breakdown_kw": {
            "heating_envelope": _round(env_h / 1000.0),
            "heating_ventilation": _round(vent_h / 1000.0),
            "cooling_envelope": _round(env_c / 1000.0),
            "cooling_ventilation": _round(vent_c / 1000.0),
            "cooling_internal": _round(internal_c / 1000.0),
        },
        "assumptions": {
            "indoor_heating_c": INDOOR_HEATING_C,
            "indoor_cooling_c": INDOOR_COOLING_C,
            "outdoor_winter_c": clim["winter"],
            "outdoor_summer_c": clim["summer"],
            "delta_t_heating_k": dt_heating,
            "delta_t_cooling_k": dt_cooling,
            "u_avg_w_m2k": bt["u_avg"],
            "shell_factor": bt["shell_factor"],
            "shell_area_m2": _round(shell_area),
            "ventilation_m3h": _round(vent_m3h),
            "equip_lighting_w_m2": bt["equip_wm2"],
            "city_matched": city.strip().lower() in CLIMATE,
        },
        "method": "Built-in steady-state screening (envelope + ventilation + internal gains)",
        "intensity_w_m2": {
            "heating": _round(heating_w / area_m2),
            "cooling": _round(cooling_w / area_m2),
        },
    }
