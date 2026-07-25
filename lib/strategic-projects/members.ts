import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadStrategicProjects } from './store';
import type { StrategicProject } from './sample-data';

const DATA_FILE = path.join(process.cwd(), 'var', 'strategic-project-members.json');

export interface StrategicProjectMember {
  id: string;
  name: string;
  department?: string;
}

function memberKey(name: string) {
  return name.trim().toLowerCase();
}

function makeMember(name: string, department?: string): StrategicProjectMember {
  const cleanName = name.trim();
  const cleanDepartment = department?.trim();
  return {
    id: memberKey(cleanName),
    name: cleanName,
    department: cleanDepartment || undefined,
  };
}

function addMember(map: Map<string, StrategicProjectMember>, name?: string, department?: string) {
  const cleanName = name?.trim();
  if (!cleanName || cleanName === '-') return;
  const next = makeMember(cleanName, department);
  const existing = map.get(next.id);
  if (!existing) {
    map.set(next.id, next);
  } else if (!existing.department && next.department) {
    map.set(next.id, next);
  }
}

function participantNames(value?: string) {
  return (value ?? '')
    .split(/[,，;；、]/)
    .map((item) => item.replace(/[（(].*$/, '').trim())
    .filter((name) => name && name !== '-');
}

export function deriveStrategicProjectMembers(projects: StrategicProject[]): StrategicProjectMember[] {
  const members = new Map<string, StrategicProjectMember>();
  for (const project of projects) {
    addMember(members, project.owner, project.ownerDepartment);
    participantNames(project.participants).forEach((name) => addMember(members, name));
    for (const milestone of project.milestones) {
      addMember(members, milestone.owner, milestone.ownerDepartment);
      for (const task of milestone.tasks) {
        addMember(members, task.owner, task.ownerDepartment);
        participantNames(task.participants).forEach((name) => addMember(members, name));
      }
    }
  }
  return Array.from(members.values());
}

async function loadManualMembers(): Promise<StrategicProjectMember[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const members = JSON.parse(raw) as StrategicProjectMember[];
    return Array.isArray(members) ? members : [];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw error;
    return [];
  }
}

async function saveManualMembers(members: StrategicProjectMember[]) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, `${JSON.stringify(members, null, 2)}\n`, 'utf8');
}

function mergeMembers(...groups: StrategicProjectMember[][]) {
  const map = new Map<string, StrategicProjectMember>();
  for (const members of groups) {
    for (const member of members) {
      addMember(map, member.name, member.department);
    }
  }
  return Array.from(map.values());
}

export async function loadStrategicProjectMembers() {
  const [projects, manualMembers] = await Promise.all([loadStrategicProjects(), loadManualMembers()]);
  return mergeMembers(deriveStrategicProjectMembers(projects), manualMembers);
}

export async function addStrategicProjectMember(input: { name: string; department?: string }) {
  const manualMembers = await loadManualMembers();
  const nextMember = makeMember(input.name, input.department);
  const nextManualMembers = mergeMembers(manualMembers, [nextMember]);
  await saveManualMembers(nextManualMembers);
  return loadStrategicProjectMembers();
}
