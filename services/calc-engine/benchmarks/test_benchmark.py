"""精算基准集 v1 回归测试

运行方式（Python >= 3.10）：
  cd services/calc-engine
  python -m benchmarks.test_benchmark

功能：
  1. 读取 v1-benchmark-set.json 中的手算期望值
  2. 调用 app.loadmodel.screening_load 得到内置估算值
  3. 按 tolerance_percent 判定每个 case 是否通过
  4. 输出可复跑的对比表（用于后续接 hvacpy 后同样本回归）
"""
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.loadmodel import screening_load


def load_benchmarks() -> dict:
    path = Path(__file__).with_name("v1-benchmark-set.json")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def within_tolerance(actual: float, expected: float, tol: float) -> bool:
    if expected == 0:
        return actual == 0
    return abs(actual - expected) / expected <= tol / 100


def main() -> int:
    suite = load_benchmarks()
    cases = suite["cases"]
    passed = 0
    failed = 0
    print(f"基准集: {suite['description']}\n方法: {suite['method']}\n")
    print(f"{'id':<22} {'name':<20} {'cooling':>12} {'expected':>12} {'heating':>12} {'expected':>12} {'status':>8}")
    print("-" * 96)
    for case in cases:
        inp = case
        hc = case["hand_check"]
        result = screening_load(
            area_m2=inp["area_m2"],
            ceiling_height_m=inp["ceiling_height_m"],
            city=inp["city"],
            building_type=inp["building_type"],
            occupants=inp.get("occupants", 0),
        )
        tol = case["tolerance_percent"]
        ok_cool = within_tolerance(result["cooling_load_kw"], hc["expected_cooling_load_kw"], tol)
        ok_heat = within_tolerance(result["heating_load_kw"], hc["expected_heating_load_kw"], tol)
        ok = ok_cool and ok_heat
        if ok:
            passed += 1
        else:
            failed += 1
        status = "PASS" if ok else "FAIL"
        print(
            f"{case['id']:<22} {case['name']:<20} "
            f"{result['cooling_load_kw']:>12.2f} {hc['expected_cooling_load_kw']:>12.1f} "
            f"{result['heating_load_kw']:>12.2f} {hc['expected_heating_load_kw']:>12.1f} "
            f"{status:>8}"
        )
        if not ok:
            if not ok_cool:
                print(f"  [cooling] actual={result['cooling_load_kw']:.2f} expected={hc['expected_cooling_load_kw']:.1f} tol={tol}%")
            if not ok_heat:
                print(f"  [heating] actual={result['heating_load_kw']:.2f} expected={hc['expected_heating_load_kw']:.1f} tol={tol}%")
    print("-" * 96)
    print(f"结果: 通过 {passed}/{len(cases)}，失败 {failed}/{len(cases)}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
