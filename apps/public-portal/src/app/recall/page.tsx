import type { Metadata } from 'next';
import { GROUP, CONTACT } from '../../lib/brand';

export const metadata: Metadata = {
  title: '产品召回信息',
  description: `${GROUP.nameCn}产品安全与召回信息 — 查询正在进行的召回、安全提示与联系方式。`,
  alternates: { canonical: '/recall' },
  robots: { index: true, follow: true },
};

export default function RecallPage() {
  return (
    <main id="main" className="rh-section">
      <div className="rh-container" style={{ maxWidth: 820 }}>
        <div className="rh-eyebrow" style={{ color: 'var(--rh-green)' }}>PRODUCT SAFETY · 产品安全</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>产品召回信息</h1>
        <p style={{ color: 'var(--rh-t3)', fontSize: 13, marginBottom: 32 }}>
          我们将产品安全置于首位，并在此集中发布与产品召回相关的公开信息。
        </p>

        {/* 当前状态 */}
        <section style={{
          padding: '28px 32px', background: 'var(--rh-s2)',
          border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
          borderLeft: '4px solid var(--rh-green)', marginBottom: 32,
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>当前召回状态</h2>
          <p style={{ color: 'var(--rh-t2)', lineHeight: 1.9, fontSize: 14 }}>
            截至目前，{GROUP.nameShort}在中国市场运营的产品<strong>暂无正在进行的召回</strong>。
            如后续出现召回事项，我们将在本页面及相关渠道及时公布召回范围、批次识别方式与处理方案。
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>如何识别您的产品</h2>
          <p style={{ color: 'var(--rh-t2)', lineHeight: 1.9, fontSize: 14, marginBottom: 8 }}>
            请查看产品机身铭牌上的型号与序列号（Serial No.）。如涉及召回，您可依据序列号批次判断产品是否在召回范围内。
          </p>
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>发现安全隐患怎么办</h2>
          <p style={{ color: 'var(--rh-t2)', lineHeight: 1.9, fontSize: 14, marginBottom: 8 }}>
            如您在使用产品过程中发现任何潜在安全隐患，请立即停止使用并通过下方渠道联系我们。请勿自行拆解或改装产品。
          </p>
        </section>

        <section style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>联系与上报</h2>
          <div style={{ color: 'var(--rh-t2)', lineHeight: 2.0, fontSize: 14 }}>
            <div>客服热线：<a href={`tel:${CONTACT.hotlineTel}`} style={{ color: 'var(--rh-green)' }}>{CONTACT.hotline}</a>（{CONTACT.hours}）</div>
            <div>邮箱：<a href={`mailto:${CONTACT.emails.service}`} style={{ color: 'var(--rh-green)' }}>{CONTACT.emails.service}</a></div>
            <div>产品注册与质保：<a href="/warranty" style={{ color: 'var(--rh-green)' }}>前往质保登记 →</a></div>
          </div>
        </section>
      </div>
    </main>
  );
}
