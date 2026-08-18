// P1 主系統「工地地圖模式」：地圖 FAB → GPS 抓點 → 拖圖釘 → 建檔表單 → 存檔帶 manual 座標。
//    含取消路徑與暫存座標不外洩（closeForm 丟棄）。JSDOM + 最小 Leaflet/geolocation stub。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let failed = 0;
const assert = (n, c) => { console.log((c ? '  ✓ ' : '  ✗ ') + n); if (!c) failed++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

const store = {};
function makeL(w) {
  class Marker {
    constructor(ll, opt) { this._ll = ll.lat !== undefined ? ll : { lat: ll[0], lng: ll[1] }; this.opt = opt || {}; this._ev = {}; }
    addTo(m) { m._layers.push(this); return this; }
    bindPopup() { return this; }
    setLatLng(ll) { this._ll = ll.lat !== undefined ? ll : { lat: ll[0], lng: ll[1] }; return this; }
    getLatLng() { return this._ll; }
    on(ev, fn) { this._ev[ev] = fn; return this; }
    once(ev, fn) { this._ev[ev] = fn; return this; }
    off(ev) { delete this._ev[ev]; }
    fire(ev) { if (this._ev[ev]) this._ev[ev](); }
  }
  class LMap {
    constructor() { this._layers = []; this._h = {}; this._zoom = 11; }
    setView() { return this; } setZoom(z) { this._zoom = z; } getZoom() { return this._zoom; }
    getCenter() { return { lat: 23.0, lng: 120.2 }; }
    removeLayer(l) { const i = this._layers.indexOf(l); if (i >= 0) this._layers.splice(i, 1); }
    addLayer() {} closePopup() {} fitBounds() {} flyTo() {} invalidateSize() {}
    on(ev, fn) { this._h[ev] = fn; } off(ev) { delete this._h[ev]; }
    fire(ev, e) { if (this._h[ev]) this._h[ev](e); }
    getContainer() { return w.document.createElement('div'); }
  }
  return {
    map: () => new LMap(),
    tileLayer: () => ({ addTo: () => ({}) }),
    marker: (ll, opt) => new Marker(ll, opt),
    divIcon: o => o,
    latLng: (a, b) => ({ lat: a, lng: b }),
    Control: { extend: def => function () { this.addTo = () => ({}); Object.assign(this, def); } },
    DomUtil: { create: t => w.document.createElement(t) },
    DomEvent: { disableClickPropagation: () => {} }
  };
}

const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://x.github.io/salesystem/', pretendToBeVisual: true, virtualConsole: vc,
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
    Object.defineProperty(w.navigator, 'geolocation', {
      value: { getCurrentPosition: ok => setTimeout(() => ok({ coords: { latitude: 23.0245, longitude: 120.2513, accuracy: 9 } }), 20) },
      configurable: true
    });
  }
});
const w = dom.window;

(async () => {
  console.log('P1 — 地圖上直接建檔（GPS → 拖圖釘 → 表單）');
  await wait(400);
  w.eval('appConfirm=async()=>true'); // 輸入檢查提示一律「仍要儲存」
  w.document.getElementById('sheet-url').value = 'https://script.google.com/macros/s/X/exec'; w.saveSheetUrl();

  assert('地圖畫布上有「＋ 在這裡建檔」FAB 與確認列', !!w.document.getElementById('map-fab') && !!w.document.getElementById('map-place-bar'));

  w.setClientView('map'); await wait(150);
  w.startClientPlace(); await wait(120); // 等 GPS stub 回來
  assert('GPS 抓到 → 出現紅色暫存圖釘', !!w.eval('PLACE_STATE.temp'));
  assert('確認列顯示、含精度資訊；FAB 隱藏', w.document.getElementById('map-place-bar').style.display === 'block' && w.document.getElementById('map-place-msg').textContent.includes('9 公尺') && w.document.getElementById('map-fab').style.display === 'none');

  // 拖圖釘微調再確認
  w.eval('PLACE_STATE.temp.setLatLng({lat:23.02501,lng:120.25203});PLACE_STATE.temp.fire("dragend")');
  w.confirmClientPlace(); await wait(80);
  assert('確認後開新增客戶表單、座標暫存', w.document.getElementById('form-title').textContent.includes('新增') && w.eval('PLACE_COORDS && PLACE_COORDS.lat===23.02501'));
  assert('暫存圖釘與確認列已收走、FAB 回來', !w.eval('PLACE_STATE.temp') && w.document.getElementById('map-place-bar').style.display === 'none');

  w.document.getElementById('cf-name').value = '路邊新發現的店';
  await w.saveClient(); await wait(150);
  const c = w.eval('DB.clients.find(x=>x.name==="路邊新發現的店")');
  assert('存檔成功：GPS 座標、來源 manual（不排 geocode）', !!c && c.lat === 23.02501 && c.lng === 120.25203 && c.geocodeSource === 'manual');
  assert('進待推送佇列（離線不丟）', (store['duskin_outbox'] || '').includes(c.id));
  assert('存完回到地圖視圖看新圖釘', w.document.getElementById('view-map').style.display === 'block');
  assert('暫存座標已消費清空', w.eval('PLACE_COORDS') === null);

  console.log('P1 — 取消與不外洩');
  w.startClientPlace(); await wait(120);
  w.cancelClientPlace();
  assert('取消：圖釘移除、FAB 回復', !w.eval('PLACE_STATE.temp') && w.document.getElementById('map-fab').style.display === 'flex');
  // 開了表單但沒存 → 座標必須丟棄，不能沾染下一筆
  w.startClientPlace(); await wait(120); w.confirmClientPlace(); await wait(50);
  w.closeForm();
  assert('未存檔關閉表單 → 暫存座標丟棄', w.eval('PLACE_COORDS') === null);
  w.openCF(-1); w.document.getElementById('cf-name').value = '一般表單新增';
  await w.saveClient(); await wait(100);
  const c2 = w.eval('DB.clients.find(x=>x.name==="一般表單新增")');
  assert('一般新增不帶座標（走地址 geocode 流程）', !!c2 && c2.lat == null && c2.geocodeSource == null);

  console.log('P1 — 地圖圖層（開發客戶／既有客戶／工地 複選）');
  w.setClientView('map'); await wait(100);
  w.eval(`SHOPS=[{name:'老店A',phone:'06-1112222',addr:'臺南市東區裕農路100號',owner:'陳老闆',revenue:'12000'}]`);
  w.eval('SHOPS_GEO[shopGeoKey(SHOPS[0])]={lat:22.98,lng:120.22,at:1}');   // 已有定位快取 → 不需上網
  store['sitemap_v1'] = JSON.stringify({ sites: [
    { id: 'sA', name: '新工地', town: '東區', addr: '東區X路1號', stage: '施工中', openDate: '2026-09-01', lat: 22.99, lng: 120.21, deleted: false },
    { id: 'sDel', name: '已刪工地', lat: 22.99, lng: 120.21, deleted: true },
    { id: 'sConv', name: '已轉工地', lat: 22.99, lng: 120.21, deleted: false, main: { clientId: 'x1' } }
  ], cfg: {}, queue: [] });
  w.eval('FUSION_CACHE.sm=null');
  const base = w.eval('MAP_STATE.markers.length');
  w.toggleMapLayer('shops', w.document.getElementById('map-layer-shops')); await wait(50);
  assert('開既有客戶圖層 → 名單店家上圖', w.eval('MAP_STATE.markers.length') === base + 1);
  w.toggleMapLayer('sites', w.document.getElementById('map-layer-sites')); await wait(50);
  assert('開工地圖層 → 只畫未刪除且未轉檔的工地', w.eval('MAP_STATE.markers.length') === base + 2);
  assert('點數統計＝三層合計', w.document.getElementById('map-count').textContent === String(base + 2));
  assert('圖層選擇有記住', JSON.parse(store['duskin_map_layers']).shops === true && JSON.parse(store['duskin_map_layers']).sites === true);
  w.toggleMapLayer('dev', w.document.getElementById('map-layer-dev')); await wait(50);
  assert('關開發客戶層 → 只剩既有客戶＋工地', w.eval('MAP_STATE.markers.length') === 2);

  console.log('P1 — 工地點一鍵轉為客戶＋名單新地址批次定位');
  w.mainConvertSite('sA'); await wait(50);
  assert('工地轉成正規客戶（座標沿用 manual）', w.eval('DB.clients.some(c=>c.srcSiteId==="sA"&&c.geocodeSource==="manual")'));
  assert('轉檔後工地點從圖上消失', w.eval('MAP_STATE.markers.length') === 1);
  // 名單多了一家沒定位過的、後端太舊（fetch 回非批次格式）→ 退回單筆 Nominatim 補定位並快取
  w.fetch = async () => ({ ok: true, json: async () => [{ lat: '22.97', lon: '120.20' }] });
  w.eval(`SHOPS.push({name:'新開的店',phone:'',addr:'臺南市南區新興路5號',owner:'',revenue:''})`);
  await w.ensureShopsGeo(); await wait(50);
  assert('後端太舊 → 退回單筆定位並寫入快取', JSON.parse(store['duskin_shops_geo'] || '{}')[w.eval('shopGeoKey(SHOPS[1])')].lat === 22.97);
  assert('新店家出現在圖上', w.eval('MAP_STATE.markers.length') === 2);

  console.log('P1 — 批次定位（後端 BACKEND_VER≥3，一趟往返查一批）');
  w.fetch = async (u, o) => {
    const b = o && o.body ? JSON.parse(o.body) : {};
    if (b.action === 'geocodeBatch') return { ok: true, json: async () => ({ ok: true, results: b.addrs.map(() => ({ ok: true, status: 'OK', lat: 22.96, lng: 120.19 })) }) };
    throw new Error('unexpected ' + b.action);
  };
  w.eval(`SHOPS.push({name:'批次店1',addr:'臺南市北區公園路10號'},{name:'批次店2',addr:'臺南市中西區民族路20號'})`);
  await w.ensureShopsGeo(); await wait(30);
  const geo = JSON.parse(store['duskin_shops_geo']);
  assert('兩家一趟批次定位完成並快取', geo[w.eval('shopGeoKey(SHOPS[2])')].lat === 22.96 && geo[w.eval('shopGeoKey(SHOPS[3])')].lat === 22.96);
  assert('圖上跟著多兩點', w.eval('MAP_STATE.markers.length') === 4);
  assert('已定位過的不再重查（need 過濾）', (await w.ensureShopsGeo(), w.eval('MAP_STATE.markers.length')) === 4);

  console.log(failed ? 'P1 FAILED ✗ (' + failed + ')' : 'P1 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('  ✗ exception:', e); process.exit(1); });
