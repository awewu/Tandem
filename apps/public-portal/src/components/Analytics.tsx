import Script from 'next/script';

/**
 * 统计与监控（按需启用 · 环境变量驱动）
 * ─────────────────────────────────────────
 * 未配置对应环境变量时不注入任何脚本，零副作用。
 *  - NEXT_PUBLIC_BAIDU_ID  百度统计站点 id（中国大陆推荐）
 *  - NEXT_PUBLIC_GA_ID     Google Analytics 4 衡量 id（海外，注意大陆可能被墙）
 * 错误监控（Sentry 等）可在 app/error.tsx / global-error.tsx 的上报点接入。
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const BAIDU_ID = process.env.NEXT_PUBLIC_BAIDU_ID;

export default function Analytics() {
  return (
    <>
      {BAIDU_ID && (
        <Script id="baidu-tongji" strategy="afterInteractive">
          {`var _hmt=_hmt||[];(function(){var hm=document.createElement("script");hm.src="https://hm.baidu.com/hm.js?${BAIDU_ID}";var s=document.getElementsByTagName("script")[0];s.parentNode.insertBefore(hm,s);})();`}
        </Script>
      )}
      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}
    </>
  );
}
