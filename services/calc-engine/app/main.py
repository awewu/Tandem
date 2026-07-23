"""Rhautt Nexus · 精算微服务 (calc-engine)

ASHRAE 可溯源暖通负荷计算，产出带出处的计算单，喂 M15 `dataTrustLevel=verified` 门禁。

Runtime: Python >= 3.10（hvacpy 0.4.1 要求）。
本机系统 Python 3.9 仅可做语法校验；运行请用 Docker(python:3.11) 或 venv(3.10+)。

License: hvacpy = MIT；本服务作为独立微服务，经 REST/事件总线与 NestJS 交互，
不把 GPL/AGPL 引入闭源主干（符合风险闸）。
"""
from typing import Any, Dict, List, Optional

from fastapi import FastAPI
from pydantic import BaseModel, Field

from .loadmodel import screening_load

app = FastAPI(title="Rhautt Nexus Calc Engine", version="0.1.0")

# 计算方法出处（随 hvacpy 引用的 ASHRAE 章节）
PROVENANCE: Dict[str, Any] = {
    "library": "hvacpy",
    "standard": "ASHRAE HOF 2021",
    "methods": {
        "cooling": "Ch.28 CLTD/CLF",
        "heating": "Ch.18",
        "psychrometrics": "Ch.14",
        "ventilation": "ASHRAE 62.1-2022",
    },
}


class LoadRequest(BaseModel):
    area_m2: float = Field(..., gt=0, description="建筑面积 (㎡)")
    ceiling_height_m: float = Field(3.0, gt=0, description="层高 (m)")
    city: str = Field("beijing", description="气候城市（hvacpy 内置气象）")
    building_type: str = Field("residential", description="residential/office/commercial")
    occupants: int = Field(0, ge=0, description="人数（内扰）")


class LoadResponse(BaseModel):
    cooling_load_kw: Optional[float] = None
    heating_load_kw: Optional[float] = None
    method: str
    provenance: Dict[str, Any]
    # 对接 M15：verified=可源追溯精算，可入门禁；estimate=内置筛选估算，仅供参考；
    # unverified=无法计算。仅 verified 可放行。
    trust_level: str
    breakdown_kw: Optional[Dict[str, float]] = None
    assumptions: Optional[Dict[str, Any]] = None
    intensity_w_m2: Optional[Dict[str, float]] = None
    warnings: List[str] = []


def _hvacpy_available() -> bool:
    try:
        import hvacpy  # noqa: F401
        return True
    except Exception:
        return False


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "hvacpy": _hvacpy_available(), "provenance": PROVENANCE}


@app.post("/v1/load-calc", response_model=LoadResponse)
def load_calc(req: LoadRequest) -> LoadResponse:
    """ASHRAE 可溯源负荷计算。hvacpy 不可用时降级为内置稳态筛选估算（trust=estimate，不喂门禁）。"""
    warnings: List[str] = []

    if not _hvacpy_available():
        warnings.append(
            "hvacpy 不可用（需 python>=3.10）：已降级为内置稳态筛选估算，"
            "trust_level=estimate（仅供方案前期参考，不得直接入 M15 门禁）"
        )
        try:
            r = screening_load(
                area_m2=req.area_m2,
                ceiling_height_m=req.ceiling_height_m,
                city=req.city,
                building_type=req.building_type,
                occupants=req.occupants,
            )
        except Exception as exc:  # noqa: BLE001
            warnings.append("内置估算异常：" + str(exc))
            return LoadResponse(method="error", provenance=PROVENANCE, trust_level="unverified", warnings=warnings)
        if not r["assumptions"].get("city_matched", False):
            warnings.append("未匹配到城市气象，已用默认设计温度（请核实所在气候区）")
        return LoadResponse(
            cooling_load_kw=r["cooling_load_kw"],
            heating_load_kw=r["heating_load_kw"],
            method=r["method"],
            provenance={**PROVENANCE, "note": "built-in screening; not ASHRAE-traceable"},
            trust_level="estimate",
            breakdown_kw=r["breakdown_kw"],
            assumptions=r["assumptions"],
            intensity_w_m2=r["intensity_w_m2"],
            warnings=warnings,
        )

    try:
        # 注意：hvacpy 公共 API 以安装版本为准，下列调用需在 3.10+ 环境核对字段名。
        from hvacpy import Q_, Room, CoolingLoad  # type: ignore

        room = Room(
            name="zone",
            floor_area=Q_(req.area_m2, "m**2"),
            ceiling_height=Q_(req.ceiling_height_m, "m"),
        )
        cl = CoolingLoad(room, city=req.city)
        cooling_kw = float(cl.peak_total.to("kW").magnitude)

        return LoadResponse(
            cooling_load_kw=round(cooling_kw, 2),
            heating_load_kw=None,  # 供暖负荷待接 hvacpy heating API（运行时核对）
            method="ASHRAE HOF 2021 (hvacpy)",
            provenance=PROVENANCE,
            trust_level="verified",
            warnings=warnings,
        )
    except Exception as exc:  # noqa: BLE001
        warnings.append("hvacpy 计算异常：" + str(exc) + "（API 名称需按安装版本核对）")
        return LoadResponse(
            method="error",
            provenance=PROVENANCE,
            trust_level="unverified",
            warnings=warnings,
        )
