/**
 * 品牌 logo —— 有官方图用图，无图回退文字字标。
 * 官方 logo 取自各品牌中国官网（授权运营范围内使用）。
 * logo 自带品牌色（红等）属商标规范，不受站内单一绿 UI 规则约束。
 */
const LOGOS: Record<string, { src: string; h: number; maxW: number }> = {
  Rheem:   { src: '/brand-logos/rheem.png',   h: 30, maxW: 150 },
  Ruud:    { src: '/brand-logos/ruud.png',    h: 46, maxW: 90  },
  EverHot: { src: '/brand-logos/everhot.png', h: 40, maxW: 110 },
  Rysnova: { src: '/brand-logos/rysnova.jpg', h: 30, maxW: 150 },
};

export default function BrandLogo({ name }: { name: string }) {
  const logo = LOGOS[name];
  if (logo) {
    return (
      <img
        src={logo.src}
        alt={`${name} logo`}
        style={{ height: logo.h, width: 'auto', maxWidth: logo.maxW, objectFit: 'contain', display: 'block' }}
      />
    );
  }
  return (
    <span className="rh-display" style={{ fontSize: 25, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--rh-dark)' }}>
      {name}
    </span>
  );
}
