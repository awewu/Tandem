import { Suspense } from 'react';
import ViewerParams from './ViewerParams';

export const metadata = {
  title: '瑞诺瓦 BIM 设计工作台',
};

export default function ViewerPage() {
  return (
    <main className="h-[calc(100vh-54px)] w-full overflow-hidden bg-[#f7f9fc] max-[980px]:h-auto max-[980px]:overflow-auto">
      <Suspense fallback={<div className="p-4 text-slate-700">正在加载 BIM 设计工作台...</div>}>
        <ViewerParams />
      </Suspense>
    </main>
  );
}
