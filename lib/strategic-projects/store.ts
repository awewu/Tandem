import { promises as fs } from 'node:fs';
import path from 'node:path';
import { strategicProjects, type StrategicProject } from './sample-data';

const DATA_FILE = path.join(process.cwd(), 'var', 'strategic-projects.json');

function cloneOfficialProjects(): StrategicProject[] {
  return JSON.parse(JSON.stringify(strategicProjects)) as StrategicProject[];
}

export async function loadStrategicProjects(): Promise<StrategicProject[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw) as StrategicProject[];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') throw error;
    return cloneOfficialProjects();
  }
}

export async function saveStrategicProjects(projects: StrategicProject[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, `${JSON.stringify(projects, null, 2)}\n`, 'utf8');
}

export async function resetStrategicProjects(): Promise<StrategicProject[]> {
  const projects = cloneOfficialProjects();
  await saveStrategicProjects(projects);
  return projects;
}
