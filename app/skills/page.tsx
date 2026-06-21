'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BookOpen, RefreshCw, AlertCircle, CheckCircle2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSkills } from '@/lib/hermes-api';

interface HermesSkill {
  name: string;
  category: string;
  source: string;
  trust: string;
  enabled: boolean;
}

const sourceColor = (s: string) => {
  switch (s.toLowerCase()) {
    case 'local': return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
    case 'hub':   return 'bg-info/10 text-info dark:text-info border-info/20';
    default:      return 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20';
  }
};

export default function SkillsPage() {
  const [skills, setSkills] = useState<HermesSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await getSkills();
      if (data?.error && !data?.skills?.length) throw new Error(data.error);
      setSkills(data.skills || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load skills');
      setSkills([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const categories = useMemo(() => {
    const set = new Set(skills.map((s) => s.category));
    return ['all', ...Array.from(set).sort()];
  }, [skills]);

  const sources = useMemo(() => {
    const set = new Set(skills.map((s) => s.source));
    return ['all', ...Array.from(set).sort()];
  }, [skills]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return skills.filter((s) => {
      if (selectedCategory !== 'all' && s.category !== selectedCategory) return false;
      if (selectedSource !== 'all' && s.source !== selectedSource) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.category.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [skills, search, selectedCategory, selectedSource]);

  const stats = useMemo(() => {
    const byCat: Record<string, number> = {};
    for (const s of skills) byCat[s.category] = (byCat[s.category] || 0) + 1;
    return { total: skills.length, enabled: skills.filter((s) => s.enabled).length, byCat };
  }, [skills]);

  const handleSkillClick = (skillName: string) => {
    // Navigate to chat with skill parameter
    window.location.href = `/chat?skill=${encodeURIComponent(skillName)}`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header - Fixed */}
      <div className="p-6 max-w-6xl mx-auto w-full space-y-4 flex-shrink-0">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-title-3 font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="h-6 w-6" /> Skills
            </h1>
            <p className="text-muted-foreground mt-1 text-caption">
              Live view from <code className="text-footnote">hermes skills list</code>.
              Click any skill to use it in chat.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-3 w-3', loading && 'animate-spin')} /> Refresh
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Total: {stats.total}</Badge>
          <Badge className="bg-success">Enabled: {stats.enabled}</Badge>
          {Object.entries(stats.byCat).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([cat, n]) => (
            <Badge key={cat} variant="outline" className="text-footnote">
              {cat}: {n}
            </Badge>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-caption text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
            <span className="text-footnote opacity-70">— Is <code>hermes</code> in PATH?</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Search by name or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-caption"
          >
            {categories.map((c) => (<option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>))}
          </select>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-caption"
          >
            {sources.map((s) => (<option key={s} value={s}>{s === 'all' ? 'All sources' : s}</option>))}
          </select>
          <span className="text-footnote text-muted-foreground ml-auto">{filtered.length} shown</span>
        </div>
      </div>

      {/* Scrollable Content */}
      <ScrollArea className="flex-1 px-6 pb-6">
        <div className="max-w-6xl mx-auto">
          {loading && skills.length === 0 ? (
            <div className="text-caption text-muted-foreground py-12 text-center">Loading skills from Hermes...</div>
          ) : filtered.length === 0 ? (
            <div className="text-caption text-muted-foreground py-12 text-center">No skills match the filter.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((skill) => (
                <Card 
                  key={skill.name} 
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-soft hover:scale-[1.02]',
                    skill.enabled ? 'border-primary/20 hover:border-primary/50' : 'opacity-60 hover:opacity-90'
                  )}
                  onClick={() => handleSkillClick(skill.name)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-caption truncate">{skill.name}</div>
                        <div className="text-footnote text-muted-foreground mt-0.5 truncate">{skill.category}</div>
                      </div>
                      {skill.enabled && <CheckCircle2 className="h-4 w-4 text-success shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="outline" className={cn('text-[10px]', sourceColor(skill.source))}>
                        {skill.source}
                      </Badge>
                      {skill.trust !== skill.source && (
                        <Badge variant="outline" className="text-[10px]">{skill.trust}</Badge>
                      )}
                      {skill.enabled && (
                        <Badge className="text-[10px] bg-success hover:bg-success ml-auto">
                          <Play className="h-3 w-3 mr-1" /> Use
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
