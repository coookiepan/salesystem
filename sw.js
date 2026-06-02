// DUSKIN 銷售系統 — Service Worker（H2 PWA 離線）
// 目標：沒網路時也能開啟 App（搭配 localStorage 資料 + C2 待推送佇列離線作業）。
// 策略：HTML 文件「網路優先、離線退回快取」（上線一定拿到最新程式）；
//       其他同網域靜態資源「快取優先」。對 Apps Script 的寫入(POST/跨網域)完全不攔。
const CACHE = 'duskin-shell-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // 寫入(POST 到 Apps Script)不攔
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // 跨網域(Google Script / unpkg)不攔

  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    // 網路優先：上線時永遠拿到最新 index.html，順手更新快取；離線才退回快取
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const c = await caches.open(CACHE);
        c.put('./index.html', fresh.clone());
        return fresh;
      } catch (err) {
        return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
      }
    })());
    return;
  }

  // 其他同網域 GET：快取優先，缺了再上網並補進快取
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      const c = await caches.open(CACHE);
      c.put(req, fresh.clone());
      return fresh;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});
