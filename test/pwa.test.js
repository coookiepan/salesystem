// H2 測試：PWA 離線
// 不依賴真瀏覽器：用假的 Cache API + FetchEvent 載入 sw.js，驗證
//   1) install 會把 app shell 預快取
//   2) HTML 快取優先＋背景更新（SWR）；離線退回快取（核心：沒網路也開得起來、切頁不等網路）
//   3) 寫入(POST)與跨網域請求完全不攔（不會干擾 Apps Script 同步）
// 另外靜態檢查 index.html 有註冊 SW / 連 manifest，manifest 本身是合法 JSON。
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

let failed = 0;
function assert(name, cond) { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) failed++; }

console.log('H2 — PWA 離線');

// ---- 用假環境載入 sw.js ----
const swCode = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const keyOf = k => (typeof k === 'string' ? k : (k && k.url) || String(k));
class Resp { constructor(tag) { this.tag = tag; } clone() { return new Resp(this.tag); } }
class Cache {
  constructor() { this.m = new Map(); }
  async put(k, v) { this.m.set(keyOf(k), v); }
  async match(k) { return this.m.get(keyOf(k)); }
  async addAll(list) { for (const u of list) this.m.set(keyOf(u), new Resp('precached:' + u)); }
}
const cacheStore = new Map();
const caches = {
  async open(n) { if (!cacheStore.has(n)) cacheStore.set(n, new Cache()); return cacheStore.get(n); },
  async match(k) { for (const c of cacheStore.values()) { const r = await c.match(k); if (r) return r; } return undefined; },
  async keys() { return [...cacheStore.keys()]; },
  async delete(n) { return cacheStore.delete(n); }
};
const Response = { error() { return new Resp('error'); } };
const handlers = {};
const self = {
  location: { origin: 'https://x.github.io' },
  skipWaiting() {}, clients: { async claim() {} },
  addEventListener(t, fn) { handlers[t] = fn; }
};
let fetchImpl = async () => { throw new Error('offline'); };
const fetchFn = (...a) => fetchImpl(...a);
new Function('self', 'caches', 'fetch', 'Response', 'URL', swCode)(self, caches, fetchFn, Response, URL);

(async () => {
  // install → 預快取
  const iev = { waitUntil(p) { this.p = p; } }; handlers.install(iev); await iev.p;
  const shell = await caches.match('./index.html');
  assert('install 後 index.html 已預快取', !!shell);

  // 剛安裝就離線（冷快取）→ 退回預快取的 shell（核心離線能力）
  fetchImpl = async () => { throw new Error('offline'); };
  let ev = { request: { method: 'GET', url: 'https://x.github.io/salesystem/', mode: 'navigate', headers: { get: () => 'text/html' } }, respondWith(p) { this.p = p; } };
  handlers.fetch(ev); let res = await ev.p;
  assert('剛安裝即離線也能開（退回預快取 shell）', res && /index\.html/.test(res.tag) && res.tag !== 'error');

  // HTML SWR：上一步離線開啟後仍無快取；先上線開一次讓快取入庫
  fetchImpl = async () => new Resp('network:v1');
  ev = { request: { method: 'GET', url: 'https://x.github.io/salesystem/', mode: 'navigate', headers: { get: () => 'text/html' } }, respondWith(p) { this.p = p; }, waitUntil(p) { this.w = p; } };
  handlers.fetch(ev); res = await ev.p;
  assert('首次（無快取）等網路取得頁面', res.tag === 'network:v1');
  // 之後同頁：立即回快取（不等網路），新版在背景更新快取
  fetchImpl = async () => new Resp('network:v2');
  ev = { request: { method: 'GET', url: 'https://x.github.io/salesystem/', mode: 'navigate', headers: { get: () => 'text/html' } }, respondWith(p) { this.p = p; }, waitUntil(p) { this.w = p; } };
  handlers.fetch(ev); res = await ev.p;
  assert('有快取時 HTML 立即回快取（切頁秒開）', res.tag === 'network:v1');
  if (ev.w) await ev.w;
  fetchImpl = async () => { throw new Error('offline'); };
  ev = { request: { method: 'GET', url: 'https://x.github.io/salesystem/', mode: 'navigate', headers: { get: () => 'text/html' } }, respondWith(p) { this.p = p; }, waitUntil() {} };
  handlers.fetch(ev); res = await ev.p;
  assert('背景更新已入快取（下次開啟就是新版）', res.tag === 'network:v2');

  // POST 不攔（不干擾 Apps Script 寫入）
  ev = { request: { method: 'POST', url: 'https://script.google.com/x/exec', mode: 'cors', headers: { get: () => null } }, respondWith() { this.called = true; } };
  handlers.fetch(ev);
  assert('寫入 POST 不被 SW 攔截', ev.called !== true);

  // 一般跨網域 GET（非 leaflet）不攔，例如地圖磚
  ev = { request: { method: 'GET', url: 'https://tile.openstreetmap.org/1/2/3.png', mode: 'cors', headers: { get: () => '' } }, respondWith() { this.called = true; } };
  handlers.fetch(ev);
  assert('一般跨網域 GET（地圖磚）不被攔截', ev.called !== true);

  // M4：Leaflet CDN 跨網域 GET → 被攔截並由快取提供（install 已預快取）
  ev = { request: { method: 'GET', url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', mode: 'cors', headers: { get: () => '' } }, respondWith(p) { this.p = p; this.called = true; } };
  handlers.fetch(ev);
  assert('Leaflet CDN 被 SW 攔截（快取優先）', ev.called === true);
  res = await ev.p;
  assert('Leaflet 由快取提供（離線可用地圖程式庫）', res && /leaflet/.test(res.tag));
  // 離線時（fetch 失敗）leaflet 仍由快取回應
  fetchImpl = async () => { throw new Error('offline'); };
  ev = { request: { method: 'GET', url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', mode: 'cors', headers: { get: () => '' } }, respondWith(p) { this.p = p; } };
  handlers.fetch(ev); res = await ev.p;
  assert('Leaflet CSS 離線時由快取提供', res && /leaflet/.test(res.tag));

  // ---- 靜態檢查 ----
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert('index.html 註冊 Service Worker', /serviceWorker.+register\(\s*['"]sw\.js['"]/s.test(html));
  assert('index.html 連結 manifest', /rel="manifest"\s+href="manifest\.webmanifest"/.test(html));
  assert('index.html 有 theme-color', /name="theme-color"/.test(html));
  let mani; try { mani = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8')); } catch (e) {}
  assert('manifest 為合法 JSON 且含 start_url/display/icons', !!mani && !!mani.start_url && mani.display === 'standalone' && Array.isArray(mani.icons) && mani.icons.length > 0);
  assert('icon.svg 存在', fs.existsSync(path.join(root, 'icon.svg')));

  console.log(failed ? `H2 FAILED (${failed})` : 'H2 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('THROWN', e); process.exit(1); });
