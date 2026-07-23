"use client";
import { useState } from "react";
import { BRAND } from "../../lib/brand";

const categories = ["全部", "热水系统", "采暖系统", "新风系统", "净水系统", "智控系统"] as const;
type Cat = (typeof categories)[number];

const PRODUCTS = [
  { name: "Rheem 中央热水主机 RTE-50E", cat: "热水系统", brand: "Rheem", metrics: "50L · 即热 · COP 3.8", price: "¥12,800", desc: "家用级中央热水主机，适配 2-3 卫生间。" },
  { name: "Ruud 空气源热泵 RASL-10C", cat: "采暖系统", brand: "Ruud", metrics: "COP 4.2 · -25℃低温启动", price: "¥28,500", desc: "超低温空气源热泵，地暖/散热器双模式。" },
  { name: "EverHot 全热交换新风 ERV-350", cat: "新风系统", brand: "EverHot", metrics: "350m³/h · 全热回收 85%", price: "¥8,600", desc: "高效全热交换新风机，PM2.5过滤效率≥99%。" },
  { name: "Rheem 前置过滤器 RWP-40", cat: "净水系统", brand: "Rheem", metrics: "40μm过滤 · 大通量", price: "¥2,200", desc: "全屋前置过滤器，保护管路与设备。" },
  { name: "EcoNet 智控面板 EC-7Pro", cat: "智控系统", brand: "EcoNet", metrics: '7" 触屏 · BACnet + Modbus', price: "¥3,800", desc: "全屋舒适系统集中控制面板。" },
  { name: "Rheem 热泵热水器 RHPD-80", cat: "热水系统", brand: "Rheem", metrics: "80L · 热泵制热 · COP 4.0", price: "¥16,500", desc: "高效热泵热水器，适配别墅与大户型。" },
];

export default function ProductsPage() {
  const [cat, setCat] = useState<Cat>("全部");
  const filtered = cat === "全部" ? PRODUCTS : PRODUCTS.filter((p) => p.cat === cat);

  return (
    <main id="main">
      {/* Hero */}
      <section style={{ background: "var(--rv-dark)", color: "#fff", padding: "80px 0 60px" }}>
        <div className="rh-container">
          <p className="rh-eyebrow" style={{ color: "var(--rv-accent)" }}>PRODUCT CATALOG</p>
          <h1 className="rh-display" style={{ fontSize: "clamp(2.5rem,6vw,5rem)", margin: "12px 0 20px" }}>
            产品系列
          </h1>
          <p style={{ maxWidth: 560, opacity: 0.75, fontSize: "1.1rem", lineHeight: 1.7 }}>
            覆盖热水、采暖、新风、净水与智控五大系统的产品矩阵。
          </p>
        </div>
        <div style={{ height: 3, background: "var(--rv-brand)", marginTop: 40 }} />
      </section>

      {/* Filters */}
      <section className="rh-section" style={{ paddingTop: 48 }}>
        <div className="rh-container">
          <div style={{ display: "flex", gap: 8, marginBottom: 40, flexWrap: "wrap" }}>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                style={{
                  padding: "8px 20px",
                  border: "2px solid",
                  borderColor: cat === c ? "var(--rv-brand)" : "#ddd",
                  background: cat === c ? "var(--rv-brand)" : "transparent",
                  color: cat === c ? "#fff" : "inherit",
                  borderRadius: 4,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all .2s",
                  fontSize: 13,
                }}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 24 }}>
            {filtered.map((p) => (
              <div key={p.name} className="rh-product-card">
                <div
                  style={{
                    background: "var(--rv-s2)",
                    height: 160,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 40,
                  }}
                >
                  📦
                </div>
                <div style={{ padding: "18px 20px 22px" }}>
                  <div style={{ fontSize: 11, color: "var(--rv-brand)", fontWeight: 600, marginBottom: 4 }}>
                    {p.brand} · {p.cat}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{p.name}</div>
                  <div
                    className="rh-display"
                    style={{ fontSize: 13, color: "var(--rv-accent)", marginBottom: 8, letterSpacing: "0.03em" }}
                  >
                    {p.metrics}
                  </div>
                  <p style={{ fontSize: 12, color: "var(--rv-t3)", lineHeight: 1.6, marginBottom: 12 }}>{p.desc}</p>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--rv-brand)" }}>{p.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="rh-section" style={{ background: "var(--rv-brand)", color: "#fff", textAlign: "center" }}>
        <div className="rh-container">
          <h2 style={{ fontSize: "clamp(1.6rem,3.5vw,2.5rem)", marginBottom: 16, fontWeight: 700 }}>
            让 AI 帮你精准匹配
          </h2>
          <p style={{ opacity: 0.85, marginBottom: 28, fontSize: 15 }}>
            不确定选哪款产品？{BRAND.nameCn} AI 问诊为您智能推荐
          </p>
          <a
            href="/#diagnosis"
            className="rh-btn"
            style={{ background: "var(--rv-dark)", color: "#fff", padding: "12px 36px", fontWeight: 700, fontSize: 15 }}
          >
            开始 AI 问诊
          </a>
        </div>
      </section>
    </main>
  );
}
