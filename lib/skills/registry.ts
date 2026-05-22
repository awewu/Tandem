/**
 * Skills Registry · Anthropic SKILL.md 兼容
 *
 * 启动时扫描 `skills/<id>/SKILL.md`, 解析 YAML frontmatter, 加载到内存.
 * Progressive disclosure 三级:
 *   L1 (启动): name + description (~50-100 tokens / skill) → system prompt
 *   L2 (按需): SKILL.md 全文 → 当 LLM 判断相关时 read
 *   L3 (执行): scripts/ + examples/ + api-reference.md → tool 调用时 read
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface SkillManifest {
  /** 唯一标识, 同 directory name */
  id: string;
  /** YAML frontmatter: name (短名, 同 id) */
  name: string;
  /** YAML frontmatter: description (LLM 判定相关性的依据, 1-2 句) */
  description: string;
  /** YAML frontmatter: allowedRoles (可选, 限制可见 / 可调用此 skill 的角色) */
  allowedRoles?: string[];
  /** YAML frontmatter: permissions (可选, 调用前需要的权限位) */
  permissions?: string[];
  /** SKILL.md 绝对路径 */
  path: string;
  /** SKILL.md 全文 (L2 layer) */
  body: string;
}

interface RegistryState {
  loadedAt: number | null;
  manifests: SkillManifest[];
}

let state: RegistryState = { loadedAt: null, manifests: [] };

/** 解析 YAML frontmatter (轻量手写, 避免新增依赖) */
function parseFrontmatter(raw: string): {
  meta: Record<string, unknown>;
  body: string;
} {
  if (!raw.startsWith('---')) {
    return { meta: {}, body: raw };
  }
  const end = raw.indexOf('\n---', 4);
  if (end < 0) return { meta: {}, body: raw };
  const yamlStr = raw.slice(4, end);
  const body = raw.slice(end + 4).replace(/^\s*\n/, '');
  const meta: Record<string, unknown> = {};
  for (const line of yamlStr.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx < 0) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let val = trimmed.slice(colonIdx + 1).trim();
    // string list: ["a", "b"]
    if (val.startsWith('[') && val.endsWith(']')) {
      try {
        meta[key] = JSON.parse(val);
      } catch {
        meta[key] = [];
      }
      continue;
    }
    // strip quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    meta[key] = val;
  }
  return { meta, body };
}

export async function loadSkills(rootDir = path.join(process.cwd(), 'skills')): Promise<SkillManifest[]> {
  const manifests: SkillManifest[] = [];
  let entries: string[] = [];
  try {
    entries = await fs.readdir(rootDir);
  } catch {
    return manifests;
  }
  for (const entry of entries) {
    const skillDir = path.join(rootDir, entry);
    let stat;
    try {
      stat = await fs.stat(skillDir);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    let raw: string;
    try {
      raw = await fs.readFile(skillMdPath, 'utf8');
    } catch {
      continue;
    }
    const { meta, body } = parseFrontmatter(raw);
    if (!meta.name || !meta.description) continue;
    manifests.push({
      id: entry,
      name: String(meta.name),
      description: String(meta.description),
      allowedRoles: Array.isArray(meta.allowedRoles)
        ? (meta.allowedRoles as string[])
        : undefined,
      permissions: Array.isArray(meta.permissions)
        ? (meta.permissions as string[])
        : undefined,
      path: skillMdPath,
      body,
    });
  }
  state = { loadedAt: Date.now(), manifests };
  return manifests;
}

/** 同步访问已加载的 skills (loadSkills 必须先 await) */
export function getLoadedSkills(): SkillManifest[] {
  return state.manifests;
}

/**
 * Progressive Disclosure Layer 1:
 * 把 name + description 拼成 system prompt 片段.
 * 调用方按需筛 (按 role / permissions).
 */
export function buildSkillsSystemPrompt(opts: {
  userRoles?: string[];
  userPermissions?: string[];
} = {}): string {
  const { userRoles = [], userPermissions = [] } = opts;
  const visible = state.manifests.filter((m) => {
    if (m.allowedRoles && m.allowedRoles.length > 0) {
      if (!m.allowedRoles.some((r) => userRoles.includes(r))) return false;
    }
    if (m.permissions && m.permissions.length > 0) {
      if (!m.permissions.every((p) => userPermissions.includes(p))) return false;
    }
    return true;
  });
  if (visible.length === 0) return '';
  const lines = [
    '## Available Skills (Progressive Disclosure L1)',
    '',
    'You have access to these specialized capabilities. ' +
      'When a user request matches a skill description, you may invoke it via the Skill tool. ' +
      "Don't load full skill contents until needed (L2).",
    '',
  ];
  for (const m of visible) {
    lines.push(`- **${m.name}** — ${m.description}`);
  }
  return lines.join('\n');
}

/** L2 access: skill body 全文 (按需读) */
export function getSkillBody(name: string): string | null {
  const m = state.manifests.find((x) => x.name === name || x.id === name);
  return m?.body ?? null;
}
