# calc-engine · 精算微服务（P1）

ASHRAE 可溯源暖通负荷计算，替代 NestJS `quote.loadCalc` 的 `±30% Quick Estimate`，
产出**带出处的计算单** → 喂 M15 `dataTrustLevel=verified` 门禁。

## 为什么独立微服务
- `hvacpy`（MIT）是 Python 库，要求 **Python ≥ 3.10**；以独立服务隔离 Python 运行时，经 REST/事件总线与 NestJS 交互。
- 不把任何 Python 依赖/copyleft 引入闭源 Node 主干（符合风险闸）。

## 运行
> 本机系统 Python 为 3.9，**不能直接 `pip install hvacpy`**（需 ≥3.10）。用以下任一：

**Docker（推荐，固定 python:3.11）**
```bash
docker build -t rhautt-calc-engine services/calc-engine
docker run --rm -p 8200:8200 rhautt-calc-engine
```

**本地 venv（需 Python 3.10+）**
```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r services/calc-engine/requirements.txt
uvicorn app.main:app --app-dir services/calc-engine --port 8200
```

## API
- `GET /health` → `{ status, hvacpy: bool, provenance }`
- `POST /v1/load-calc`
  - 入参：`{ area_m2, ceiling_height_m?, city?, building_type?, occupants? }`
  - 出参：`{ cooling_load_kw, heating_load_kw, method, provenance, trust_level, breakdown_kw?, assumptions?, intensity_w_m2?, warnings }`
  - `trust_level` 三档：
    - `verified`：hvacpy / ASHRAE 可源追溯精算 → **可喂 M15 门禁**。
    - `estimate`：**内置零依赖稳态筛选估算**（包络+通风+内扰），任意 Python 可跑，
      随 `breakdown_kw`/`assumptions` 返回全部系数与假设，可回算；**仅供方案前期参考，不入门禁**。
    - `unverified`：计算异常，不可用。
  - hvacpy 不可用时自动降级为 `estimate`（而非返回空占位）。内置模型见 `app/loadmodel.py`。

## 测试
内置模型为纯标准库，可在 Python 3.9 直接跑（无需 fastapi/hvacpy）：
```bash
python3 -m unittest test_loadmodel -v   # 在 services/calc-engine/app 目录
```

## 与平台对接
1. NestJS `QuoteService.loadCalc` 改为调用本服务（`CALC_ENGINE_URL`，默认 `http://localhost:8200`），
   取 `trust_level=verified` 的结果写入 M15；`estimate`/`unverified` 时保留本地估算并标注（不放行）。
2. 计算单的 `provenance` 落入审计与交付包（可辩护性）。

## 待办（运行时核对）
- hvacpy 公共 API 字段名（`Room`/`CoolingLoad`/`peak_total`）以 0.4.1 实测为准。
- 供暖负荷（Ch.18）接入。
- 设备选型 / 风管 / 62.1 通风扩展。

License：hvacpy = MIT。
