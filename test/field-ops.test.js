// F2 — 外勤三件事：工地快拍（存 draft／待補提示條／補資料／調整位置）、定位追蹤（藍點、跟隨）、日報納入拒絕。
//   慣例：JSDOM 真實載入整個 HTML；只 stub fetch / geolocation / Leaflet 最小介面。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.join(__dirname, '..');
const smHtml = fs.readFileSync(path.join(root, 'sitemap.html'), 'utf8');
const mainHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'home.html'), 'utf8');

let failed = 0;
const assert = (name, cond, extra) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : ''))); if (!cond) failed++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

function makeL() {
  class Marker {
    constructor(latlng, opt) { this._ll = latlng.lat !== undefined ? latlng : { lat: latlng[0], lng: latlng[1] }; this.opt = opt || {}; this._ev = {}; }
    addTo(m) { if (m && m._markers) m._markers.push(this); return this; }
    bindPopup(h) { this._popup = h; return this; }
    setLatLng(ll) { this._ll = ll.lat !== undefined ? ll : { lat: ll[0], lng: ll[1] }; return this; }
    setRadius(r) { this._r = r; return this; }
    getLatLng() { return this._ll; }
    on(ev, fn) { this._ev[ev] = fn; return this; }
    off(ev) { delete this._ev[ev]; }
  }
  class LMap {
    constructor() { this._markers = []; this._h = {}; this.pans = 0; this.views = []; }
    setView(ll) { this.views.push(ll); return this; } panTo() { this.pans++; return this; }
    getZoom() { return 16; } getCenter() { return { lat: 23.02, lng: 120.25 }; }
    addLayer() {} removeLayer(l) { const i = this._markers.indexOf(l); if (i >= 0) this._markers.splice(i, 1); }
    closePopup() {} invalidateSize() {} on(ev, fn) { this._h[ev] = fn; } off(ev) { delete this._h[ev]; }
    fire(ev, e) { if (this._h[ev]) this._h[ev](e); }
  }
  return {
    map: () => new LMap(), tileLayer: () => ({ addTo: () => ({}) }),
    marker: (ll, opt) => new Marker(ll, opt), circle: (ll, opt) => new Marker(ll, opt),
    divIcon: o => o, latLng: (a, b) => (a && a.lat !== undefined ? a : { lat: a, lng: b }),
    control: { attribution: () => ({ addTo: () => ({}) }) },
    Control: { extend: def => function () { this.addTo = () => ({}); Object.assign(this, def); } },
    DomUtil: { create: t => ({ style: {}, innerHTML: '', onclick: null, title: '' }) },
    DomEvent: { disableClickPropagation: () => {} }
  };
}
// 可控的 geolocation：getCurrentPosition 立刻回 fix；watchPosition 記下 callback 讓測試推送新位置
function makeGeo(state) {
  return {
    getCurrentPosition: (ok) => setTimeout(() => ok({ coords: { latitude: state.lat, longitude: state.lng, accuracy: state.acc } }), 10),
    watchPosition: (ok) => { state.watchCb = ok; state.watches++; return 7; },
    clearWatch: () => { state.cleared++; state.watchCb = null; }
  };
}
function boot(html, store, geo, url) {
  const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: url || 'https://x.github.io/salesystem/', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      Object.defineProperty(w, 'localStorage', { value: {
        getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } }, configurable: true });
      w.scrollTo = () => {}; w.fetch = async () => { throw new Error('offline'); };
      w.L = makeL();
      if (geo) Object.defineProperty(w.navigator, 'geolocation', { value: geo, configurable: true });
    }
  });
  return dom.window;
}

(async () => {
  const store = {};
  const geo = { lat: 23.0245, lng: 120.2513, acc: 9, watches: 0, cleared: 0, watchCb: null };
  const w = boot(smHtml, store, makeGeo(geo));
  await wait(900);   // 啟動序 600ms 後定位一次 → startWatch
  const map = w.eval('map');

  console.log('F2 — 工地地圖：定位追蹤（藍點＋精度圈、跟隨模式）');
  assert('啟動定位後有藍點與精度圈', !!w.eval('meMarker') && !!w.eval('meCircle'));
  assert('啟動後開始 watchPosition', geo.watches === 1 && !!geo.watchCb);
  geo.watchCb({ coords: { latitude: 23.1, longitude: 120.3, accuracy: 20 } });
  const me = w.eval('meMarker').getLatLng();
  assert('新定位 → 藍點跟著移', Math.abs(me.lat - 23.1) < 1e-6 && Math.abs(me.lng - 120.3) < 1e-6);
  assert('精度圈半徑更新', w.eval('meCircle')._r === 20);
  assert('預設不跟隨（拖地圖看別處不被拉回）', map.pans === 0 && !w.eval('followMe'));
  w.toggleFollow();
  assert('◎ 一按 → 跟隨開、按鈕亮', w.eval('followMe') && w.document.getElementById('locate-btn').classList.contains('on'));
  geo.watchCb({ coords: { latitude: 23.11, longitude: 120.31, accuracy: 15 } });
  assert('跟隨中新定位 → 地圖 panTo', map.pans === 1);
  map.fire('dragstart');
  assert('手動拖地圖 → 自動取消跟隨', !w.eval('followMe') && !w.document.getElementById('locate-btn').classList.contains('on'));
  geo.watchCb({ coords: { latitude: 23.12, longitude: 120.32, accuracy: 15 } });
  assert('取消後不再拉地圖', map.pans === 1);
  assert('getFix 直接用追蹤中的最近定位（不用再等）', (() => { let got = null; w.getFix((ll) => { got = ll; }, 20000); return got && Math.abs(got.lat - 23.12) < 1e-6; })());

  console.log('F2 — 工地地圖：快拍存成待補資料');
  assert('地圖有「快拍」主鈕與「詳細登記」次鈕、隱藏相機 input', !!w.document.getElementById('snap-fab') && !!w.document.getElementById('fab') && /capture="environment"/.test(w.document.getElementById('snap-photo').outerHTML));
  const before = w.eval('DB.sites.length');
  const s = w.createSnapSite('data:image/jpeg;base64,/9j/x', { ll: { lat: 23.12, lng: 120.32 }, acc: 15 });
  assert('快拍立刻存一筆（不開表單）', w.eval('DB.sites.length') === before + 1 && !w.document.getElementById('form-modal').classList.contains('on'));
  assert('draft 旗標、施工中、不確定、30 天後可拜訪', s.draft === true && s.stage === '施工中' && s.type === '不確定' && /^\d{4}-\d{2}-\d{2}$/.test(s.openDate));
  assert('暫名「快拍 MM/DD HH:mm」', /^快拍 \d{2}\/\d{2} \d{2}:\d{2}$/.test(s.name), s.name);
  assert('座標＝定位、src=gps、照片存入', s.lat === 23.12 && s.lng === 120.32 && s.src === 'gps' && s.acc === 15 && /^data:image/.test(s.photo));
  assert('本機已持久化', JSON.parse(store.sitemap_v1).sites.some(x => x.id === s.id && x.draft));
  const bar = w.document.getElementById('draft-bar');
  assert('地圖上方提示「有 1 筆快拍還沒補資料」', bar.style.display === 'flex' && /<b>1<\/b>/.test(bar.innerHTML));
  w.setFilter('draft'); w.renderList();
  assert('「待補資料」篩選只剩快拍', w.eval('DB.sites.filter(visible).length') === 1 && /待補資料/.test(w.document.getElementById('list').innerHTML));
  assert('圖釘用虛線款＋「拍」字', /pin draft/.test(w.eval('pinIcon("施工中",false,true)').html) && /拍</.test(w.eval('pinIcon("施工中",false,true)').html));
  assert('popup 按鈕變「補資料」', /補資料/.test(w.popupHtml(s)));
  w.setFilter('all');
  const s2 = w.createSnapSite('data:image/jpeg;base64,/9j/y', null);
  assert('沒抓到定位 → 放地圖中心、src=map', s2.src === 'map' && Math.abs(s2.lat - 23.02) < 1e-6 && s2.acc === null);
  assert('提示條數字變 2', /<b>2<\/b>/.test(bar.innerHTML));

  console.log('F2 — 工地地圖：補資料與調整位置');
  w.nextDraft();
  assert('提示條 → 開最舊那筆的表單，標題「補快拍資料」', w.document.getElementById('form-modal').classList.contains('on') && w.document.getElementById('fm-title').textContent === '補快拍資料' && w.eval('editId') === s.id);
  assert('店名留空讓自動命名／使用者接手，副標顯示暫名', w.document.getElementById('fm-name').value === '' && w.document.getElementById('fm-sub').textContent.includes(s.name));
  assert('既有工地表單有「調整位置」', w.document.getElementById('fm-move').style.display !== 'none');
  w.movePosition();
  assert('調整位置 → 關表單、進放點模式、圖釘從原位開始', !w.document.getElementById('form-modal').classList.contains('on') && w.eval('placeMode') === 'map' && w.eval('placeForId') === s.id && Math.abs(w.eval('tempMarker').getLatLng().lat - 23.12) < 1e-6);
  w.eval('tempMarker').setLatLng({ lat: 23.1203, lng: 120.3204 });
  w.confirmPlace();
  assert('確認位置 → 回到同一筆的表單、座標更新', w.document.getElementById('form-modal').classList.contains('on') && w.eval('editId') === s.id && /23\.1203/.test(w.document.getElementById('fm-sub').textContent));
  w.document.getElementById('fm-name').value = '中山南路新店面';
  w.saveSite();
  const done = w.eval('DB.sites').find(x => x.id === s.id);
  assert('存檔後 draft 清掉、店名與新座標寫入、src=drag、照片保留', !done.draft && done.name === '中山南路新店面' && done.lat === 23.1203 && done.src === 'drag' && /^data:image/.test(done.photo));
  assert('提示條剩 1 筆', /<b>1<\/b>/.test(bar.innerHTML));
  w.cancelPlace();
  assert('放點取消也清 placeForId、FAB 列回來', w.eval('placeForId') === null && w.document.getElementById('fabs').style.display === 'flex');

  console.log('F2 — 首頁工地卡顯示快拍待補');
  const wh = boot(homeHtml, store, null, 'https://x.github.io/salesystem/home.html');
  await wait(300);
  assert('首頁工地卡：快拍待補 1', /快拍待補 1/.test(wh.document.getElementById('a-site').textContent), wh.document.getElementById('a-site').textContent);

  console.log('F2 — 主系統客戶地圖：定位追蹤只在地圖開著時跑');
  const geo2 = { lat: 23.0, lng: 120.2, acc: 8, watches: 0, cleared: 0, watchCb: null };
  const wm = boot(mainHtml, { migration_v: '9' }, makeGeo(geo2));
  await wait(400);
  wm.navTo('clients', wm.document.getElementById('nav-clients'));
  wm.setClientView('map');
  await wait(120);
  assert('開地圖 → watchPosition', geo2.watches === 1 && !!geo2.watchCb);
  geo2.watchCb({ coords: { latitude: 23.05, longitude: 120.22, accuracy: 12 } });
  const ME = wm.eval('ME');
  assert('定位 → 藍點＋精度圈', !!ME.marker && !!ME.circle && Math.abs(ME.marker.getLatLng().lat - 23.05) < 1e-6 && (ME.circle._r === 12 || ME.circle.opt.radius === 12));
  wm.setClientView('list');
  assert('切回清單 → clearWatch', geo2.cleared === 1 && wm.eval('ME.watchId') === null);

  console.log('F2 — 日報納入被拒絕的店家');
  const seed = { clients: [
    { id: 'r1', name: '拒絕的早餐店', addr: '臺南市永康區中正路1號', status: '拒絕', trialItems: [], todos: [], updatedAt: 1,
      visits: [{ date: '2026-09-02', mood: 1, note: '老闆說不需要', insight: '', statusChange: '拒絕', nextdate: null }] },
    { id: 't1', name: '試用的餐廳', addr: '臺南市永康區中正路2號', status: '試用中', trialItems: [{ product: 'DECSR', qty: 1, cycle: '2W', quoted: 0 }], todos: [], updatedAt: 1,
      visits: [{ date: '2026-09-03', mood: 3, note: '同意試用', insight: '', statusChange: '試用中', nextdate: '2026-09-17' }] }
  ], inventory: [], products: [], gtodos: [] };
  const wr = boot(mainHtml, { duskin_v2: JSON.stringify(seed), migration_v: '9' }, null);
  await wait(400);
  wr.document.getElementById('rpt-from').value = '2026-09-01';
  wr.document.getElementById('rpt-to').value = '2026-09-07';
  wr.document.getElementById('rpt-start-month').value = '9';
  wr.genReport();
  const rows = wr.document.getElementById('rpt-daily').value.split('\n').map(r => r.split('\t'));
  const refused = rows.find(r => r[1] === '拒絕的早餐店');
  assert('本週日報有被拒絕店家那一列', !!refused, wr.document.getElementById('rpt-daily').value);
  assert('動作代號「拒」、備註帶入、預估 4W 空', refused && refused[4] === '拒' && /老闆說不需要/.test(refused[5]) && refused[6] === '');
  assert('試用的照舊：動作「試」、有預估 4W', rows.some(r => r[1] === '試用的餐廳' && r[4] === '試' && r[6] === '340'));
  assert('推進表仍不列拒絕的店', !/拒絕的早餐店/.test(wr.document.getElementById('rpt-4w').value));
  assert('未來兩週規劃仍不列拒絕的店', !/拒絕的早餐店/.test(wr.document.getElementById('rpt-plan').value));

  console.log(failed ? 'F2 FAILED ❌ (' + failed + ')' : 'F2 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
