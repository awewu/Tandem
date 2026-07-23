// 根路径由 next.config.js 重写到 /index-ready.html（早期静态落地页）
// 保留最小 page.tsx 以满足 Next.js app router 构建要求
export default function RootPage() {
  return null;
}
