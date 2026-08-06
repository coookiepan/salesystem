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

  console.log(failed ? 'P1 FAILED ✗ (' + failed + ')' : 'P1 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('  ✗ exception:', e); process.exit(1); });
