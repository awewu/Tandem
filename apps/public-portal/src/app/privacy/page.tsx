import type { Metadata } from 'next';
import { GROUP, CONTACT, LEGAL, currentYear } from '../../lib/brand';

export const metadata: Metadata = {
  title: '隐私政策',
  description: `${GROUP.nameCn}隐私政策与个人信息保护说明（依据《个人信息保护法》PIPL）。`,
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
};

const entity = LEGAL.entityCn ?? `${GROUP.nameCn}（运营主体工商全称以正式公示为准）`;

const SECTIONS: { h: string; body: string[] }[] = [
  { h: '一、适用范围', body: [
    `本政策适用于 ${GROUP.domain} 网站（下称"本站"）。本站由 ${entity} 运营。`,
    '本站为企业门户，主要面向经销商、工程与专业人员；消费者 AI 问诊由独立的瑞诺瓦 Rysnova 服务提供，其个人信息处理适用该服务自身的隐私政策。',
  ] },
  { h: '二、我们收集的信息', body: [
    '主动提供：当您通过表单、邮件或电话联系我们（如经销商申请、商务咨询）时，我们可能收集您的姓名、公司、城市、电话、邮箱等。',
    '自动收集：为保障网站运行与改进体验，我们可能记录访问日志、设备与浏览器信息，以及经您同意后的 Cookie/统计数据。',
  ] },
  { h: '三、使用目的', body: [
    '响应并处理您的咨询、合作与经销商申请；提供技术与售后支持；改进网站与服务质量；在取得同意的范围内进行统计分析。',
    '我们不会将您的个人信息用于与上述目的无关的用途，除非另行取得您的同意。',
  ] },
  { h: '四、Cookie 与统计', body: [
    '本站可能使用必要 Cookie 维持基本功能；非必要（统计/分析）Cookie 仅在您同意后启用。您可通过浏览器设置管理或清除 Cookie。',
    '我们尊重浏览器的 Do-Not-Track 设置。',
  ] },
  { h: '五、共享、委托与出境', body: [
    '除法律法规要求或为实现上述目的所必需（如委托服务商处理表单/邮件），我们不会向第三方提供您的个人信息；委托处理时将约束受托方依约保护您的信息。',
    '如涉及个人信息跨境提供，我们将依《个人信息保护法》履行告知并取得单独同意等法定义务。',
  ] },
  { h: '六、存储与安全', body: [
    '个人信息存储于中国境内，保存期限不超过实现处理目的所必需的期间。我们采取合理的技术与管理措施保护您的信息安全。',
  ] },
  { h: '七、您的权利', body: [
    '您有权查阅、复制、更正、补充、删除您的个人信息，并可撤回同意或注销相关请求。您可通过下方联系方式行使权利，我们将依法及时响应。',
  ] },
  { h: '八、未成年人', body: [
    '本站面向企业与专业用户，不面向未成年人收集个人信息。若您为未成年人，请在监护人指导下使用。',
  ] },
  { h: '九、政策更新', body: [
    '我们可能适时更新本政策，重大变更将在本站显著位置提示。请定期查阅以了解最新内容。',
  ] },
];

export default function PrivacyPage() {
  return (
    <main id="main" className="rh-section">
      <div className="rh-container" style={{ maxWidth: 820 }}>
        <div className="rh-eyebrow">PRIVACY</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>隐私政策</h1>
        <p style={{ color: 'var(--rh-t3)', fontSize: 13, marginBottom: 32 }}>
          最近更新：{currentYear()} 年 · 适用于 {GROUP.domain} · 运营主体：{entity}
        </p>

        {SECTIONS.map((s) => (
          <section key={s.h} style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{s.h}</h2>
            {s.body.map((p, i) => (
              <p key={i} style={{ color: 'var(--rh-t2)', lineHeight: 1.9, fontSize: 14, marginBottom: 8 }}>{p}</p>
            ))}
          </section>
        ))}

        <section style={{ marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>十、联系我们</h2>
          <div style={{ color: 'var(--rh-t2)', lineHeight: 2.0, fontSize: 14 }}>
            <div>运营主体：{entity}</div>
            <div>客服热线：<a href={`tel:${CONTACT.hotlineTel}`} style={{ color: 'var(--rh-green)' }}>{CONTACT.hotline}</a></div>
            <div>邮箱：<a href={`mailto:${CONTACT.emails.service}`} style={{ color: 'var(--rh-green)' }}>{CONTACT.emails.service}</a></div>
            <div>地址：{CONTACT.address}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
