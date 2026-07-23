'use client';
import { useState } from 'react';
import { CONTACT } from '../../lib/brand';
import PageHero from '../../components/PageHero';

/* ── 保修注册（Netlify Forms：form-name = warranty-registration）── */

export default function WarrantyPage() {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError(false);
    try {
      const fd = new FormData(e.currentTarget);
      const body = new URLSearchParams(fd as unknown as Record<string, string>).toString();
      const res = await fetch('/__forms.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) throw new Error(String(res.status));
      setSubmitted(true);
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
        minHeight={300}
        eyebrow="WARRANTY REGISTRATION · 保修服务"
        title={<>保修<span style={{ color: 'var(--rh-green)' }}>注册</span></>}
        lead={<>注册您的产品，激活官方质保并获得延保资格、上门服务优先响应与保养提醒。</>}
      />

      <section className="rh-section" style={{ background: 'var(--rh-s2)' }}>
        <div className="rh-container rh-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 48, alignItems: 'start' }}>

          {/* ── 表单 ── */}
          <div style={{
            background: '#fff', border: '1px solid var(--rh-border)',
            borderRadius: 'var(--rh-r-lg)', padding: '36px',
            borderTop: '4px solid var(--rh-green)',
          }}>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ fontSize: 34, color: 'var(--rh-green)', margin: '0 auto 20px', lineHeight: 1 }}>✓</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 10 }}>注册信息已提交</h2>
                <p style={{ fontSize: 14, color: 'var(--rh-t3)', lineHeight: 1.8 }}>
                  我们将在 1-2 个工作日内完成审核，<br />
                  质保凭证将发送至您预留的手机号。
                </p>
              </div>
            ) : (
              <form name="warranty-registration" onSubmit={submit}>
                <input type="hidden" name="form-name" value="warranty-registration" />
                <input type="hidden" name="bot-field" />
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>产品注册信息</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <label style={{ display: 'block' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>姓名 *</span>
                    <input required name="name" style={inputStyle} placeholder="您的姓名" />
                  </label>
                  <label style={{ display: 'block' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>手机号 *</span>
                    <input required name="phone" type="tel" pattern="1[0-9]{10}" style={inputStyle} placeholder="11 位手机号" />
                  </label>
                </div>
                <label style={{ display: 'block', marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>产品序列号 (S/N) *</span>
                  <input required name="serial" style={inputStyle} placeholder="铭牌上的序列号，如 RH2026XXXXXXXX" />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <label style={{ display: 'block' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>产品型号 *</span>
                    <input required name="model" style={inputStyle} placeholder="如 RHP-8C" />
                  </label>
                  <label style={{ display: 'block' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>购买日期 *</span>
                    <input required name="purchaseDate" type="date" style={inputStyle} />
                  </label>
                </div>
                <label style={{ display: 'block', marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>安装地址 *</span>
                  <input required name="address" style={inputStyle} placeholder="省 / 市 / 区 / 详细地址" />
                </label>
                <label style={{ display: 'block', marginBottom: 24 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>购买渠道</span>
                  <select name="channel" style={{ ...inputStyle, appearance: 'auto' as const }}>
                    <option>授权经销商门店</option>
                    <option>工程项目配套</option>
                    <option>线上官方渠道</option>
                    <option>其他</option>
                  </select>
                </label>
                <button type="submit" disabled={sending} className="rh-btn rh-btn-brand" style={{
                  width: '100%', padding: '14px', fontSize: 15, fontWeight: 700,
                  letterSpacing: '0.04em', border: 'none', opacity: sending ? 0.6 : 1, cursor: sending ? 'wait' : 'pointer',
                }}>
                  {sending ? '提交中…' : '提交注册'}
                </button>
                {error && (
                  <p style={{ fontSize: 12, color: 'var(--rh-green)', marginTop: 10, lineHeight: 1.7 }}>
                    提交失败，请稍后重试，或致电 {CONTACT.hotline}。
                  </p>
                )}
                <p style={{ fontSize: 11, color: 'var(--rh-t3)', marginTop: 12, lineHeight: 1.7 }}>
                  提交即表示您同意我们按照隐私政策处理您的信息，信息仅用于质保服务。
                </p>
              </form>
            )}
          </div>

          {/* ── 权益说明 ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { title: '官方质保激活', desc: '注册后质保期正式生效，整机与核心部件分级质保。' },
              { title: '延保资格', desc: '注册用户可购买延保服务，核心部件最长延至 10 年。' },
              { title: '优先上门响应', desc: '注册产品享受服务工单优先派单与上门时效承诺。' },
              { title: '保养提醒', desc: '按产品类型定期推送保养提醒，延长设备寿命。' },
            ].map(b => (
              <div key={b.title} style={{
                padding: '22px 24px', background: '#fff',
                border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
                borderLeft: '3px solid var(--rh-green)',
              }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{b.title}</div>
                <div style={{ fontSize: 13, color: 'var(--rh-t3)', lineHeight: 1.7 }}>{b.desc}</div>
              </div>
            ))}
            <div style={{
              padding: '22px 24px', background: 'var(--rh-green-soft)', color: 'var(--rh-t1)',
              borderRadius: 'var(--rh-r-lg)', border: '1px solid var(--rh-green-line)',
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: 'var(--rh-t1)' }}>需要帮助？</div>
              <div style={{ fontSize: 13, color: 'var(--rh-t2)', lineHeight: 1.8 }}>
                全国服务热线<br />
                <a href={`tel:${CONTACT.hotlineTel}`} style={{ color: 'var(--rh-green)', fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
                  {CONTACT.hotline}
                </a><br />
                {CONTACT.hours}
              </div>
            </div>
          </div>

        </div>
      </section>

    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', fontSize: 14,
  border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-md)',
  outline: 'none', fontFamily: 'inherit', background: '#fff',
};
