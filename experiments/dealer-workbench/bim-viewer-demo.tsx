'use client';
// BIM 查看器运行时验证页（开发用，无需后端数据）。选择本地 .ifc 文件即可渲染。
import dynamic from 'next/dynamic';
import { PageHeader } from '@rhautt/ui';

const BimIfcViewer = dynamic(() => import('../../../apps/dealer-workbench/src/components/BimIfcViewer'), {
  ssr: false,
  loading: () => <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>加载 BIM 查看器…</div>,
});

export default function BimViewerDemoPage() {
  return (
    <div className="page-container" style={{ maxWidth: 1000 }}>
      <PageHeader
        title="BIM 查看器 · 运行时验证"
        subtitle="web-ifc (MPL-2.0) + three (MIT)，本地 WASM。选择任意 .ifc 文件验证解析与渲染。"
      />
      <BimIfcViewer height={560} />
    </div>
  );
}
