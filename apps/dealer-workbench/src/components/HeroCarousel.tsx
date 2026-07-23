'use client';
import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface HeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  bgGradient: string;
  href?: string;
  badge?: string;
}

export function HeroCarousel({ slides, autoMs = 6000 }: { slides: HeroSlide[]; autoMs?: number }) {
  const [idx, setIdx] = useState(0);

  const prev = useCallback(() => setIdx(i => (i - 1 + slides.length) % slides.length), [slides.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % slides.length), [slides.length]);

  useEffect(() => {
    const t = setInterval(next, autoMs);
    return () => clearInterval(t);
  }, [next, autoMs]);

  const s = slides[idx];

  return (
    <div style={{ position:'relative', borderRadius:16, overflow:'hidden', height:280 }}>
      {/* Slide */}
      <a
        href={s.href || '#'}
        style={{
          display:'block', width:'100%', height:'100%',
          background: s.bgGradient,
          padding:'32px 28px', textDecoration:'none',
          position:'relative',
        }}
      >
        {/* Subtle grid texture (rheem-grid-bg equivalent) */}
        <div style={{
          position:'absolute', inset:0, pointerEvents:'none',
          backgroundImage:'linear-gradient(to right,rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.06) 1px,transparent 1px)',
          backgroundSize:'24px 24px',
        }} />
        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <span style={{
              fontSize:10, fontWeight:700, textTransform:'uppercase' as const, letterSpacing:'0.08em',
              background:'rgba(255,255,255,0.18)', color:'rgba(255,255,255,0.9)',
              borderRadius:9999, padding:'2px 8px',
            }}>{s.eyebrow}</span>
            {s.badge && (
              <span style={{ fontSize:10, fontWeight:700, background:'var(--brand)', color:'#fff', borderRadius:9999, padding:'2px 8px' }}>
                {s.badge}
              </span>
            )}
          </div>
          <h2 style={{ fontSize:28, fontWeight:700, color:'#fff', letterSpacing:'-0.01em', lineHeight:1.2, maxWidth:480 }}>{s.title}</h2>
          {s.subtitle && <p style={{ marginTop:8, fontSize:14, color:'rgba(255,255,255,0.78)', maxWidth:420 }}>{s.subtitle}</p>}
        </div>
      </a>

      {/* Prev / Next */}
      {slides.length > 1 && <>
        <button onClick={e => { e.preventDefault(); prev(); }} style={{
          position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
          width:32, height:32, borderRadius:'50%', border:'none',
          background:'rgba(0,0,0,0.32)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', zIndex:2,
        }}><ChevronLeft size={16} /></button>
        <button onClick={e => { e.preventDefault(); next(); }} style={{
          position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
          width:32, height:32, borderRadius:'50%', border:'none',
          background:'rgba(0,0,0,0.32)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', zIndex:2,
        }}><ChevronRight size={16} /></button>

        {/* Dots */}
        <div style={{ position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)', display:'flex', gap:6, zIndex:2 }}>
          {slides.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} style={{
              width: i === idx ? 20 : 6, height:6, borderRadius:3, border:'none',
              background: i === idx ? '#fff' : 'rgba(255,255,255,0.45)',
              cursor:'pointer', transition:'all 250ms',
            }} />
          ))}
        </div>
      </>}
    </div>
  );
}
