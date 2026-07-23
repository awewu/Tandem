'use client';
import './globals.css';


const TOOLS = [
  { label: '设计项目', desc: '从 CRM 线索创建的项目列表', href: '/projects', icon: '📁', ready: true },
  { label: '一键精算 · 签章', desc: '七系统·五恒维度·必算校验闸·复核放行', href: '/calc', icon: '🧮', ready: true },
  { label: 'M12 同步真相源', desc: 'design↔Rysnova·派生过期追踪·变更回流', href: '/sync', icon: '🔗', ready: true },
  { label: '2D 平面设计', desc: '拖拽式设备布局·管线路由', href: '/floor-plan', icon: '📐', ready: true },
  { label: '布局 · CFD', desc: '气流/热场仿真·舒适度验证', href: '/layout-cfd', icon: '🌬️', ready: true },
  { label: 'BIM 模型查看', desc: 'ThatOpen IFC 模型查看·artifactId', href: '/viewer', icon: '🏗️', ready: true },
  { label: 'AI 方案', desc: 'AI 设计建议·校验·复核', href: '/ai-design', icon: '🤖', ready: true },
  { label: 'BOM 清单', desc: '材料清单·报价', href: '/bom', icon: '🧾', ready: true },
  { label: '系统模型', desc: '系统架构可视化', href: '/system-model', icon: '📊', ready: true },
];

export default function DesignerHome() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: 'var(--color-text)' }}>设计师工作台</div>
      <div style={{ fontSize: 13, color: 'var(--color-muted)', marginBottom: 48 }}>瑞诺瓦 · 方案设计平台</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, maxWidth: 1040, width: '100%' }}>
        {TOOLS.map(t => {
          const card = (
            <>
              <div style={{ fontSize: 36, marginBottom: 12, opacity: t.ready ? 1 : .45 }}>{t.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: t.ready ? 'var(--color-text)' : 'var(--color-subtle)' }}>{t.label}</div>
              <div style={{ fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>{t.desc}</div>
              {!t.ready && <div style={{ marginTop: 10, fontSize: 11, fontWeight: 600, color: 'var(--color-subtle)', border: '1px solid #e5e7eb', borderRadius: 6, padding: '2px 8px', display: 'inline-block' }}>规划中</div>}
            </>
          );
          const base = {
            background: 'var(--color-card-bg)', borderRadius: 12, padding: '28px 20px',
            textAlign: 'center' as const, boxShadow: 'var(--color-card-shadow)', display: 'block',
            border: t.ready ? '1.5px solid var(--color-accent)' : '1px solid #eef0f4',
          };
          return t.ready ? (
            <a key={t.label} href={t.href} style={{ ...base, textDecoration: 'none', color: 'var(--color-text)' }}>{card}</a>
          ) : (
            <div key={t.label} style={{ ...base, cursor: 'not-allowed' }}>{card}</div>
          );
        })}
      </div>

    </div>
  );
}
