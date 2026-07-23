import { HubReturnButton } from '@rhautt/shared-auth';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <title>客户服务门户</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <style>{`*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif;background:#f5f7fa;color:#1a1f36}`}</style>
      </head>
      <body>
        {children}
        <HubReturnButton />
      </body>
    </html>
  );
}
