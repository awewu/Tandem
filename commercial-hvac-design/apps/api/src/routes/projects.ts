import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// 内存存储（MVP阶段）
const projects: Array<{
  id: string;
  name: string;
  buildingType: string;
  location: string;
  createdAt: string;
  updatedAt: string;
}> = [];

/**
 * GET /api/projects
 * 获取项目列表
 */
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
  });
});

/**
 * POST /api/projects
 * 创建新项目
 */
router.post('/', (req, res) => {
  const { name, buildingType, location } = req.body;

  if (!name || !buildingType) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['name', 'buildingType'],
    });
  }

  const newProject = {
    id: uuidv4(),
    name,
    buildingType,
    location: location || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  projects.push(newProject);

  res.status(201).json({
    success: true,
    data: newProject,
  });
});

/**
 * GET /api/projects/:id
 * 获取项目详情
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const project = projects.find(p => p.id === id);

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json({
    success: true,
    data: project,
  });
});

/**
 * PUT /api/projects/:id
 * 更新项目
 */
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const projectIndex = projects.findIndex(p => p.id === id);

  if (projectIndex === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }

  projects[projectIndex] = {
    ...projects[projectIndex],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };

  res.json({
    success: true,
    data: projects[projectIndex],
  });
});

/**
 * DELETE /api/projects/:id
 * 删除项目
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const projectIndex = projects.findIndex(p => p.id === id);

  if (projectIndex === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }

  projects.splice(projectIndex, 1);

  res.json({
    success: true,
    message: 'Project deleted successfully',
  });
});

export { router as projectRoutes };
