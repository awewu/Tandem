import type { Metadata } from 'next';
import { GROUP, CONTACT, LEGAL, currentYear } from '../../lib/brand';

export const metadata: Metadata = {
  title: '使用条款',
  description: `${GROUP.nameCn}网站使用条款 — 访问与使用 ${GROUP.domain} 的规则、知识产权与免责声明。`,
  alternates: { canonical: '/terms' },
  robots: { index: true, follow: true },
};

const entity = LEGAL.entityCn ?? `${GROUP.nameCn}（运营主体工商全称以正式公示为准）`;

const SECTIONS: { h: string; body: string[] }[] = [
  { h: '一、条款的接受', body: [
    `欢迎访问 ${GROUP.domain}（下称"本站"）。本站由 ${entity} 运营。您访问或使用本站，即表示您已阅读、理解并同意受本使用条款约束；如不同意，请停止使用本站。`,
  ] },
  { h: '二、知识产权', body: [
    '本站所载文字、图形、界面、版式、标识及其编排等内容，除另有说明外，其著作权及相关权利归本站运营主体或相应权利人所有。',
    '未经事先书面许可，任何人不得以复制、转载、摘编、镜像等方式用于商业目的。',
  ] },
  { h: '三、商标声明', body: [
    'Rheem、Ruud、EverHot 等商标为其各自所有人的注册商标；本站在瑞美集团（Rheem）授权范围内于中国市场展示与运营相关品牌内容。',
    '未经权利人许可，不得使用上述商标或可能造成混淆的近似标识。',
  ] },
  { h: '四、使用规范', body: [
    '您应合法、合规地使用本站，不得从事危害网络安全、干扰网站正常运行、爬取或滥用数据、发布违法或侵权信息等行为。',
    '本站部分入口（如经销商 / 设计师 / 经营工作台）面向授权的专业用户，您应对账号及其操作负责。',
  ] },
  { h: '五、第三方链接', body: [
    '本站可能包含指向第三方网站或服务的链接，仅为方便用户而提供。对第三方网站的内容、政策与行为，本站不承担责任。',
  ] },
  { h: '六、免责声明', body: [
    '本站信息仅供一般参考，产品规格、参数与可用性可能调整，具体以正式合同、产品铭牌与官方公示为准。',
    '在法律允许的范围内，本站不对因使用或无法使用本站内容而产生的任何直接或间接损失承担责任。',
  ] },
  { h: '七、责任限制', body: [
    '在适用法律允许的最大范围内，本站运营主体的责任以法律强制性规定为限。',
  ] },
  { h: '八、适用法律与争议解决', body: [
    '本条款的订立、效力、解释及争议解决均适用中华人民共和国大陆地区法律。因本站产生的争议，双方应友好协商；协商不成的，依法向有管辖权的人民法院提起诉讼。',
  ] },
  { h: '九、条款更新', body: [
    '我们可能适时更新本条款，更新后将在本站公布并自公布之日起生效。请您定期查阅以了解最新内容。',
  ] },
];

export default function TermsPage() {
  return (
    <main id="main" className="rh-section">
      <div className="rh-container" style={{ maxWidth: 820 }}>
        <div className="rh-eyebrow">TERMS OF USE</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>使用条款</h1>
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
