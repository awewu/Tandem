import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const inputDir = process.argv[2] ?? 'C:/Users/E00949/Desktop/V项目数据';
const outputFile = path.join(repoRoot, 'lib/strategic-projects/official-data.json');

function text(value) {
  return String(value ?? '').trim();
}

function cleanName(value) {
  return text(value)
    .replace(/^\s*项目：/, '')
    .replace(/^\s*里程碑\d+：/, '')
    .replace(/^\s*\d+级：/, '')
    .replace(/^:+/, '')
    .trim();
}

function parsePercent(value) {
  const match = text(value).match(/[\d.]+/);
  return match ? Number(match[0]) : 0;
}

function parseTaskRatio(value) {
  const match = text(value).match(/(\d+)\s*\/\s*(\d+)/);
  return {
    completed: match ? Number(match[1]) : 0,
    total: match ? Number(match[2]) : 0,
  };
}

function normalizeProjectStatus(value) {
  const raw = text(value);
  if (raw.includes('已完成')) return '已完成';
  if (raw.includes('未开始')) return '未开始';
  return '进行中';
}

function normalizeTaskStatus(value) {
  const raw = text(value);
  if (raw.includes('已完成')) return '已完成';
  if (raw.includes('取消')) return '已取消';
  if (raw.includes('未接受')) return '未接受';
  return '进行中';
}

function riskFrom(rawStatus, completion) {
  if (/逾期|延期|延迟/.test(rawStatus)) {
    return { risk: 'overdue', riskLabel: '已有延期...' };
  }
  if (completion < 50) {
    return { risk: 'attention', riskLabel: '注意风险' };
  }
  return { risk: 'normal', riskLabel: '正常推进' };
}

function priorityLabel(value) {
  const raw = text(value);
  if (raw === '高') return 'P2';
  if (raw === '中') return 'P3';
  if (raw === '低') return 'P4';
  return raw || 'P3';
}

function projectIdFromName(name, fallback) {
  const match = name.match(/^V(\d+)/i);
  return match ? `v${match[1]}` : fallback;
}

function headerIndex(headers, name) {
  return headers.findIndex((header) => text(header) === name);
}

function columnText(row, index) {
  return index >= 0 ? text(row[index]) : '';
}

function parsePerson(value) {
  const first = text(value)
    .split(/[,，;；、]/)
    .map((item) => item.trim())
    .find((item) => item && item !== '-');
  if (!first) return { name: '', department: '' };

  const match = first.match(/^(.+?)[（(](.*)[）)]$/);
  if (!match) return { name: first, department: '' };
  return { name: match[1].trim(), department: match[2].trim() };
}

function resolveOwner(row, columns, fallback = { name: '-', department: '' }) {
  const ownerName = columnText(row, columns.owner);
  const ownerDepartment = columnText(row, columns.ownerDepartment);
  if (ownerName && ownerName !== '-') {
    return { name: ownerName, department: ownerDepartment };
  }

  const participant = parsePerson(columnText(row, columns.participants));
  if (participant.name) return participant;
  return fallback;
}

function averageProgress(tasks) {
  if (tasks.length === 0) return 0;
  return Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length);
}

function parseWorkbook(filePath, index) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  const exportInfo = text(rows[1]?.[0]);
  const headers = rows[2] ?? [];
  const columns = {
    owner: headerIndex(headers, '负责人'),
    ownerDepartment: headerIndex(headers, '负责人部门'),
    participants: headerIndex(headers, '参与人'),
  };

  let project = null;
  let currentMilestone = null;
  const milestones = [];

  for (let rowIndex = 3; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const projectCell = text(row[0]);
    const milestoneCell = text(row[1]);
    const taskCell = text(row[2]);

    if (projectCell.startsWith('项目：')) {
      const name = cleanName(projectCell);
      const id = projectIdFromName(name, `project-${index + 1}`);
      const completion = parsePercent(row[7]);
      const ratio = parseTaskRatio(row[6]);
      const rawStatus = text(row[5]);
      const risk = riskFrom(rawStatus, completion);
      const owner = resolveOwner(row, columns);

      project = {
        id,
        name,
        status: normalizeProjectStatus(rawStatus),
        rawStatus,
        risk: risk.risk,
        riskLabel: risk.riskLabel,
        owner: owner.name || '-',
        ownerDepartment: owner.department,
        completion,
        completionText: `${completion % 1 === 0 ? completion.toFixed(0) : completion.toFixed(2)}%`,
        completedTasks: ratio.completed,
        totalTasks: ratio.total,
        tasksText: `${ratio.completed}/${ratio.total}`,
        overdueTasks: 0,
        startDate: text(row[13]),
        dueDate: text(row[14]),
        objective: text(row[17]) || '-',
        progressChip: `${completion % 1 === 0 ? completion.toFixed(0) : completion.toFixed(2)}%`,
        participants: columnText(row, columns.participants),
        sourceFile: path.basename(filePath),
        exportInfo,
        milestones,
      };
      continue;
    }

    if (milestoneCell.startsWith('里程碑')) {
      const id = `${project?.id ?? `project-${index + 1}`}-m${milestones.length + 1}`;
      currentMilestone = {
        id,
        title: cleanName(milestoneCell),
        owner: project?.owner ?? '-',
        dueDate: project?.dueDate ?? '-',
        progress: 0,
        tone: milestones.length % 2 === 0 ? 'blue' : 'yellow',
        tasks: [],
      };
      milestones.push(currentMilestone);
      continue;
    }

    if (taskCell && currentMilestone) {
      const rawStatus = text(row[5]);
      const progress = parsePercent(row[7]);
      const owner = resolveOwner(row, columns, { name: project?.owner ?? '-', department: project?.ownerDepartment ?? '' });
      const task = {
        id: `${currentMilestone.id}-t${currentMilestone.tasks.length + 1}`,
        title: cleanName(taskCell),
        priority: priorityLabel(row[10]),
        status: normalizeTaskStatus(rawStatus),
        rawStatus,
        owner: owner.name || project?.owner || '-',
        ownerDepartment: owner.department,
        participants: columnText(row, columns.participants),
        startDate: text(row[13]),
        dueDate: text(row[14]),
        completedAt: text(row[15]),
        progress,
        latestProgress: text(row[22]) || text(row[8]),
        description: text(row[17]),
        overdueText: /延迟|逾期|延期/.test(rawStatus) ? rawStatus.replace(/^.*?[（(]/, '').replace(/[）)]$/, '') : '',
      };
      currentMilestone.tasks.push(task);
    }
  }

  if (!project) {
    throw new Error(`No project row found in ${filePath}`);
  }

  for (const milestone of milestones) {
    milestone.progress = averageProgress(milestone.tasks);
    const ownerCounts = new Map();
    for (const task of milestone.tasks) {
      ownerCounts.set(task.owner, (ownerCounts.get(task.owner) ?? 0) + 1);
    }
    const topOwner = [...ownerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (topOwner) milestone.owner = topOwner;
    const dueDates = milestone.tasks.map((task) => task.dueDate).filter(Boolean);
    if (dueDates.length > 0) milestone.dueDate = dueDates[dueDates.length - 1];
  }

  if (project.owner === '-' || columns.owner < 0) {
    const ownerCounts = new Map();
    const ownerDepartments = new Map();
    for (const task of milestones.flatMap((milestone) => milestone.tasks)) {
      if (!task.owner || task.owner === '-') continue;
      ownerCounts.set(task.owner, (ownerCounts.get(task.owner) ?? 0) + 1);
      if (task.ownerDepartment && !ownerDepartments.has(task.owner)) {
        ownerDepartments.set(task.owner, task.ownerDepartment);
      }
    }
    const topOwner = [...ownerCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (topOwner) {
      project.owner = topOwner;
      project.ownerDepartment = ownerDepartments.get(topOwner) ?? project.ownerDepartment;
    }
  }

  project.overdueTasks = milestones
    .flatMap((milestone) => milestone.tasks)
    .filter((task) => /延迟|逾期|延期/.test(task.rawStatus)).length;

  return project;
}

if (!fs.existsSync(inputDir)) {
  throw new Error(`Input directory does not exist: ${inputDir}`);
}

const files = fs
  .readdirSync(inputDir)
  .filter((file) => /\.xls$/i.test(file))
  .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

const projects = files.map((file, index) => parseWorkbook(path.join(inputDir, file), index));

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, `${JSON.stringify(projects, null, 2)}\n`, 'utf8');

console.log(`Imported ${projects.length} strategic projects to ${outputFile}`);
