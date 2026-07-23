'use client';
import Link from 'next/link';

export default function DesignPage() {
  const API = process.env.NEXT_PUBLIC_API_URL || '';
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:0 }}>
      {/* 工具栏 */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px', borderBottom:'1px solid var(--border)', background:'var(--surface-1)', flexShrink:0 }}>
        <span className="t-headline">2D 平面设计</span>
        <div style={{ flex:1 }} />
        <Link href="/design/visualize"
          style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 14px', borderRadius:'var(--r-sm)', background:'var(--purple)', color:'#fff', fontSize:12, fontWeight:600, textDecoration:'none' }}>
          📊 方案可视化 →
        </Link>
      </div>
      <iframe
        src={`${API}/designer.html`}
        style={{ flex:1, border:'none', display:'block' }}
        title="2D 平面设计"
        allow="clipboard-write"
      />
    </div>
  );
}
