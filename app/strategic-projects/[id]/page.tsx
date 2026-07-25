import { StrategicProjectDetail } from '@/components/strategic-projects/strategic-projects-client';
import { loadStrategicProjects } from '@/lib/strategic-projects/store';

export default async function StrategicProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolved = await params;
  const projects = await loadStrategicProjects();
  return <StrategicProjectDetail initialProjects={projects} projectId={resolved.id} />;
}
