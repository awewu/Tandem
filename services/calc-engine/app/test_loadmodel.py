"""内置筛选模型单元测试（纯标准库，可在 Python 3.9 直接运行）

运行：
    python3 -m unittest services.calc-engine.app.test_loadmodel -v
或在 services/calc-engine 目录：
    python3 -m unittest app.test_loadmodel -v
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from loadmodel import (  # noqa: E402
    screening_load,
    CLIMATE,
    INDOOR_HEATING_C,
    INDOOR_COOLING_C,
)


class TestScreeningLoad(unittest.TestCase):
    def test_positive_loads_and_structure(self):
        r = screening_load(area_m2=120, ceiling_height_m=2.8, city="beijing",
                            building_type="residential", occupants=3)
        self.assertGreater(r["cooling_load_kw"], 0)
        self.assertGreater(r["heating_load_kw"], 0)
        for key in ("breakdown_kw", "assumptions", "method", "intensity_w_m2"):
            self.assertIn(key, r)
        # 分项之和应等于总量（容许四舍五入误差）
        b = r["breakdown_kw"]
        self.assertAlmostEqual(b["heating_envelope"] + b["heating_ventilation"],
                               r["heating_load_kw"], delta=0.05)
        self.assertAlmostEqual(
            b["cooling_envelope"] + b["cooling_ventilation"] + b["cooling_internal"],
            r["cooling_load_kw"], delta=0.05)

    def test_delta_t_matches_climate(self):
        r = screening_load(area_m2=100, city="beijing")
        a = r["assumptions"]
        self.assertEqual(a["delta_t_heating_k"], INDOOR_HEATING_C - CLIMATE["beijing"]["winter"])
        self.assertEqual(a["delta_t_cooling_k"], CLIMATE["beijing"]["summer"] - INDOOR_COOLING_C)
        self.assertTrue(a["city_matched"])

    def test_colder_city_needs_more_heating(self):
        warm = screening_load(area_m2=100, city="guangzhou")
        cold = screening_load(area_m2=100, city="harbin")
        self.assertGreater(cold["heating_load_kw"], warm["heating_load_kw"])

    def test_more_occupants_increase_cooling(self):
        few = screening_load(area_m2=100, city="shanghai", occupants=1)
        many = screening_load(area_m2=100, city="shanghai", occupants=20)
        self.assertGreater(many["cooling_load_kw"], few["cooling_load_kw"])

    def test_larger_area_scales_up(self):
        small = screening_load(area_m2=50, city="beijing")
        big = screening_load(area_m2=200, city="beijing")
        self.assertGreater(big["cooling_load_kw"], small["cooling_load_kw"])
        self.assertGreater(big["heating_load_kw"], small["heating_load_kw"])

    def test_unknown_city_uses_default(self):
        r = screening_load(area_m2=100, city="atlantis")
        self.assertFalse(r["assumptions"]["city_matched"])
        self.assertGreater(r["heating_load_kw"], 0)

    def test_invalid_area_raises(self):
        with self.assertRaises(ValueError):
            screening_load(area_m2=0)
        with self.assertRaises(ValueError):
            screening_load(area_m2=100, ceiling_height_m=0)


if __name__ == "__main__":
    unittest.main()
