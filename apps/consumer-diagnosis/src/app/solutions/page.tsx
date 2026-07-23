"use client";
import { useState } from "react";
import { BRAND } from "../../lib/brand";

const tabs = ["住宅精装", "别墅豪宅", "商业酒店", "工业园区"] as const;
type Tab = (typeof tabs)[number];

const solutions: Record<Tab, { title: string; desc: string; tags: string[] }[]> = {
  住宅精装: [
    { title: "地暖采暖方案", desc: "热泵主机 + 分集水器 + 地暖盘管，COP可达4.5，精准分区控温。", tags: ["热泵", "地暖", "分集水器"] },
    { title: "全屋新风方案", desc: "ERV全热交换机组，PM2.5过滤效率≥99%，新风量按需调节。", tags: ["ERV", "新风", "PM2.5"] },
    { title: "五恒系统", desc: "恒温 · 恒湿 · 恒氧 · 恒净 · 恒静，智能联控全屋舒适。", tags: ["五恒", "智控", "中央空调"] },
    { title: "中央热水方案", desc: "热泵热水机组，TDS≤50ppm，全屋即热，保温循环24h。", tags: ["热水", "热泵", "循环保温"] },
  ],
  别墅豪宅: [],
  商业酒店: [],
  工业园区: [],
};

export default function SolutionsPage() {
  const [active, setActive] = useState<Tab>("住宅精装");

  return (
    <main id="main">
      {/* Hero */}
      <section style={{ background: "var(--rv-dark)", color: "#fff", padding: "80px 0 60px" }}>
        <div className="rh-container">
          <p className="rh-eyebrow" style={{ color: "var(--rv-accent)" }}>APPLICATION SOLUTIONS</p>
          <h1 className="rh-display" style={{ fontSize: "clamp(2.5rem,6vw,5rem)", margin: "12px 0 20px" }}>
            系统解决方案
          </h1>
          <p style={{ maxWidth: 560, opacity: 0.75, fontSize: "1.1rem", lineHeight: 1.7 }}>
            {BRAND.nameCn}为住宅、商业、工业场景提供全周期舒适系统方案，AI 智能匹配最优配置。
          </p>
        </div>
        <div style={{ height: 3, background: "var(--rv-brand)", marginTop: 40 }} />
      </section>

      {/* Tabs */}
      <section className="rh-section" style={{ paddingTop: 48 }}>
        <div className="rh-container">
          <div style={{ display: "flex", gap: 8, marginBottom: 40, flexWrap: "wrap" }}>
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActive(t)}
                style={{
                  padding: "10px 24px",
                  border: "2px solid",
                  borderColor: active === t ? "var(--rv-brand)" : "#ddd",
                  background: active === t ? "var(--rv-brand)" : "transparent",
                  color: active === t ? "#fff" : "inherit",
                  borderRadius: 4,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all .2s",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Solution Cards */}
          {solutions[active].length > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 24 }}>
              {solutions[active].map((s) => (
                <div key={s.title} className="rh-card" style={{ padding: 28 }}>
                  <h3 style={{ fontSize: "1.2rem", marginBottom: 12, color: "var(--rv-dark)" }}>{s.title}</h3>
                  <p style={{ opacity: 0.7, lineHeight: 1.7, marginBottom: 16 }}>{s.desc}</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {s.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          background: "var(--rv-accent)",
                          color: "#fff",
                          padding: "3px 10px",
                          borderRadius: 20,
                          fontSize: "0.78rem",
                          fontWeight: 600,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ opacity: 0.5, textAlign: "center", padding: "60px 0" }}>方案持续更新中，敬请期待</p>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="rh-section" style={{ background: "var(--rv-dark)", color: "#fff", textAlign: "center" }}>
        <div className="rh-container">
          <h2 className="rh-display" style={{ fontSize: "clamp(1.8rem,4vw,3rem)", marginBottom: 16 }}>
            让 AI 帮你精准匹配
          </h2>
          <p style={{ opacity: 0.7, marginBottom: 32, fontSize: "1.05rem" }}>
            输入空间面积、用途与预算，{BRAND.nameCn} AI 为您推荐系统方案
          </p>
          <a href="/#diagnosis" className="rh-btn rh-btn-brand" style={{ fontSize: "1.05rem", padding: "14px 40px" }}>
            开始 AI 问诊
          </a>
        </div>
      </section>
    </main>
  );
}
