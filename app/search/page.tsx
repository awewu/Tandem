"use client";

import { useState } from "react";
import { Search, FileText, Calendar, HardDrive } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  type: "document" | "calendar" | "drive";
  snippet: string;
  updatedAt: string;
}

const typeIcon = {
  document: FileText,
  calendar: Calendar,
  drive: HardDrive,
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setResults(data.results ?? []);
    setLoading(false);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto md:px-8">
      <h1 className="text-title-3 font-bold mb-6 flex items-center gap-2">
        <Search size={24} /> 全局搜索
      </h1>

      <form onSubmit={search} className="flex gap-2 mb-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索文档、日程、文件..."
          className="flex-1 p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="px-6 py-3 bg-brand-500 text-white rounded-lg hover:bg-brand-600"
        >
          搜索
        </button>
      </form>

      {loading && <div className="text-ink-secondary">搜索中...</div>}

      <div className="space-y-2">
        {results.map((r) => {
          const Icon = typeIcon[r.type];
          return (
            <div
              key={`${r.type}-${r.id}`}
              className="flex items-start gap-3 p-4 border rounded-lg hover:bg-surface-2 transition"
            >
              <Icon size={20} className="text-ink-secondary mt-0.5" />
              <div className="flex-1">
                <div className="font-medium">{r.title}</div>
                <div className="text-caption text-ink-secondary">{r.snippet}</div>
                <div className="text-footnote text-ink-tertiary mt-1">
                  {new Date(r.updatedAt).toLocaleString()}
                </div>
              </div>
              <span className="text-footnote px-2 py-1 bg-surface-3 rounded text-ink-secondary">
                {r.type === "document" ? "文档" : r.type === "calendar" ? "日程" : "云盘"}
              </span>
            </div>
          );
        })}
        {!loading && query && results.length === 0 && (
          <div className="text-center text-ink-tertiary py-12">未找到结果</div>
        )}
      </div>
    </div>
  );
}
