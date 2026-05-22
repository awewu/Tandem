/**
 * GET /api/agent-skills
 *   返回当前已注册的 Agent Skills (Anthropic SKILL.md 兼容).
 *
 * GET /api/agent-skills?name=kpi-bonus
 *   返回单个 skill 的 body (L2 progressive disclosure).
 *
 * 注意: 这与 `/api/skills` (员工技能图谱) 不同.
 *   - /api/skills → 员工的硬技能 (Java, 客户管理, ...) 用于 9-box / persona
 *   - /api/agent-skills → AI agent 可调用的能力包 (Anthropic Skills 标准)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { loadSkills, getLoadedSkills, getSkillBody, buildSkillsSystemPrompt } from '@/lib/skills/registry';

let _booted = false;
async function ensureLoaded() {
  if (_booted) return;
  await loadSkills();
  _booted = true;
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  await ensureLoaded();

  const url = new URL(req.url);
  const name = url.searchParams.get('name');
  if (name) {
    const body = getSkillBody(name);
    if (!body) return NextResponse.json({ error: 'skill_not_found' }, { status: 404 });
    return NextResponse.json({ name, body });
  }

  const all = getLoadedSkills();
  const visible = all.filter((m) => {
    if (m.allowedRoles && m.allowedRoles.length > 0) {
      if (!m.allowedRoles.some((r) => auth.roles.includes(r))) return false;
    }
    return true;
  });

  return NextResponse.json({
    skills: visible.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      allowedRoles: m.allowedRoles,
      permissions: m.permissions,
    })),
    systemPrompt: buildSkillsSystemPrompt({
      userRoles: auth.roles,
      userPermissions: [], // TODO: pipe through real permissions when permission framework is ready
    }),
  });
}
