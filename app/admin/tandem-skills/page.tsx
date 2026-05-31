'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wrench, Search } from 'lucide-react';

interface SkillItem {
  id: string;
  description: string;
  tags: string[];
  zone: 'green' | 'yellow' | 'red';
  proxyAllowed: boolean;
  estimatedTokens: number;
}

export default function TandemSkillsAdminPage() {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  async function fetchSkills(q?: string) {
    setLoading(true);
    try {
      const url = q ? `/api/tandem-skills?q=${encodeURIComponent(q)}` : '/api/tandem-skills';
      const res = await fetch(url);
      const data = await res.json();
      setSkills(data.skills ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchSkills();
  }, []);

  return (
    <div className="container mx-auto max-w-5xl space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Tandem Skill Registry · TAF Layer 3
          </CardTitle>
          <p className="mt-1 text-caption text-muted-foreground">
            CircleBot 对齐 · 工具检索 + 红区守门 + Token 预算
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 rounded border p-2 text-caption"
              placeholder="搜索: 议事 / 决议 / 知识 / OKR..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void fetchSkills(query);
              }}
            />
            <Button onClick={() => fetchSkills(query)} disabled={loading}>
              <Search className="mr-1 h-4 w-4" />
              {loading ? '搜索中...' : '搜索'}
            </Button>
          </div>
          <p className="mt-2 text-footnote text-muted-foreground">
            共 {skills.length} 个工具 · 留空=全部 · 输入关键词=语义检索
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {skills.map((s) => (
          <SkillCard key={s.id} skill={s} />
        ))}
      </div>
    </div>
  );
}

function SkillCard({ skill }: { skill: SkillItem }) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-4">
        <div className="flex items-start justify-between gap-2">
          <code className="text-caption font-semibold">{skill.id}</code>
          <ZoneBadge zone={skill.zone} />
        </div>
        <p className="text-caption text-muted-foreground">{skill.description}</p>
        <div className="flex flex-wrap gap-1">
          {skill.tags.slice(0, 5).map((t) => (
            <Badge key={t} variant="outline" className="text-footnote">
              {t}
            </Badge>
          ))}
        </div>
        <div className="flex items-center justify-between text-footnote text-muted-foreground">
          <span>~{skill.estimatedTokens} tokens</span>
          <span>
            AI 代行:{' '}
            {skill.proxyAllowed ? (
              <span className="text-emerald-600">允许</span>
            ) : (
              <span className="text-rose-600">禁止</span>
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ZoneBadge({ zone }: { zone: 'green' | 'yellow' | 'red' }) {
  const styles = {
    green: 'bg-emerald-100 text-emerald-700',
    yellow: 'bg-warning/10 text-warning',
    red: 'bg-rose-100 text-rose-700',
  };
  const labels = { green: '绿区', yellow: '黄区', red: '红区' };
  return (
    <span className={`rounded px-2 py-0.5 text-footnote font-medium ${styles[zone]}`}>
      {labels[zone]}
    </span>
  );
}
