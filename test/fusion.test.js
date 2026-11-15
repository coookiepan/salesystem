// F1 工地地圖 ↔ 主系統：主系統端「轉為客戶」＋回執信箱；
//    客戶分類（街邊店/工廠）遷移與視角、可自訂類別選項。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.join(__dirname, '..');
const mainHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const smHtml = fs.readFileSync(path.join(root, 'sitemap.html'), 'utf8');

let failed = 0;
const assert = (n, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) failed++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const TODAY = ymd(new Date());
const daysAgo = n => ymd(new Date(Date.now() - n * 864e5));

const store = {};
function makeL(w) {
  class Marker {
    constructor(ll, opt) { this._ll = ll.lat !== undefined ? ll : { lat: ll[0], lng: ll[1] }; this.opt = opt || {}; this._ev = {}; }
    addTo(m) { return this; } bindPopup() { return this; }
    setLatLng(ll) { this._ll = ll; return this; } getLatLng() { return this._ll; }
    on() { return this; } once() { return this; } off() {} fire() {}
  }
  class LMap {
    setView() { return this; } getZoom() { return 16; } getCenter() { return { lat: 23, lng: 120 }; }
    addLayer() {} removeLayer() {} closePopup() {} invalidateSize() {} on() {} off() {}
    getContainer() { return w.document.createElement('div'); }
  }
  return { map: () => new LMap(), tileLayer: () => ({ addTo: () => ({}) }), marker: (ll, o) => new Marker(ll, o),
    divIcon: o => o, latLng: (a, b) => ({ lat: a, lng: b }), control: { attribution: () => ({ addTo: () => ({}) }) },
    Control: { extend: def => function () { this.addTo = () => ({}); Object.assign(this, def); } },
    DomUtil: { create: t => w.document.createElement(t) }, DomEvent: { disableClickPropagation: () => {} } };
}
function boot(html, url) {
  const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: url || 'https://x.github.io/salesystem/', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      Object.defineProperty(w, 'localStorage', {
        value: {
          getItem: k => (k in store ? store[k] : null),
          setItem: (k, v) => { store[k] = String(v); },
          removeItem: k => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; }
        }, configurable: true
      });
      w.scrollTo = () => {};
      w.fetch = async () => { throw new Error('offline'); };
      w.L = makeL(w);
    }
  });
  return dom.window;
}

(async () => {
  console.log('F1 — 分類遷移與視角（街邊店/工廠同系統管理）');
  store['duskin_v2'] = JSON.stringify({
    clients: [
      { id: 'a', name: '巷口早餐店', addr: '永康區A路1號', type: '餐飲', status: '試用中', visits: [] },
      { id: 'b', name: '大昌鐵工', addr: '永康區B路2號', type: '工廠', status: '複訪', visits: [] }
    ],
    sheetUrl: 'https://script.google.com/macros/s/X/exec'
  });
  store['sitemap_v1'] = JSON.stringify({
    sites: [
      { id: 'sDue', name: '快開幕的咖啡店', town: '東區', addr: '東區C路3號', lat: 23.001, lng: 120.221, stage: '完工待開幕', type: '餐廳', openDate: daysAgo(1), by: '同事', created: 1, updated: 1, deleted: false },
      { id: 'sFar', name: '還在打地基', town: '東區', lat: 23.002, lng: 120.222, stage: '施工中', openDate: ymd(new Date(Date.now() + 20 * 864e5)), created: 1, updated: 1, deleted: false }
    ], cfg: { url: 'https://script.google.com/macros/s/S/exec', me: '我' }, queue: []
  });
  ['izcrm_v1', 'izcrm_master', 'duskin_iz_handoff', 'duskin_trip_pick', 'duskin_last_panel'].forEach(k => { store[k] = 'x'; });

  let m = boot(mainHtml);
  await wait(500);
  assert('開啟就是待辦分頁（沒有首頁）', m.document.getElementById('panel-todos').classList.contains('on') && !m.document.getElementById('panel-clients').classList.contains('on'));
  assert('migration v15：已移除功能留下的本機資料清掉', !['izcrm_v1', 'izcrm_master', 'duskin_iz_handoff', 'duskin_trip_pick', 'duskin_last_panel'].some(k => k in store));
  const mc = boot(mainHtml, 'https://x.github.io/salesystem/index.html#clients');
  await wait(300);
  assert('#clients 直接開客戶分頁', mc.document.getElementById('panel-clients').classList.contains('on') && !mc.document.getElementById('panel-todos').classList.contains('on'));
  mc.close();
  assert('migration v8：既有客戶補 segment（工廠型→工廠）', m.eval('DB.clients.find(c=>c.id==="b").segment') === '工廠' && m.eval('DB.clients.find(c=>c.id==="a").segment') === '街邊店');
  assert('列表有 全部/街邊店/工廠 視角切換', m.document.getElementById('seg-bar').textContent.includes('街邊店'));
  m.eval('setSegFilter("工廠")');
  assert('工廠視角只剩鐵工（含 🏭 徽章）', m.document.getElementById('panel-clients').textContent.includes('大昌鐵工') && !m.document.getElementById('panel-clients').textContent.includes('巷口早餐店'));
  m.eval('setSegFilter("all")');

  console.log('F1 — 類別選項可自訂');
  assert('預設清單含 餐飲/遊樂場', m.eval('typeOpts()').includes('餐飲') && m.eval('typeOpts()').includes('遊樂場'));
  m.eval('DB.typeOpts=["餐飲","民宿"];saveLocal()');
  m.eval('openCF(-1)');
  assert('表單類型下拉用自訂清單', m.document.getElementById('cf-type').textContent.includes('民宿') && !m.document.getElementById('cf-type').textContent.includes('遊樂場'));
  m.eval('closeForm()');
  m.eval('openCF(0)'); // 早餐店 type=餐飲 在清單內；改測舊值保留：
  m.eval('closeForm()');
  m.eval('DB.typeOpts=["民宿"];saveLocal();openCF(0)');
  assert('舊類型不在清單仍可顯示選取', m.document.getElementById('cf-type').value === '餐飲');
  m.eval('closeForm();DB.typeOpts=["Bob\'s 店","餐飲"];saveLocal();renderTypeOptsUI()');
  assert('類別 chips 用索引移除（含引號名稱不炸 onclick）', m.document.getElementById('typeopt-chips').innerHTML.includes('removeTypeOpt(0)'));
  m.eval('removeTypeOpt(0)');
  assert('索引移除正確', JSON.stringify(m.eval('DB.typeOpts')) === '["餐飲"]');
  m.eval('DB.typeOpts=null;saveLocal()');

  console.log('F1 — 主系統端「📇 轉為客戶」＋回執信箱');
  m.eval('mainConvertSite("sDue")');
  const nc = m.eval('DB.clients.find(c=>c.srcSiteId==="sDue")');
  assert('客戶卡建立：街邊店/待拜訪/拜訪日=開幕日/GPS manual', !!nc && nc.segment === '街邊店' && nc.status === '待拜訪' && nc.nextdate === daysAgo(1) && nc.geocodeSource === 'manual' && nc.lat === 23.001);
  assert('進待推送佇列', (store['duskin_outbox'] || '').includes(nc.id));
  assert('回執信箱寫入', JSON.parse(store['duskin_site_ack'] || '[]').some(a => a.siteId === 'sDue' && a.clientId === nc.id));
  m.eval('mainConvertSite("sDue")');
  assert('重複按不重複建檔', m.eval('DB.clients.filter(c=>c.srcSiteId==="sDue").length') === 1);

  console.log('F1 — 工地端消化回執');
  const s = boot(smHtml, 'https://x.github.io/salesystem/sitemap.html');
  await wait(400);
  assert('工地標記已建檔（s.main=clientId）', s.eval('DB.sites.find(x=>x.id==="sDue").main.clientId') === nc.id);
  assert('標記進推送佇列（同事經雲端看得到）', JSON.parse(store['sitemap_v1']).queue.includes('sDue'));
  assert('回執信箱已清空', !store['duskin_site_ack']);
  assert('popup 顯示已建檔', s.eval('popupHtml(DB.sites.find(x=>x.id==="sDue"))').includes('已建檔'));

  console.log(failed ? 'F1 FAILED ✗ (' + failed + ')' : 'F1 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('  ✗ exception:', e); process.exit(1); });
