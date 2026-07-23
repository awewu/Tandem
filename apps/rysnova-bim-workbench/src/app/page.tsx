'use client';

import { useState } from 'react';
import BimViewer from '@rhautt/bim-viewer';

export default function DeepenHome() {
  const [artifactId, setArtifactId] = useState('');
  const [loaded, setArtifact] = useState('');

  return (
    <main style={{ padding: 20, maxWidth: 1280, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0' }}>深化台 · BIM 3D / 施工图 / 效果图</h1>
      <p style={{ fontSize: 13, color: '#596067', marginBottom: 16 }}>
        技术支持基于签约资料（二维图 / 原理图 / 报价单）深化。加载 IFC 产物或本地文件，开始 BIM 3D 深化；剖切用于施工图剖面。
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          value={artifactId}
          onChange={(e) => setArtifactId(e.target.value)}
          placeholder="输入 file-artifact ID 加载签约产物（可留空，用下方文件选择）"
          style={{ flex: 1, minWidth: 320, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}
        />
        <button
          onClick={() => setArtifact(artifactId.trim())}
          style={{ background: '#0f1420', color: '#fff', border: 0, borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}
        >加载产物</button>
      </div>

      <div style={{ height: 560, border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#fff' }}>
        <BimViewer key={loaded || 'file'} artifactId={loaded || undefined} />
      </div>
    </main>
  );
}
