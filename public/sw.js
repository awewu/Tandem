/**
 * Tandem Service Worker · PWA + Web Push
 *
 * 注意:
 *   - 路径必须是 /sw.js 才能控制根路径下所有页面
 *   - 缓存策略: app shell + 静态资源 cache-first, API network-first
 */

const CACHE_NAME = 'tandem-v1';
const APP_SHELL = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(APP_SHELL).catch(() => undefined))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // API 请求 network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request)),
    );
    return;
  }
  // 静态资源 cache-first
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            const copy = res.clone();
            if (res.ok && url.origin === self.location.origin) {
              caches.open(CACHE_NAME).then((c) => c.put(event.request, copy)).catch(() => undefined);
            }
            return res;
          }),
      ),
    );
  }
});

self.addEventListener('push', (event) => {
  const data = (() => {
    try {
      return event.data?.json() ?? {};
    } catch {
      return { title: 'Tandem', body: event.data?.text() ?? '' };
    }
  })();
  const title = data.title || 'Tandem 通知';
  const body = data.body || '';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.openWindow(url));
});
