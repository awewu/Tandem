import { GROUP, LINKS, BRAND_MATRIX, MISSION, MANUFACTURING, LABS, DURABILITY, HISTORY, CONTACT } from '../lib/brand';
import BrandLogo from '../components/BrandLogo';

/* A+ 视觉：全站单一品牌绿 accent（--rh-green）；深绿仅用于承载白字的底色。*/

/* ── A.O. Smith Homepage 结构复刻 ──
   Hero (Innovating for Tomorrow)
   → 双列产品入口 (Water Heating / Water Treatment)
   → More About Us
   → A Global Leader in Innovative Technology + 报告卡
   → Featured Brands
   → Find a Dealer CTA
── */

export default function RhauttHomepage() {
  return (
    <main id="main">

      {/* ① HERO — Ruud.com 斜切分割风格 */}
      <section className="rh-hero-split" style={{ position: 'relative', overflow: 'hidden', minHeight: 620, display: 'flex' }}>

        {/* 左侧深炭灰文字区 */}
        <div style={{
          position: 'relative', zIndex: 2,
          background: '#fff', color: 'var(--rh-t1)',
          width: '52%', minWidth: 320,
          padding: '100px 64px 100px 48px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          clipPath: 'polygon(0 0, 100% 0, 88% 100%, 0 100%)',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rh-green)', marginBottom: 16 }}>
            {GROUP.nameEn}
          </p>
          <h1 style={{ fontSize: 'clamp(34px,4.8vw,60px)', lineHeight: 1.14, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 20, maxWidth: 520 }}>
            创新科技<br /><span style={{ color: 'var(--rh-green)' }}>成就舒适明天</span>
          </h1>
          <p style={{ fontSize: 15, color: 'var(--rh-t2)', lineHeight: 1.85, maxWidth: 400, marginBottom: 40 }}>
            {GROUP.nameCn}独家授权运营瑞美集团 Rheem · Ruud · EverHot，
            覆盖空气、水、储能与 AIoT 舒适家居四大领域的系统集成。
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="#business" className="rh-btn rh-btn-brand" style={{ padding: '13px 32px', fontSize: 14, letterSpacing: '0.04em' }}>
              了解业务
            </a>
            <a href="/about" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '13px 24px', fontSize: 14, color: 'var(--rh-t1)',
              border: '1px solid var(--rh-border-2)', borderRadius: 'var(--rh-r-md)',
              textDecoration: 'none', letterSpacing: '0.04em',
            }}>
              了解我们
            </a>
          </div>

          {/* 可靠 = 传承硬数据（非形容词）*/}
          <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', marginTop: 40, paddingTop: 22, borderTop: '1px solid var(--rh-border)', maxWidth: 480 }}>
            {HISTORY.heritage.slice(0, 3).map(h => (
              <div key={h.label} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span className="rh-stat" style={{ fontFamily: 'var(--rh-display)', fontSize: 24, fontWeight: 700, color: 'var(--rh-t1)', lineHeight: 1 }}>{h.value}</span>
                <span style={{ fontSize: 12, color: 'var(--rh-t3)' }}>{h.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：Ruud 式饱和色块——用绿不用黑（可持续承重面 + 白色仪表构图）*/}
        <div style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(150deg, var(--rh-green) 0%, var(--rh-green-2) 52%, var(--rh-green-dk) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* 细点阵网格（白色，径向遮罩淡出）*/}
          <div aria-hidden style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
            WebkitMaskImage: 'radial-gradient(circle at 66% 42%, #000 0%, transparent 74%)',
            maskImage: 'radial-gradient(circle at 66% 42%, #000 0%, transparent 74%)',
          }} />
          {/* 同心能量环（白 + 橙能量尖）*/}
          <svg aria-hidden viewBox="0 0 400 400" style={{ position: 'absolute', width: 'min(84%,540px)', opacity: 0.85 }}>
            <circle cx="200" cy="200" r="72"  fill="none" stroke="rgba(255,196,150,0.45)" strokeWidth="1" />
            <circle cx="200" cy="200" r="122" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
            <circle cx="200" cy="200" r="172" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
          </svg>

          {/* COP 表盘 */}
          <div style={{ position: 'relative', width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div aria-hidden style={{ position: 'absolute', inset: '-16%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 68%)' }} />
            <svg viewBox="0 0 120 120" style={{ position: 'absolute', width: '100%', height: '100%' }} aria-hidden>
              <defs>
                <linearGradient id="copGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ffffff" />
                  <stop offset="1" stopColor="var(--rh-warm)" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3.5" />
              <circle cx="60" cy="60" r="54" fill="none" stroke="url(#copGrad)" strokeWidth="3.5"
                strokeLinecap="round" strokeDasharray="339.3" strokeDashoffset="64"
                transform="rotate(-90 60 60)" />
              {/* 黄色能量尖峰标记（配比 D：黄仅绿底做数据尖峰）*/}
              <g transform="rotate(292 60 60)"><circle cx="60" cy="6" r="3" fill="var(--rh-yellow)" stroke="rgba(0,0,0,0.18)" strokeWidth="0.5" /></g>
            </svg>
            <div style={{ position: 'relative', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--rh-display)', fontSize: 62, lineHeight: 1, fontWeight: 700, color: '#fff' }}>4.8</div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.92)', marginTop: 6 }}>COP</div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.70)', marginTop: 4, letterSpacing: '0.02em' }}>热泵系统 · 实测制热能效比</div>
            </div>
          </div>

          <span style={{ position: 'absolute', bottom: 22, right: 26, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Reliable · Sustainable · Intelligent</span>
        </div>

      </section>

      {/* ①.5 任务带 — Ruud 式工程资源入口 */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--rh-border)' }}>
        <div className="rh-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
          {[
            { href: '/dealers', ext: false, title: '查找经销商', desc: '定位就近授权门店与体验中心', code: '01' },
            { href: LINKS.rheem, ext: true, title: '注册产品 · 保修', desc: '前往品牌官网激活质保与售后', code: '02' },
            { href: '/contact', ext: false, title: '预约勘测', desc: '现场评估与系统选型咨询', code: '03' },
          ].map((t, i) => (
            <a key={t.href} href={t.href} target={t.ext ? '_blank' : undefined} rel={t.ext ? 'noreferrer' : undefined} className="rh-task-cell" style={{
              display: 'flex', alignItems: 'center', gap: 18, padding: '26px 28px',
              textDecoration: 'none', color: 'var(--rh-t1)',
              borderLeft: i === 0 ? 'none' : '1px solid var(--rh-border)',
            }}>
              <div className="rh-bolt-frame" style={{ width: 44, height: 48, fontSize: 14, flexShrink: 0 }}>{t.code}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: 'var(--rh-t3)', lineHeight: 1.5 }}>{t.desc}</div>
              </div>
              <span aria-hidden style={{ marginLeft: 'auto', color: 'var(--rh-warm)', fontSize: 18 }}>→</span>
            </a>
          ))}
        </div>
      </div>

      {/* ① 执行标准与资质 — 用国标/认证说话（写入标准，去悬浮数字）*/}
      <div style={{ background: 'var(--rh-s2)', color: 'var(--rh-t1)', borderTop: '1px solid var(--rh-border)', borderBottom: '1px solid var(--rh-border)' }}>
        <div className="rh-container" style={{ padding: '40px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--rh-green)' }}>Standards &amp; Compliance</span>
            <span style={{ fontSize: 13, color: 'var(--rh-t2)' }}>产品与系统执行的国家标准与认证依据</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', borderTop: '1px solid var(--rh-border)' }}>
            {[
              { code: 'GB 21455', name: '房间空气调节器能效', note: '变频热泵能效分级依据' },
              { code: 'GB/T 25127', name: '低环境温度空气源热泵', note: '制热 COP 测试工况' },
              { code: 'GB 5749', name: '生活饮用水卫生标准', note: '净水产品出水水质基准' },
              { code: 'ISO 9001 · 3C', name: '质量体系 / 强制认证', note: '产品准入与质量管理' },
            ].map((s, i) => (
              <div key={s.code} style={{
                padding: '20px 24px 20px 0',
                borderLeft: i === 0 ? 'none' : '1px solid var(--rh-border)',
                paddingLeft: i === 0 ? 0 : 24,
              }}>
                <div style={{ fontFamily: 'var(--rh-mono)', fontSize: 18, fontWeight: 700, color: 'var(--rh-t1)', letterSpacing: '0.02em' }}>{s.code}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8, color: 'var(--rh-t1)' }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--rh-t3)', marginTop: 4, lineHeight: 1.5 }}>{s.note}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span aria-hidden style={{ width: 8, height: 8, background: 'var(--rh-green)', flexShrink: 0 }} />
            <a href="/sustainability" style={{ fontSize: 12, fontWeight: 700, color: 'var(--rh-green)', letterSpacing: '0.04em', textDecoration: 'none' }}>
              可持续发展与能效实测数据 →
            </a>
          </div>
        </div>
      </div>

      {/* ② 四大业务领域 — 对标 aosmith「Water Heating / Water Treatment」双业务卡，我们为四大 */}
      <section id="business" className="rh-section" style={{ background: '#fff', scrollMarginTop: 80 }}>
        <div className="rh-container">
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 40 }}>
            <div style={{ maxWidth: 620 }}>
              <p className="rh-eyebrow" style={{ color: 'var(--rh-green)' }}>Our Business · 四大业务领域</p>
              <h2 style={{ fontSize: 'clamp(24px,3.2vw,40px)', fontWeight: 800, letterSpacing: '-0.02em', margin: '10px 0 12px' }}>
                四大业务领域
              </h2>
              <p style={{ fontSize: 15, color: 'var(--rh-t2)', lineHeight: 1.85 }}>
                {GROUP.nameCn}围绕 <strong>空气 · 水 · 储能 · AIoT 舒适家居</strong> 四大领域，整合 Rheem · Ruud · Everhot
                授权资源与瑞诺瓦、瓦瑞储能自主品牌，提供从设计、集成到交付的一体化能力。产品与型号由各品牌独立官网运营。
              </p>
            </div>
            <a href="/brands" style={{ fontSize: 13, color: 'var(--rh-green)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', textDecoration: 'none', flexShrink: 0 }}>
              旗下品牌 →
            </a>
          </div>

          <div className="rh-reveal" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 20 }}>
            {[
              { no: '01', cn: '空气', en: 'Air', sub: '采暖 · 制冷 · 新风 · 空气品质', spec: 'COP ≥ 4.2', brand: 'Ruud', desc: '空气源热泵采暖制冷、中央空调与全热新风，营造恒温恒湿、洁净健康的室内空气环境。', href: LINKS.ruud, ext: true },
              { no: '02', cn: '水', en: 'Water', sub: '热水 · 中央热水 · 净水', spec: '≤ 5s 出热水 · TDS ≤ 50ppm', brand: 'Rheem · Everhot', desc: '从即热/储热到别墅级中央热水，叠加前置过滤、软水与直饮净水，供应恒温热水与洁净好水。', href: LINKS.rheem, ext: true },
              { no: '03', cn: '储能', en: 'Energy Storage', sub: '光储一体 · 备用电源 · 峰谷套利', spec: 'PV + ESS 光储协同', brand: 'Lithnova 瓦瑞储能', desc: '家用与商用新能源储能系统，为全屋舒适提供绿色低碳的能源保障，与暖通设备协同成生态闭环。', href: '/brands', ext: false },
              { no: '04', cn: 'AIoT 舒适家居', en: 'Rysnova AIoT', sub: '全屋舒适 · AI 问诊 · 远程运维', spec: '响应 < 100ms · 离线自持', brand: 'Rysnova 瑞诺瓦', desc: '全屋舒适 AIoT 平台，以 AI 问诊将五大系统需求转化为可执行方案，联动运行、节能与远程运维。', href: LINKS.diagnosis, ext: true },
            ].map(m => (
              <a key={m.no} href={m.href} target={m.ext ? '_blank' : undefined} rel={m.ext ? 'noreferrer' : undefined}
                className="rh-card-hover" style={{
                  display: 'block', padding: '32px 28px', background: '#fff',
                  border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
                  position: 'relative', overflow: 'hidden', textDecoration: 'none', color: 'var(--rh-t1)',
                }}>
                <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--rh-green)' }} />
                <div style={{ fontFamily: 'var(--rh-mono)', fontSize: 13, fontWeight: 700, color: 'var(--rh-green)', letterSpacing: '0.08em', marginBottom: 16 }}>{m.no}</div>
                <div className="rh-display" style={{ fontSize: 26, letterSpacing: '0.02em', color: 'var(--rh-t1)', marginBottom: 4 }}>{m.cn}</div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--rh-t3)', marginBottom: 12 }}>{m.en} · {m.sub}</div>
                <div style={{ marginBottom: 14 }}><span className="rh-spec-chip">{m.spec}</span></div>
                <p style={{ fontSize: 13, color: 'var(--rh-t2)', lineHeight: 1.8, marginBottom: 18 }}>{m.desc}</p>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--rh-green)', letterSpacing: '0.04em' }}>{m.brand} →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ②.5 Why Rhautt — 信任支柱（对标 Why Ruud，用事实建立可靠感）*/}
      <section className="rh-section" style={{ background: 'var(--rh-s2)', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <p className="rh-eyebrow">WHY {GROUP.nameShort}</p>
            <h2 style={{ fontSize: 'clamp(24px,3vw,36px)', fontWeight: 800, letterSpacing: '-0.02em', marginTop: 8 }}>
              为什么选择 {GROUP.nameCn}
            </h2>
          </div>
          <div className="rh-reveal" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 20 }}>
            {[
              { code: '授权', title: '独家授权运营', desc: '瑞美集团 Rheem · Ruud · EverHot 中国独家授权运营，正品与技术标准同源。' },
              { code: '品质', title: '四大业务领域', desc: '空气、水、储能与 AIoT 舒适家居四大领域，覆盖住宅到商业工程的系统集成。' },
              { code: '渠道', title: '成熟服务网络', desc: '授权经销商与安装商网络覆盖全国主要城市，就近响应勘测与安装。' },
              { code: '服务', title: '本地技术支持', desc: '全国服务热线与区域技术团队，工作日在线、紧急故障 24h 响应。' },
              { code: '低碳', title: '高能效可持续', desc: '热泵系统实测 COP 高能效表现，助力建筑低碳运营与碳中和目标。', eco: true },
            ].map(p => (
              <div key={p.code} style={{
                padding: '32px 26px', textAlign: 'center',
                border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)', background: '#fff',
              }}>
                <div className={`rh-bolt-frame${p.eco ? ' rh-bolt-frame--eco' : ''}`} style={{ width: 52, height: 56, fontSize: 14, margin: '0 auto 18px' }}>{p.code}</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{p.title}</div>
                <div style={{ fontSize: 13, color: 'var(--rh-t2)', lineHeight: 1.75 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ③ More About — 第三列融合为独立 band */}
      <section style={{ background: 'var(--rh-s2)', padding: '56px 32px', borderTop: '1px solid var(--rh-border)', borderBottom: '1px solid var(--rh-border)' }}>
        <div className="rh-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div aria-hidden style={{ width: 40, height: 4, background: 'var(--rh-green)', marginBottom: 20 }} />
            <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--rh-t1)', marginBottom: 8 }}>走近{GROUP.nameShort}</h2>
            <p style={{ fontSize: 14, color: 'var(--rh-t2)', maxWidth: 500, lineHeight: 1.8 }}>
              {GROUP.nameCn}专注建筑热水、采暖制冷与空气品质系统的集成交付，了解我们的团队、历程与质量体系。
            </p>
          </div>
          <a href="/about" className="rh-btn rh-btn-brand" style={{
            padding: '13px 32px', fontSize: 14, fontWeight: 700,
            letterSpacing: '0.04em', flexShrink: 0,
          }}>
            了解我们
          </a>
        </div>
      </section>

      {/* ④ Mission & Vision — 深色沉浸编辑带（打破全浅色节奏，建立高级对比）*/}
      <section style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, #2F5E24 0%, #241F1B 74%)', color: '#fff', padding: 'clamp(84px,10vw,124px) 32px' }}>
        {/* 超大幽灵字标 */}
        <div aria-hidden style={{ position: 'absolute', right: '-1%', top: '-14%', fontFamily: 'var(--rh-display)', fontSize: 'clamp(220px,32vw,460px)', lineHeight: 1, color: 'rgba(255,255,255,0.04)', letterSpacing: '-0.04em', userSelect: 'none', pointerEvents: 'none' }}>R.</div>
        <div className="rh-container rh-reveal" style={{ position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 'clamp(40px,6vw,88px)', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.42)', marginBottom: 20 }}>Mission &amp; Vision · 使命愿景</p>
              <div aria-hidden style={{ width: 48, height: 4, background: 'var(--rh-green)', marginBottom: 26 }} />
              <h2 style={{ fontSize: 'clamp(27px,3.6vw,46px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 26, textWrap: 'balance' as const }}>
                成为受人尊重的水和空气产品及解决方案可持续发展的<span style={{ color: 'var(--rh-green)' }}>引领者</span>
              </h2>
              <p style={{ fontSize: 15.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.95, marginBottom: 36, maxWidth: 540 }}>
                {MISSION.cn}
              </p>
              <a href="/about/our-values" className="rh-btn rh-btn-brand" style={{ padding: '13px 30px', fontSize: 14 }}>
                使命 · 愿景 · 价值观 →
              </a>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { href: '/about#annual-report', title: '2025 年度报告', cta: '查看年度报告 →' },
                { href: '/sustainability', title: '2024 可持续发展报告', cta: '查看可持续报告 →' },
              ].map(r => (
                <a key={r.href} href={r.href} className="rh-card-dark rh-card-hover" style={{
                  display: 'flex', alignItems: 'center', gap: 22, padding: '28px 30px',
                  textDecoration: 'none', color: '#fff',
                }}>
                  <div aria-hidden style={{ width: 4, alignSelf: 'stretch', background: 'var(--rh-green)', borderRadius: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15.5, marginBottom: 5 }}>{r.title}</div>
                    <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)' }}>{r.cta}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ④.5 制造与实验室能力 — PPT P9 制造 + P10 实验室（用能力建立厚重可靠感）*/}
      <section className="rh-section" style={{ background: '#fff', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 40 }}>
            <div style={{ maxWidth: 620 }}>
              <p className="rh-eyebrow" style={{ color: 'var(--rh-green)' }}>Manufacturing & Labs · 制造与实验室</p>
              <h2 style={{ fontSize: 'clamp(24px,3.2vw,38px)', fontWeight: 800, letterSpacing: '-0.02em', margin: '10px 0 12px' }}>
                自主制造 · 双 CNAS 实验室
              </h2>
              <p style={{ fontSize: 15, color: 'var(--rh-t2)', lineHeight: 1.85 }}>
                从内胆到整机的自主制造能力，配套两大国家备案（CNAS）能效实验室与 Rheem 全球标准检测体系，以工程精度保障产品可靠性与耐久性。
              </p>
            </div>
            <div style={{ display: 'flex', gap: 28, flexShrink: 0 }}>
              {DURABILITY.map(d => (
                <div key={d.label}>
                  <div className="rh-display" style={{ fontSize: 'clamp(28px,3vw,40px)', color: 'var(--rh-green)', lineHeight: 1 }}>{d.value}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--rh-t1)', marginTop: 6 }}>{d.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--rh-t3)' }}>{d.sub}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 'clamp(20px,4vw,48px)', alignItems: 'start' }} className="rh-two-col">
            {/* 制造产能 */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--rh-t3)', marginBottom: 16 }}>生产制造能力</p>
              <div style={{ border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)', overflow: 'hidden' }}>
                {MANUFACTURING.map((m, i) => (
                  <div key={m} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 20px', borderBottom: i < MANUFACTURING.length - 1 ? '1px solid var(--rh-border)' : 'none',
                    background: i % 2 ? 'var(--rh-s2)' : '#fff',
                  }}>
                    <span aria-hidden style={{ color: 'var(--rh-green)', fontWeight: 700, flexShrink: 0 }}>▸</span>
                    <span style={{ fontSize: 13.5, color: 'var(--rh-t1)' }}>{m}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 实验室能力 */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--rh-t3)', marginBottom: 16 }}>实验室能力</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
                {LABS.map(l => (
                  <div key={l.title} style={{
                    padding: '20px 22px', background: 'var(--rh-s2)',
                    border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
                    borderLeft: '3px solid var(--rh-green)',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--rh-t1)', marginBottom: 6 }}>{l.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--rh-t2)', lineHeight: 1.65 }}>{l.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ④.8 性能与工况 — 真图表传递专业（坐标轴/单位/来源，非装饰图形）*/}
      <section className="rh-section" style={{ background: 'var(--rh-s2)', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
            <div style={{ maxWidth: 620 }}>
              <p className="rh-eyebrow" style={{ color: 'var(--rh-green)' }}>Performance · 低温工况性能</p>
              <h2 style={{ fontSize: 'clamp(24px,3vw,34px)', fontWeight: 800, letterSpacing: '-0.02em', margin: '10px 0 10px' }}>
                空气源热泵 · 低温制热性能曲线
              </h2>
              <p style={{ fontSize: 14, color: 'var(--rh-t2)', lineHeight: 1.8 }}>
                依据 GB/T 25127 低环境温度空气源热泵测试工况。典型机组示意曲线，具体性能以各型号规格书实测为准。
              </p>
            </div>
            <a href="/professional" style={{ fontSize: 13, color: 'var(--rh-green)', fontWeight: 700, letterSpacing: '0.04em', textDecoration: 'none', flexShrink: 0 }}>
              工程师资源：BIM 族库 · CAD 图纸 · 规格书 →
            </a>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)', padding: 'clamp(16px,3vw,32px)' }}>
            <svg viewBox="0 0 660 280" role="img" aria-label="低温制热 COP 曲线：室外温度 -25℃ 至 15℃，COP 由 2.0 升至 4.8" style={{ width: '100%', height: 'auto', display: 'block' }}>
              {/* 网格（暖银灰）*/}
              {[{ v: '5.0', y: 20 }, { v: '4.0', y: 83 }, { v: '3.0', y: 146 }, { v: '2.0', y: 209 }].map(g => (
                <g key={g.v}>
                  <line x1="50" x2="620" y1={g.y} y2={g.y} stroke="var(--rh-steel-warm)" strokeWidth="0.5" opacity="0.45" />
                  <text x="42" y={g.y + 4} textAnchor="end" fontSize="11" fill="var(--rh-t3)" fontFamily="var(--rh-mono)">{g.v}</text>
                </g>
              ))}
              {/* X 轴 */}
              <line x1="50" x2="620" y1="240" y2="240" stroke="var(--rh-steel-warm)" strokeWidth="1" />
              {[{ t: '-25℃', x: 50 }, { t: '-15℃', x: 192 }, { t: '-5℃', x: 335 }, { t: '7℃', x: 506 }, { t: '15℃', x: 620 }].map(k => (
                <g key={k.t}>
                  <line x1={k.x} x2={k.x} y1="240" y2="245" stroke="var(--rh-steel-warm)" strokeWidth="1" />
                  <text x={k.x} y="260" textAnchor="middle" fontSize="11" fill="var(--rh-t3)" fontFamily="var(--rh-mono)">{k.t}</text>
                </g>
              ))}
              <text x="620" y="276" textAnchor="end" fontSize="10" fill="var(--rh-t3)">室外干球温度</text>
              <text x="14" y="14" fontSize="10" fill="var(--rh-t3)">COP</text>
              {/* 曲线 + 数据点 */}
              <path d="M50 209 C 120 192, 150 178, 192 171 C 260 160, 290 146, 335 133 C 420 108, 460 82, 506 70 C 545 60, 585 44, 620 33" fill="none" stroke="var(--rh-green)" strokeWidth="2.5" />
              {[{ x: 50, y: 209 }, { x: 192, y: 171 }, { x: 335, y: 133 }, { x: 506, y: 70 }].map(p => (
                <circle key={p.x} cx={p.x} cy={p.y} r="4" fill="#fff" stroke="var(--rh-green)" strokeWidth="2" />
              ))}
              {/* 黄色峰值标记（图表尖峰授权区）*/}
              <circle cx="620" cy="33" r="5" fill="var(--rh-yellow)" stroke="var(--rh-t1)" strokeWidth="1" />
              <text x="606" y="24" textAnchor="end" fontSize="12" fontWeight="800" fill="var(--rh-t1)" fontFamily="var(--rh-mono)">COP 4.8</text>
              {/* -25℃ 仍可运行标注 */}
              <text x="56" y="196" fontSize="11" fontWeight="700" fill="var(--rh-warm-dk)">-25℃ 低温启动制热</text>
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--rh-border)' }}>
              <span style={{ fontSize: 11.5, color: 'var(--rh-t3)' }}>测试工况：GB/T 25127 · 名义制热工况 · 典型机组示意</span>
              <span className="rh-spec-chip">耐久基准：25 万次脉冲 · 12 年等效寿命</span>
            </div>
          </div>
        </div>
      </section>

      {/* ⑤ Featured Brands */}
      <section className="rh-section" style={{ background: '#fff' }}>
        <div className="rh-container">
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p className="rh-eyebrow">Our Brands · 旗下品牌</p>
              <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 8 }}>核心品牌</h2>
            </div>
            <a href="/brands" style={{ fontSize: 13, color: 'var(--rh-green)', fontWeight: 700, letterSpacing: '0.04em', textDecoration: 'none' }}>
              全部品牌 →
            </a>
          </div>
          <div className="rh-reveal" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
            {BRAND_MATRIX.map(b => (
              <a key={b.name} href={b.href}
                target={b.external ? '_blank' : undefined} rel="noreferrer"
                className="rh-brand-card"
                style={{
                  display: 'block', padding: '36px 28px', background: '#fff',
                  border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
                  textDecoration: 'none', color: 'var(--rh-t1)',
                  position: 'relative', overflow: 'hidden',
                }}>
                <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--rh-green)' }} />
                <div style={{ height: 48, display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                  <BrandLogo name={b.name} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--rh-t3)', lineHeight: 1.6, marginBottom: 18, minHeight: 36 }}>{b.sub}</div>
                <span style={{ fontSize: 12, color: 'var(--rh-green)', fontWeight: 700, letterSpacing: '0.04em' }}>了解更多 →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ⑤.5 Rysnova AI 选型 + 自助工具 */}
      <section className="rh-section" style={{ background: 'var(--rh-green-soft)' }}>
        <div className="rh-container rh-two-col" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 56, alignItems: 'center' }}>

          {/* 业主资源 */}
          <div>
            <p className="rh-eyebrow" style={{ color: 'var(--rh-green)', marginBottom: 12 }}>Homeowners</p>
            <h2 style={{ fontSize: 'clamp(26px,3.5vw,40px)', fontWeight: 800, color: 'var(--rh-t1)', letterSpacing: '-0.01em', marginBottom: 16 }}>
              业主服务中心
            </h2>
            <p style={{ fontSize: 15, color: 'var(--rh-t2)', lineHeight: 1.9, marginBottom: 28, maxWidth: 480 }}>
              获取保修信息、查找当地授权经销商、对比系统运行费用。
              如需选型建议，可通过瑞诺瓦 Rysnova 在线获取系统推荐。
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href="/dealers" className="rh-btn rh-btn-brand" style={{
                padding: '14px 32px', fontSize: 14, fontWeight: 700, letterSpacing: '0.02em',
              }}>
                查找经销商
              </a>
              <a href={LINKS.diagnosis} target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', padding: '14px 26px', fontSize: 14,
                color: 'var(--rh-t1)', border: '1px solid var(--rh-border-2)',
                borderRadius: 'var(--rh-r-md)', textDecoration: 'none',
              }}>
                在线选型建议
              </a>
            </div>
          </div>

          {/* 自助工具 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { href: LINKS.rheem, ext: true, title: '保修注册', desc: '前往品牌官网注册产品、激活质保' },
              { href: LINKS.diagnosis, ext: true, title: '运行费用对比', desc: '瑞诺瓦 Rysnova 在线估算系统运行费用' },
              { href: '/professional', ext: false, title: '专业人员通道', desc: '经销商与安装商的技术文档、培训与开户' },
            ].map(t => (
              <a key={t.href} href={t.href} target={t.ext ? '_blank' : undefined} rel={t.ext ? 'noreferrer' : undefined} className="rh-card-hover" style={{
                display: 'flex', alignItems: 'center', gap: 18, padding: '22px 24px',
                background: '#fff', border: '1px solid var(--rh-border)',
                borderRadius: 'var(--rh-r-lg)', textDecoration: 'none', color: 'var(--rh-t1)',
                transition: 'border-color 150ms',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--rh-t2)', lineHeight: 1.6 }}>{t.desc}</div>
                </div>
                <span aria-hidden style={{ marginLeft: 'auto', color: 'var(--rh-warm)', fontSize: 18 }}>→</span>
              </a>
            ))}
          </div>

        </div>
      </section>

      {/* ⑥ Find a Dealer CTA */}
      <section style={{ background: 'var(--rh-s2)', padding: '80px 32px', textAlign: 'center', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rh-green)', marginBottom: 16 }}>
            Dealer Network · 经销网络
          </p>
          <h2 style={{ fontSize: 'clamp(26px,4vw,44px)', fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--rh-t1)', marginBottom: 14 }}>
            查找授权经销商
          </h2>
          <p style={{ fontSize: 15, color: 'var(--rh-t2)', marginBottom: 36, maxWidth: 460, margin: '0 auto 36px' }}>
            产品咨询、技术支持、质保与售后需求，都可联系我们的授权经销商网络。
          </p>
          <a href="/dealers" className="rh-btn rh-btn-brand" style={{ padding: '15px 40px', fontSize: 14, letterSpacing: '0.04em', fontWeight: 700 }}>
            查找经销商
          </a>

          {/* 热情 = 服务触点可见、可拨通 */}
          <div style={{ marginTop: 30, fontSize: 13, color: 'var(--rh-t2)' }}>
            全国服务热线{' '}
            <a href={`tel:${CONTACT.hotlineTel}`} className="rh-stat" style={{
              fontFamily: 'var(--rh-display)', fontSize: 19, fontWeight: 700,
              color: 'var(--rh-warm-dk)', textDecoration: 'none', letterSpacing: '0.02em',
            }}>{CONTACT.hotline}</a>
            <span style={{ color: 'var(--rh-t3)', marginLeft: 12 }}>{CONTACT.hours}</span>
          </div>
        </div>
      </section>

    </main>
  );
}
