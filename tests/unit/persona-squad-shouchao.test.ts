/**
 * 分身编队 (B-037) · 批一 · 手抄方案丙定向喂养 + 小组治理注入 单测
 *
 * 覆盖:
 *   A. retrieveSharedNotesForPersona 方案丙: 全队笔记喂任意分身; 定向笔记只喂命中分身; 无 personaId 上下文时定向笔记不进
 *   B. 端到端 (防假闭环): runSquadPanel 经 governedChat, 定向到某技能分身的手抄真出现在
 *      该分身草稿的 system prompt, 且不串进其它技能分身。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getStore, setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { createNote, setSharedToPersona, retrieveSharedNotesForPersona } from '@/lib/shouchao/service';
import { createPersona } from '@/lib/persona/evolution';
import { forkSkillPersona } from '@/lib/persona/fork';
import { runSquadPanel } from '@/lib/persona/expert-panel';
import type { AgentTemplate } from '@/lib/types/agent-template';
import type { ChatRequest, ChatResponse } from '@/lib/taf/provider/types';

const USER = 'u_alice';
const G = globalThis as unknown as { __tandem_router__?: unknown };

function installCapturingRouter() {
  const calls: ChatRequest[] = [];
  G.__tandem_router__ = {
    async chat(req: ChatRequest): Promise<ChatResponse> {
      calls.push(req);
      return {
        id: 'fake',
        message: { role: 'assistant', content: `draft ${req.metadata?.requestId ?? ''}` },
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        model: 'fake',
      };
    },
    chatStream: async function* () { /* unused */ },
    listProviders: () => ['fake'],
    healthCheckAll: async () => ({}),
  };
  return calls;
}

async function seedTemplate(specialty: string, name: string): Promise<AgentTemplate> {
  const now = new Date().toISOString();
  return getStore().agentTemplates.create({
    tenantId: 'default',
    name,
    specialty,
    origin: 'internal',
    basePrompt: `你是${name}`,
    defaultSkills: [],
    defaultKnowledgeTags: [],
    status: 'published',
    createdBy: 'admin@tandem.local',
    createdAt: now,
    updatedAt: now,
  } as Omit<AgentTemplate, 'id'>);
}

beforeEach(() => {
  setStore(createInMemoryStore());
});

afterEach(() => {
  delete G.__tandem_router__;
});

describe('A · retrieveSharedNotesForPersona 方案丙定向', () => {
  it('全队笔记喂任意分身; 定向笔记只喂命中分身; 无 personaId 时定向不进', async () => {
    const team = await createNote({ ownerId: USER, tenantId: 'default', title: '全队', content: '我是夜猫子' });
    await setSharedToPersona(USER, team.id, true); // 空定向 = 全队
    const fin = await createNote({ ownerId: USER, tenantId: 'default', title: '财务专供', content: '财务口径XYZ' });
    await setSharedToPersona(USER, fin.id, true, ['persona_fin']); // 定向财务分身

    const forFin = await retrieveSharedNotesForPersona(USER, '', { personaId: 'persona_fin' });
    expect(forFin.map((n) => n.id).sort()).toEqual([team.id, fin.id].sort());

    const forTech = await retrieveSharedNotesForPersona(USER, '', { personaId: 'persona_tech' });
    expect(forTech.map((n) => n.id)).toEqual([team.id]);

    const forNone = await retrieveSharedNotesForPersona(USER, '');
    expect(forNone.map((n) => n.id)).toEqual([team.id]);
  });

  it('撤回授权 → 清空定向且不再召回', async () => {
    const fin = await createNote({ ownerId: USER, tenantId: 'default', title: 'x', content: 'y' });
    await setSharedToPersona(USER, fin.id, true, ['persona_fin']);
    expect(await retrieveSharedNotesForPersona(USER, '', { personaId: 'persona_fin' })).toHaveLength(1);

    const off = await setSharedToPersona(USER, fin.id, false);
    expect(off!.sharedToPersona).toBe(false);
    expect(off!.sharedToPersonaIds).toEqual([]);
    expect(await retrieveSharedNotesForPersona(USER, '', { personaId: 'persona_fin' })).toHaveLength(0);
  });
});

describe('B · 小组起草经治理, 手抄定向真注入 (端到端)', () => {
  it('定向到财务分身的手抄进财务草稿 system prompt, 不串进技术草稿; 全队手抄两者都进', async () => {
    await createPersona(USER);
    const finance = await forkSkillPersona(USER, (await seedTemplate('finance', '财务')).id);
    const tech = await forkSkillPersona(USER, (await seedTemplate('tech', '技术')).id);

    const teamMarker = '我偏好数据驱动的表达TEAMMARK';
    const finMarker = '财务专供口径FINMARK';
    const team = await createNote({ ownerId: USER, tenantId: 'default', title: '全队背景', content: teamMarker });
    await setSharedToPersona(USER, team.id, true);
    const finNote = await createNote({ ownerId: USER, tenantId: 'default', title: '财务专供', content: finMarker });
    await setSharedToPersona(USER, finNote.id, true, [finance.id]);

    const calls = installCapturingRouter();
    const result = await runSquadPanel(USER, '要不要上这个项目');
    expect(result.drafts.every((d) => d.ok)).toBe(true);

    const sysFor = (personaId: string): string => {
      const c = calls.find((x) => x.metadata?.requestId === `squad-panel:${personaId}`);
      expect(c, `missing call for ${personaId}`).toBeTruthy();
      return String(c!.messages[0].content);
    };

    const finSys = sysFor(finance.id);
    const techSys = sysFor(tech.id);

    // 财务分身: 全队 + 财务定向 都进
    expect(finSys).toContain('个人手抄语料');
    expect(finSys).toContain(teamMarker);
    expect(finSys).toContain(finMarker);

    // 技术分身: 只有全队, 绝不含财务定向
    expect(techSys).toContain(teamMarker);
    expect(techSys).not.toContain(finMarker);

    // 治理框仍在 (受控 + 不得破红线)
    expect(finSys).toContain('不得据此突破企业红线');
  });
});
