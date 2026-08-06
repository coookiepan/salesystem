// S1 工地地圖（sitemap.html）：語法、登記/篩選、離線佇列、LWW 合併、tombstone、
//    60m 重複提醒、XSS 轉義、📇 建檔交接信箱 → 主系統 consumeSiteHandoff 端對端。
// 慣例：JSDOM 真實載入整個 HTML；只 stub fetch / geolocation / appConfirm。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.join(__dirname, '..');
const smHtml = fs.readFileSync(path.join(root, 'sitemap.html'), 'utf8');
const mainHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
const assert = (name, cond) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) failed++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

// 兩個 JSDOM 共用同一個 localStorage（模擬同網域的兩個分頁）
const store = {};
function makeLS() {
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; }
  };
}
// 最小 Leaflet stub：sitemap 改走 CDN 後，JSDOM 不載外部 script，需在頁面腳本前備妥 L
function makeL(w) {
  class Marker {
    constructor(latlng, opt) { this._ll = latlng.lat !== undefined ? latlng : { lat: latlng[0], lng: latlng[1] }; this.opt = opt || {}; this._ev = {}; }
    addTo(m) { if (m && m._markers) m._markers.push(this); return this; }
    bindPopup(h) { this._popup = h; return this; }
    setLatLng(ll) { this._ll = ll.lat !== undefined ? ll : { lat: ll[0], lng: ll[1] }; return this; }
    getLatLng() { return this._ll; }
    on(ev, fn) { this._ev[ev] = fn; return this; }
    off(ev) { delete this._ev[ev]; }
  }
  class LMap {
    constructor() { this._markers = []; this._h = {}; }
    setView() { return this; } getZoom() { return 16; } getCenter() { return { lat: 23.02, lng: 120.25 }; }
    addLayer() {} removeLayer(l) { const i = this._markers.indexOf(l); if (i >= 0) this._markers.splice(i, 1); }
    closePopup() {} invalidateSize() {} on(ev, fn) { this._h[ev] = fn; } off(ev) { delete this._h[ev]; }
  }
  return {
    map: () => new LMap(),
    tileLayer: () => ({ addTo: () => ({}) }),
    marker: (ll, opt) => new Marker(ll, opt),
    divIcon: o => o,
    latLng: (a, b) => (a && a.lat !== undefined ? a : { lat: a, lng: b }),
    control: { attribution: () => ({ addTo: () => ({}) }) }
  };
}
function boot(html) {
  const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://x.github.io/salesystem/', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      Object.defineProperty(w, 'localStorage', { value: makeLS(), configurable: true });
      w.scrollTo = () => {};
      w.fetch = async () => { throw new Error('offline'); };
      w.L = makeL(w);
    }
  });
  return dom.window;
}

(async () => {
  console.log('S1 — sitemap.html 語法檢查');
  {
    const scripts = [...smHtml.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
    assert('app inline script 存在、Leaflet 改走 CDN＋SRI（與主系統同源）', scripts.length === 1 && smHtml.includes('unpkg.com/leaflet@1.9.4') && smHtml.includes('integrity='));
    let ok = true, err = '';
    for (const s of scripts) { try { new vm.Script(s); } catch (e) { ok = false; err = e.message; } }
    assert('所有 inline script 可解析' + (err ? '（' + err + '）' : ''), ok);
    assert('GAS_CODE 可解析（後端語法）', (() => {
      const m = smHtml.match(/const GAS_CODE=\[([\s\S]*?)\]\.join/);
      try { new vm.Script(JSON.parse('[' + m[1].replace(/,\s*$/, '') + ']').join('\n')); return true; } catch (e) { return false; }
    })());
    assert('原生 alert/confirm 已移除（app script 內）', !/[^.\w](alert|confirm)\(/.test(scripts[scripts.length - 1]));
    const tokensCss = fs.readFileSync(path.join(root, 'tokens.css'), 'utf8');
    assert('引用共用 tokens.css，深色覆寫由該檔提供', smHtml.includes('href="tokens.css"') && /prefers-color-scheme:dark/.test(tokensCss));
    assert('清單搜尋框 ≥16px（iOS 不自動放大頁面）', !/id="q"[^>]*font-size:1[0-5]px/.test(smHtml) && !/id="listsort"[^>]*font-size:1[0-5]px/.test(smHtml));
  }

  console.log('S1 — 登記與清單（JSDOM 真實載入）');
  const w = boot(smHtml);
  await wait(900); // 啟動序含 600ms 後的定位（geolocation 不存在 → toast 分支）

  assert('APP_VER 使用 repo 版本格式', /^v20\d\d\.\d\d\.\d\d-s\d+$/.test(w.eval('APP_VER')));
  if (!w.eval('typeof map!=="undefined"&&!!map')) {
    // Leaflet 在 JSDOM 起不來時退回 stub（不影響資料層驗證）
    w.eval('map={addLayer:function(){},removeLayer:function(){},closePopup:function(){},setView:function(){},getCenter:function(){return {lat:23,lng:120}},getZoom:function(){return 16},invalidateSize:function(){},on:function(){}}');
  }

  // 登記一筆（名字帶 HTML，順便驗 XSS）
  w.eval("openForm(null, L.latLng(23.020000, 120.250000))");
  await wait(50);
  w.document.getElementById('fm-name').value = '測試工地<img src=x onerror=alert(1)>';
  w.document.getElementById('fm-addr').value = '中山南路640號';
  w.document.getElementById('fm-town').value = '永康區';
  w.document.getElementById('fm-open').value = '2026-08-30';
  w.eval('saveSite()');
  assert('登記成功寫入 DB.sites', w.eval('DB.sites.length') === 1);
  const s1id = w.eval('DB.sites[0].id');
  assert('落地 localStorage.sitemap_v1', (store['sitemap_v1'] || '').includes(s1id));
  assert('預設階段=施工中、登記人取自 CFG.me（空）', w.eval("DB.sites[0].stage") === '施工中');
  const pop = w.eval('popupHtml(DB.sites[0])');
  assert('popup 轉義 HTML 名字（XSS 守門）', pop.includes('&lt;img') && !pop.includes('<img src=x'));
  assert('popup 有「📇 建檔到主系統」按鈕', pop.includes('建檔到主系統'));

  // 60 公尺內重複提醒
  w.eval('openForm(null, L.latLng(23.020200, 120.250100))'); // 約 25m
  await wait(50);
  assert('60m 內重複登記出現提醒＋改成編輯', w.document.getElementById('fm-warn').innerHTML.includes('已經有') && w.document.getElementById('fm-warn').innerHTML.includes('改成編輯'));
  w.eval('closeForm()');

  console.log('S1 — 離線佇列與補推');
  w.eval("CFG.url='https://script.google.com/macros/s/S/exec'");
  await w.eval('push(DB.sites[0])');
  assert('斷網 push → 進佇列', w.eval('SYNC.queue.length') === 1 && w.eval('SYNC.queue[0]') === s1id);
  const sent = [];
  w.fetch = async (u, o) => { const b = JSON.parse(o.body); sent.push(b.action); return { json: async () => (b.action === 'getAll' ? { sites: [] } : { ok: true, count: 1 }) }; };
  await w.eval('flushQueue()');
  assert('恢復連線 flushQueue → 佇列清空（走 bulk）', w.eval('SYNC.queue.length') === 0 && sent.includes('bulk'));

  console.log('S1 — 雲端 LWW 合併與 tombstone');
  const newer = Date.now() + 5000;
  w.fetch = async (u, o) => ({ json: async () => ({ sites: [
    { id: s1id, name: '同事改過的名字', addr: '中山南路640號', town: '永康區', lat: 23.02, lng: 120.25, stage: '裝潢收尾', type: '餐廳', openDate: '2026-08-30', by: '同事', created: 1, updated: newer, deleted: false },
    { id: 'sRemoteB', name: '同事登記的點', town: '東區', lat: 23.00, lng: 120.22, stage: '施工中', type: '不確定', openDate: '', by: '同事', created: 2, updated: newer, deleted: false }
  ] }) });
  await w.eval('pullAll(true)');
  assert('updated 較新的雲端版本蓋過本地', w.eval('DB.sites.find(s=>s.id==="' + s1id + '").name') === '同事改過的名字');
  assert('同事的新點拉下來了', !!w.eval('DB.sites.find(s=>s.id==="sRemoteB")'));

  console.log('S1 — 📇 建檔到主系統（交接信箱）');
  w.eval('toClient("' + s1id + '")');
  let inbox = JSON.parse(store['duskin_site_handoff'] || '[]');
  assert('信箱有一筆、帶預產 client id', inbox.length === 1 && !!inbox[0].id);
  assert('欄位對應：名稱/地址含區/可拜訪日/座標', inbox[0].name === '同事改過的名字' && inbox[0].addr.startsWith('永康區') && inbox[0].nextdate === '2026-08-30' && inbox[0].lat === 23.02);
  assert('工地標記 s.main（隨雲端同步）', w.eval('DB.sites.find(s=>s.id==="' + s1id + '").main.clientId') === inbox[0].id);
  w.eval('toClient("' + s1id + '")');
  inbox = JSON.parse(store['duskin_site_handoff'] || '[]');
  assert('重複按不會重複寫信箱', inbox.length === 1);
  assert('popup 改顯示「已建檔」', w.eval('popupHtml(DB.sites.find(s=>s.id==="' + s1id + '"))').includes('已建檔'));
  const handoffClientId = inbox[0].id;

  console.log('S1 — 刪除（tombstone，appConfirm 慣例 stub）');
  w.eval('appConfirm=async()=>true');
  w.eval('editId="sRemoteB"');
  await w.eval('delSite()');
  assert('刪除＝tombstone 而非移除', w.eval('DB.sites.find(s=>s.id==="sRemoteB").deleted') === true);
  assert('tombstone 不再顯示於篩選', w.eval('DB.sites.filter(visible).some(s=>s.id==="sRemoteB")') === false);

  console.log('S2 — 主系統消化交接信箱（端對端：用上面真實寫入的信箱）');
  store['duskin_v2'] = JSON.stringify({ clients: [], sheetUrl: 'https://script.google.com/macros/s/X/exec' }); // 設好雲端才會進 outbox
  const m = boot(mainHtml);
  await wait(500);
  const got = m.eval('DB.clients.find(c=>c.id==="' + handoffClientId + '")');
  assert('主系統建檔成功（INIT 消化）', !!got);
  assert('狀態=未拜訪、nextdate=可拜訪日', got && got.status === '未拜訪' && got.nextdate === '2026-08-30');
  assert('GPS 座標沿用且標 manual（不會被 geocode 蓋掉）', got && got.lat === 23.02 && got.lng === 120.25 && got.geocodeSource === 'manual');
  assert('名稱與備註帶入（含工地地圖轉入標記）', got && got.name === '同事改過的名字' && /工地地圖轉入/.test(got.note));
  assert('信箱消化後清空', !store['duskin_site_handoff']);
  assert('建檔進待推送佇列（斷網不丟）', (store['duskin_outbox'] || '').includes(handoffClientId));

  // 冪等：重放同一封信 + 回前景事件
  store['duskin_site_handoff'] = JSON.stringify([{ id: handoffClientId, name: 'X重複', addr: 'Y', nextdate: '', lat: 1, lng: 2 }]);
  m.dispatchEvent(new m.Event('focus'));
  await wait(200);
  assert('冪等：同 id 重放不重複建檔、不覆蓋', m.eval('DB.clients.filter(c=>c.id==="' + handoffClientId + '").length') === 1 && m.eval('DB.clients.find(c=>c.id==="' + handoffClientId + '").name') === '同事改過的名字');
  assert('重放後信箱仍被清空', !store['duskin_site_handoff']);

  console.log(failed ? 'S1/S2 FAILED ✗ (' + failed + ')' : 'S1/S2 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('  ✗ exception:', e); process.exit(1); });
