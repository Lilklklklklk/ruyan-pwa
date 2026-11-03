/* 如烟 PWA 离线缓存
 * 页面/脚本/配置走「网络优先」:这些文件很小,而且 config.js 里存着后端地址,
 *   用缓存优先会导致换了后端地址手机还在打老地址(2026-11-03 换 FC 函数踩过)。
 * 图标等静态资源走「缓存优先」,离线也能开。
 */
const CACHE = 'ruyan-shell-v2';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;   // 后端 API 跨域,直接走网络
  if (u.pathname.startsWith('/api/')) return;

  const networkFirst = u.pathname.endsWith('/') || /\.(html|js|json)$/i.test(u.pathname);

  if (networkFirst) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() =>
        caches.match(req).then(hit => hit || caches.match('./index.html'))
      )
    );
    return;
  }

  // 静态资源:缓存优先,后台顺手更新
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
