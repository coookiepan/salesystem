// H2 測試：PWA 離線
// 不依賴真瀏覽器：用假的 Cache API + FetchEvent 載入 sw.js，驗證
//   1) install 會把 app shell 預快取
//   2) HTML 網路優先；離線時退回快取（核心：沒網路也開得起來）
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

  // HTML 上線 → 網路優先（拿最新程式）
  fetchImpl = async () => new Resp('network:index');
  ev = { request: { method: 'GET', url: 'https://x.github.io/salesystem/', mode: 'navigate', headers: { get: () => 'text/html' } }, respondWith(p) { this.p = p; } };
  handlers.fetch(ev); res = await ev.p;
  assert('上線時 HTML 走網路（拿最新）', res.tag === 'network:index');

  // POST 不攔（不干擾 Apps Script 寫入）
  ev = { request: { method: 'POST', url: 'https://script.google.com/x/exec', mode: 'cors', headers: { get: () => null } }, respondWith() { this.called = true; } };
  handlers.fetch(ev);
  assert('寫入 POST 不被 SW 攔截', ev.called !== true);

  // 跨網域 GET 不攔
  ev = { request: { method: 'GET', url: 'https://unpkg.com/leaflet.js', mode: 'cors', headers: { get: () => '' } }, respondWith() { this.called = true; } };
  handlers.fetch(ev);
  assert('跨網域 GET 不被 SW 攔截', ev.called !== true);

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
