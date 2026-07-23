'use client';
import { useState } from 'react';
import { GROUP, CONTACT, LINKS } from '../../lib/brand';
import PageHero from '../../components/PageHero';

const PORTALS = [
  { code: 'D1', label: '经销商工作台', desc: 'CRM · 报价 · BIM · 经营分析', href: LINKS.dealer },
  { code: 'D2', label: '设计师工作台', desc: '2D 设计 · 方案可视化', href: LINKS.design },
  { code: 'P3', label: '客户查进度',   desc: '项目状态 · 验收记录',   href: LINKS.portal },
];

const BENEFITS = [
  { code: 'AU', title: '独家运营',   desc: '瑞美集团授权 · Rheem/Ruud/EverHot 中国独家运营' },
  { code: 'TS', title: '技术支持',  desc: '专属工程师驻场 + 远程诊断' },
  { code: 'TR', title: '培训体系',   desc: '官方认证课程 · 在线+线下双轨' },
  { code: 'RB', title: '返点政策',   desc: '季度返点 + 年度超额奖励' },
];

const REQUIREMENTS = [
  '具备独立法人资格，注册资本 ≥ 100 万元',
  '拥有供暖/制冷/热水系统销售或安装经验',
  '配备至少 1 名持证工程技术人员',
];

const TRAINING = [
  { tag: '官方认证', title: 'Rheem Certified Pro',       mode: '线上 · 24 课时' },
  { tag: '安装技术', title: '热泵热水系统安装规范',        mode: '线下 · 2 天' },
  { tag: '工程设计', title: 'EconexBMS 集成配置',         mode: '线上 · 8 课时' },
  { tag: '销售赋能', title: '解决方案顾问式销售',           mode: '线下 · 1 天' },
];

export default function ProfessionalPage() {
  const [form, setForm] = useState({ name: '', company: '', city: '', phone: '' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(false);
    try {
      const res = await fetch('/__forms.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ 'form-name': 'dealer-application', 'bot-field': '', ...form }).toString(),
      });
      if (!res.ok) throw new Error(String(res.status));
      setSent(true);
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <main id="main">

      {/* ── Hero ── */}
      <PageHero
        minHeight={340}
        eyebrow="RHAUTT® PROFESSIONAL · 专业通道"
        title={<>专业人员<span style={{ color: 'var(--rh-green)' }}>通道</span></>}
        lead={<>经销商 · 安装工 · 设计师 —— 专属工作台 · 技术文档 · 培训认证 · 一站式专业支持。</>}
      />

      {/* ── 三类用户入口 ── */}
      <section style={{ padding: '80px 32px', background: 'var(--rh-s2)' }}>
        <div className="rh-container">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className="rh-eyebrow">选择你的身份</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>专属工作台入口</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {PORTALS.map(p => (
              <a key={p.label} href={p.href} className="rh-card" style={{ padding: '40px 28px', display: 'block', textAlign: 'center' }}>
                <div aria-hidden style={{ width: 32, height: 4, background: 'var(--rh-green)', margin: '0 auto 20px' }} />
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: 'var(--rh-t1)' }}>{p.label}</div>
                <div style={{ fontSize: 13, color: 'var(--rh-t3)', marginBottom: 24, lineHeight: 1.6 }}>{p.desc}</div>
                <span className="rh-btn rh-btn-brand" style={{ padding: '8px 20px', fontSize: 13 }}>进入工作台 →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── 成为授权经销商 ── */}
      <section style={{ padding: '80px 32px' }}>
        <div className="rh-container">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="rh-eyebrow">授权经销商计划</div>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>成为{GROUP.nameShort}授权经销商</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 48, alignItems: 'start' }}>
            {/* 左侧：条件 + 权益 */}
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--rh-green)' }}>申请条件</h3>
              <ul style={{ listStyle: 'none', marginBottom: 40 }}>
                {REQUIREMENTS.map((r, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--rh-border)', fontSize: 14, color: 'var(--rh-t2)' }}>
                    <span className="rh-display" style={{ color: 'var(--rh-green)', fontSize: 18, flexShrink: 0 }}>0{i + 1}</span>
                    {r}
                  </li>
                ))}
              </ul>

              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--rh-t1)' }}>经销商权益</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                {BENEFITS.map(b => (
                  <div key={b.title} className="rh-card" style={{ padding: '16px' }}>
                    <div aria-hidden style={{ width: 24, height: 3, background: 'var(--rh-green)', marginBottom: 10 }} />
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{b.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--rh-t3)', lineHeight: 1.5 }}>{b.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 右侧：申请表单 */}
            <div className="rh-card" style={{ padding: '36px 32px' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>提交申请</h3>
              {sent ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 28, color: 'var(--rh-green)', margin: '0 auto 16px', lineHeight: 1 }}>✓</div>
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>申请已提交</div>
                  <div style={{ fontSize: 13, color: 'var(--rh-t3)' }}>我们将在 2 个工作日内与您联系</div>
                </div>
              ) : (
                <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {([
                    { key: 'name',    label: '姓名',    placeholder: '您的姓名' },
                    { key: 'company', label: '公司名称', placeholder: '公司全称' },
                    { key: 'city',    label: '城市',    placeholder: '所在城市' },
                    { key: 'phone',   label: '手机号码', placeholder: '11 位手机号', type: 'tel' },
                  ] as const).map(f => (
                    <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--rh-t2)' }}>{f.label}</span>
                      <input
                        required
                        type={'type' in f ? f.type : 'text'}
                        placeholder={f.placeholder}
                        value={form[f.key]}
                        onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                        style={{ padding: '10px 14px', borderRadius: 'var(--rh-r-md)', border: '1px solid var(--rh-border)', fontSize: 14, fontFamily: 'var(--rh-font)', outline: 'none' }}
                      />
                    </label>
                  ))}
                  <button type="submit" disabled={sending} className="rh-btn rh-btn-brand" style={{ padding: '12px', fontSize: 14, marginTop: 8, opacity: sending ? 0.6 : 1, cursor: sending ? 'wait' : 'pointer' }}>
                    {sending ? '提交中…' : '提交申请'}
                  </button>
                  {error && (
                    <p style={{ fontSize: 12, color: 'var(--rh-green)', lineHeight: 1.7, marginTop: 4 }}>
                      提交失败，请稍后重试，或直接致电 {CONTACT.hotline} / 邮件 {CONTACT.emails.business}。
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── 培训认证体系 ── */}
      <section style={{ padding: '80px 32px', background: 'var(--rh-s2)', color: 'var(--rh-t1)' }}>
        <div className="rh-container">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <div className="rh-eyebrow" style={{ color: 'var(--rh-green)' }}>TRAINING & CERTIFICATION</div>
            <h2 className="rh-display" style={{ fontSize: 40, letterSpacing: '0.04em', color: 'var(--rh-t1)' }}>培训认证体系</h2>
            <p style={{ fontSize: 14, color: 'var(--rh-t2)', marginTop: 8 }}>Rheem 官方认证课程 · 在线 + 线下双轨培训</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {TRAINING.map(t => (
              <div key={t.title} style={{ background: '#fff', border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)', padding: '24px 20px' }}>
                <span style={{ display: 'inline-block', background: 'var(--rh-green-soft)', color: 'var(--rh-green)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, marginBottom: 12 }}>{t.tag}</span>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, lineHeight: 1.4, color: 'var(--rh-t1)' }}>{t.title}</div>
                <div style={{ fontSize: 12, color: 'var(--rh-t3)' }}>{t.mode}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 技术支持热线 ── */}
      <section style={{ padding: '60px 32px', background: 'var(--rh-green-soft)', color: 'var(--rh-t1)', textAlign: 'center', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <div className="rh-eyebrow" style={{ color: 'var(--rh-green)', marginBottom: 12 }}>TECHNICAL SUPPORT</div>
          <div className="rh-display" style={{ fontSize: 48, letterSpacing: '0.04em', marginBottom: 8, color: 'var(--rh-t1)' }}>技术支持热线</div>
          <div className="rh-display" style={{ fontSize: 36, color: 'var(--rh-green)', marginBottom: 16 }}>{CONTACT.hotline}</div>
          <p style={{ fontSize: 13, color: 'var(--rh-t2)' }}>工作日 08:00 – 20:00 · 紧急故障 24h 在线</p>
        </div>
      </section>

    </main>
  );
}
