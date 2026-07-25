import { StrategicProjectsList } from '@/components/strategic-projects/strategic-projects-client';
import { loadStrategicProjects } from '@/lib/strategic-projects/store';

export default async function StrategicProjectsPage() {
  const projects = await loadStrategicProjects();
  return <StrategicProjectsList initialProjects={projects} />;
}
