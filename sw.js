// DUSKIN 銷售系統 — Service Worker（H2 PWA 離線 / M4 離線地圖）
// 目標：沒網路時也能開啟 App（搭配 localStorage 資料 + C2 待推送佇列離線作業）。
// 策略：
//   - HTML 文件：快取優先＋背景更新（stale-while-revalidate）——切頁秒開，
//     新版背景抓、下次開啟生效；App 內版本橫幅照樣提示更新。
//   - 同網域靜態資源：快取優先。
//   - Leaflet CDN（版本固定、immutable，且帶 CORS 標頭可安全重播）：快取優先，
//     讓離線也能載入地圖程式庫與樣式（M4）。地圖磚 tile 本質需連線，不快取。
//   - 對 Apps Script 的寫入(POST)與其他跨網域請求：完全不攔。
const CACHE = 'duskin-shell-v35';
const SHELL = ['./', './index.html', './home.html', './izcrm.html', './izdata.json', './sitemap.html', './tokens.css', './nav.js', './manifest.webmanifest', './icon.svg', './logo-mark.svg'];
const CDN = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];
function isLeafletCDN(url) { return url.hostname === 'unpkg.com' && url.pathname.indexOf('leaflet') !== -1; }

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    const c = await caches.open(CACHE);
    c.put(req, fresh.clone());
    return fresh;
  } catch (e) { return cached || Response.error(); }
}

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.all([
    c.addAll(SHELL).catch(() => {}),
    c.addAll(CDN).catch(() => {})   // best-effort：離線安裝時略過
  ])));
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

  if (url.origin !== self.location.origin) {
    // 跨網域：只特例處理 Leaflet CDN（快取優先），其餘（Apps Script、地圖磚等）不攔
    if (isLeafletCDN(url)) e.respondWith(cacheFirst(req));
    return;
  }

  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    // 快取優先＋背景更新：有快取立即回（切頁不等網路），同時背景抓新版更新快取；
    // 沒快取（首次）才等網路。快取 key 用實際請求（各頁各自獨立），不可寫死。
    e.respondWith((async () => {
      const cached = await caches.match(req);
      const refresh = fetch(req).then(async fresh => {
        // 只快取 2xx：擋 captive portal / 5xx 錯誤頁污染外殼快取
        if (fresh && fresh.ok) {
          const c = await caches.open(CACHE);
          c.put(req, fresh.clone());
        }
        return fresh;
      }).catch(() => null);
      if (cached) { e.waitUntil(refresh); return cached; }
      const fresh = await refresh;
      return fresh || (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
    })());
    return;
  }

  // 其他同網域 GET：快取優先，缺了再上網並補進快取
  e.respondWith(cacheFirst(req));
});
