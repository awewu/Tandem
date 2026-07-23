import { ImageResponse } from 'next/og';
import { GROUP } from '../lib/brand';

export const alt = `${GROUP.nameEn} — ${GROUP.taglineEn}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// 动态生成社交分享图（1200×630）· 仅拉丁字符，保证离线构建可靠
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #241F1B 0%, #2F5E24 100%)',
          color: '#ffffff',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* 顶部：绿条 + eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 56, height: 8, background: '#4E9A3D' }} />
          <div style={{ fontSize: 26, letterSpacing: 8, color: '#EDF4E3', textTransform: 'uppercase' }}>
            Rheem · Ruud · EverHot
          </div>
        </div>

        {/* 主体：字标 + 定位 */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', fontSize: 132, fontWeight: 700, lineHeight: 1 }}>
            <span>Rhautt</span>
            <span style={{ color: '#4E9A3D' }}>.</span>
          </div>
          <div style={{ fontSize: 40, marginTop: 20, color: '#EDF4E3' }}>{GROUP.nameEn}</div>
        </div>

        {/* 底部：标语 + 域名 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 30, color: '#4E9A3D', letterSpacing: 2 }}>{GROUP.taglineEn}</div>
          <div style={{ fontSize: 28, color: '#A9B3AD' }}>{GROUP.domain}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
