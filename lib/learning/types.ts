/**
 * Learning Center · 类型定义 (P2 MVP)
 *
 * 设计原则:
 *  - 课程内容是 Material 衍生包 (走 §7 4 层架构, 不直接入 Memory)
 *  - 完成认证 → KR 进度推流 (P5 闭环)
 *  - 完成学习 → Mode Proficiency +N (P5 闭环)
 *  - 红线类必修过期 → 锁权限 (P4 强校准)
 */

export type LessonCategory =
  | 'onboarding'      // 入职必修
  | 'compliance'      // 合规与红线 (季度必修)
  | 'products'        // 产品学院
  | 'processes'       // 流程与标准
  | 'tracks';         // 专项进阶

export type LessonRequirement =
  | 'mandatory_once'      // 一次性必修 (入职)
  | 'mandatory_quarterly' // 季度必修 (合规)
  | 'recommended'         // 推荐
  | 'elective';           // 选修 (专项)

export interface Lesson {
  id: string;
  title: string;
  category: LessonCategory;
  requirement: LessonRequirement;
  /** 预估学习时长 (分钟) */
  durationMin: number;
  /** 简介 (1-2 句) */
  summary: string;
  /** 课程内容来自哪些 Material/Memory (引用 ID) */
  sourceRefs: { type: 'memory' | 'material' | 'document'; id: string }[];
  /** 完成后给哪个 Mode 加 proficiency (P5 闭环) */
  rewardMode?: import('../persona/skill-modes').SkillMode;
  rewardScore?: number;
  /** 该课程是否绑定 KR (完成→进度推流) */
  linkedKrId?: string;
}

export interface LessonAttempt {
  id: string;
  lessonId: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  /** 5 题答题成绩 (0-100) */
  score?: number;
  /** 是否通过 (>= 60) */
  passed?: boolean;
  /** 失败时的错题 */
  wrongQuestions?: number[];
}

export interface Certification {
  id: string;
  userId: string;
  lessonId: string;
  earnedAt: string;
  /** 季度必修 / 时效证书的过期时间 */
  expiresAt?: string;
  /** 是否在过期 grace period (24h) 内 */
  inGracePeriod?: boolean;
}

/** AI 生成课程的输入 */
export interface GenerateLessonInput {
  /** 来源文档/Memory id */
  sourceId: string;
  sourceType: 'memory' | 'material' | 'document';
  /** 目标员工 (用于个性化) */
  userId: string;
  /** 期望分类 */
  category: LessonCategory;
}

export interface GeneratedLesson {
  /** 流式段: 讲解 */
  lecture: string;
  /** 5 题选择题 */
  questions: GeneratedQuestion[];
  /** 摘要卡 (3-5 行 takeaway) */
  summaryCard: string[];
}

export interface GeneratedQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswerIdx: number;
  explanation: string;
}
