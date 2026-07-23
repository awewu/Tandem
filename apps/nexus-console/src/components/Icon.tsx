// Lightweight emoji icon map — zero extra deps, guaranteed to build.
const MAP: Record<string, string> = {
  LayoutGrid: '▦',
  Globe: '🌐',
  FolderOpen: '🗂️',
  Package: '📦',
  Rocket: '🚀',
  Upload: '📤',
  Tag: '🏷️',
  CheckCircle2: '✅',
  Building2: '🏢',
  Server: '🖥️',
  HeartPulse: '❤️',
  ShieldCheck: '🛡️',
};

export default function Icon({ name }: { name?: string }) {
  if (!name) return null;
  return <span className="ic" aria-hidden>{MAP[name] ?? '•'}</span>;
}
