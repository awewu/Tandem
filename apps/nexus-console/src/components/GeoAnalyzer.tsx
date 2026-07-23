'use client';

import { useState } from 'react';

interface EngineResult {
  engine: string;
  score: number; // 0-100 visibility score
  mentioned: boolean;
  recommended: boolean;
  snippet: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'not_found';
}

interface GeoReport {
  query: string;
  timestamp: string;
  results: EngineResult[];
  avgScore: number;
  gaps: string[];
}

const AI_ENGINES = [
  '豆包（字节）',
  'Kimi（月之暗面）',
  'DeepSeek',
  '文心一言（百度）',
  '通义千问（阿里）',
  '智谱清言',
  '讯飞星火',
  '腾讯元宝',
];

const PRESET_QUERIES = [
  '家用中央空调什么品牌好',
  '地暖品牌推荐',
  '全屋采暖方案怎么选',
  '热水器哪个牌子质量好',
  '暖通空调系统设计',
  '恒热热水器怎么样',
  'Rheem瑞美热水器',
];

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#e5e7eb' }}>
        <div style={{ width: `${score}%`, height: '100%', borderRadius: 4, background: color, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color, minWidth: 36 }}>{score}%</span>
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    positive: { label: '正面推荐', bg: '#dcfce7', color: '#166534' },
    neutral: { label: '中性提及', bg: '#e0f2fe', color: '#0c4a6e' },
    negative: { label: '负面', bg: '#fee2e2', color: '#991b1b' },
    not_found: { label: '未被提及', bg: '#f3f4f6', color: '#6b7280' },
  };
  const s = map[sentiment] ?? map.not_found;
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.color, fontWeight: 500 }}>
      {s.label}
    </span>
  );
}

export default function GeoAnalyzer() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<GeoReport | null>(null);
  const [history, setHistory] = useState<GeoReport[]>([]);

  async function runAnalysis() {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/geo/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data: GeoReport = await res.json();
      setReport(data);
      setHistory((h) => [data, ...h].slice(0, 20));
    } catch (e) {
      console.error('GEO analysis failed:', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="geo-analyzer">
      {/* Input Section */}
      <div className="geo-input-section">
        <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600 }}>探测关键词</h3>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>
          输入消费者可能搜索的问题，探测品牌在 AI 搜索引擎中的可见度
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runAnalysis()}
            placeholder="例：家用中央空调什么品牌好"
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            onClick={runAnalysis}
            disabled={loading || !query.trim()}
            style={{
              padding: '8px 20px',
              background: loading ? '#9ca3af' : '#1B365D',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 500,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? '探测中…' : '开始探测'}
          </button>
        </div>

        {/* Preset queries */}
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PRESET_QUERIES.map((pq) => (
            <button
              key={pq}
              onClick={() => setQuery(pq)}
              style={{
                padding: '4px 10px',
                fontSize: 12,
                border: '1px solid #e5e7eb',
                borderRadius: 4,
                background: query === pq ? '#eff6ff' : '#fff',
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              {pq}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {report && (
        <div className="geo-results" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
              探测结果：「{report.query}」
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>综合可见度</span>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: report.avgScore >= 70 ? '#22c55e' : report.avgScore >= 40 ? '#f59e0b' : '#ef4444',
                }}
              >
                {report.avgScore}%
              </span>
            </div>
          </div>

          {/* Engine Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {report.results.map((r) => (
              <div
                key={r.engine}
                style={{
                  padding: 14,
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  background: '#fff',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{r.engine}</span>
                  <SentimentBadge sentiment={r.sentiment} />
                </div>
                <ScoreBar score={r.score} />
                {r.snippet && (
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                    {r.snippet}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Content Gaps */}
          {report.gaps.length > 0 && (
            <div style={{ marginTop: 20, padding: 14, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#92400e' }}>
                ⚠️ 内容缺口发现
              </h4>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#78350f', lineHeight: 1.8 }}>
                {report.gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>历史探测</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {history.slice(1).map((h, i) => (
              <button
                key={i}
                onClick={() => setReport(h)}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  border: '1px solid #e5e7eb',
                  borderRadius: 4,
                  background: '#fff',
                  color: '#374151',
                  cursor: 'pointer',
                }}
              >
                {h.query} ({h.avgScore}%)
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
