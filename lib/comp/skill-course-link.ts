/**
 * 技能缺口 → 学院课程关联 (PRD §5.2A)
 *
 * 纯函数: 从技能缺口列表 + 学院课程列表, 按名称/关键词匹配推荐课程。
 * 闭环: 技能缺口 → 推荐课程 → 学完 → 提交认证 → 升级 → 加薪
 */

export interface GapSkill {
  id: string;
  name: string;
  skillWage: number;
}

export interface LessonLite {
  id: string;
  title: string;
  summary?: string;
  category?: string;
}

export interface SkillCourseRecommendation {
  skillId: string;
  skillName: string;
  courses: LessonLite[];
}

/** 从技能缺口 + 课程列表匹配推荐课程 */
export function matchGapToCourses(
  gapSkills: GapSkill[],
  lessons: LessonLite[],
): SkillCourseRecommendation[] {
  return gapSkills.map((skill) => {
    const courses = lessons.filter((lesson) => {
      const title = lesson.title.toLowerCase();
      const summary = (lesson.summary ?? '').toLowerCase();
      const skillName = skill.name.toLowerCase();
      const skillKeywords = skillName.split(/[\s/·、]+/).filter((w) => w.length >= 2);

      return (
        title.includes(skillName) ||
        summary.includes(skillName) ||
        skillKeywords.some((kw) => title.includes(kw) || summary.includes(kw))
      );
    });

    return {
      skillId: skill.id,
      skillName: skill.name,
      courses,
    };
  });
}
