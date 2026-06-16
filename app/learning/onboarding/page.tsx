import { CategoryLessonList } from '@/components/learning/CategoryLessonList';

export default function OnboardingPage() {
  return (
    <CategoryLessonList
      category="onboarding"
      title="入职必修"
      subtitle="新员工第一周必学 · 30/60/90 天目标"
    />
  );
}
