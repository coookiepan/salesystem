// M2 前端：客戶清單分頁渲染 + 增量同步合併
//   分頁：200 筆只先畫 INITIAL_CLIENT_N，按「載入更多」再加一頁。
//   增量：本機乾淨(每筆有 id)+ 有 lastPullAt 時帶 since 拉取，回來的變動列 upsert、
//         雲端已刪除(不在 ids)的本機列移除、未變動的保留。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function boot(seed) {
  const store = Object.assign({}, seed || {});
  const ls = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; }
  };
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://x.github.io/salesystem/', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    beforeParse(w) {
      Object.defineProperty(w, 'localStorage', { value: ls, configurable: true });
      w.scrollTo = () => {}; w.fetch = async () => { throw new Error('default-down'); };
    }
  });
  return dom.window;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const resp = obj => ({ json: async () => obj, text: async () => JSON.stringify(obj) });
let failed = 0;
function assert(name, cond, extra) { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : ''))); if (!cond) failed++; }

(async () => {
  console.log('M2 — 客戶清單分頁渲染');
  let w = boot(); await wait(400);
  w.eval('activeCat="全部";activeStatusSub="";DB.clients=Array.from({length:200},(_,i)=>({id:"id"+i,name:"N"+i,status:"",updatedAt:1}));');
  const INITIAL = w.eval('INITIAL_CLIENT_N');
  w.renderClients();
  let cards = w.document.querySelectorAll('#clients-list .cc').length;
  const listHtml = w.document.getElementById('clients-list').innerHTML;
  assert('初次只渲染 INITIAL_CLIENT_N 筆', cards === INITIAL, '實際 ' + cards + ' / 期望 ' + INITIAL);
  assert('顯示「載入更多」並標示 N/200', /載入更多/.test(listHtml) && new RegExp(INITIAL + '\\s*/\\s*200').test(listHtml));
  w.loadMoreClients();
  cards = w.document.querySelectorAll('#clients-list .cc').length;
  assert('載入更多後增加一頁', cards === INITIAL * 2, '實際 ' + cards);

  console.log('M2 — 增量同步合併（upsert + 刪除偵測 + 保留未變動）');
  w = boot({ duskin_v2: JSON.stringify({
    clients: [{ id: 'a', name: 'A', updatedAt: 100 }, { id: 'b', name: 'B', updatedAt: 100 }, { id: 'c', name: 'C', updatedAt: 100 }],
    sheetUrl: 'https://script.google.com/x/exec', lastPullAt: 500, products: [], inventory: null
  }) });
  await wait(400);
  const captured = [];
  w.fetch = async (u, o) => {
    const b = JSON.parse(o.body); captured.push(b);
    if (b.action === 'getAll') return resp({ incremental: true, clients: [{ id: 'b', name: 'B2', updatedAt: 600 }], ids: ['a', 'b'], skipped: [] });
    if (b.action === 'getInventory') return resp({ inventory: null });
    if (b.action === 'getProducts') return resp({ products: null });
    return resp({ ok: true });
  };
  w.confirm = () => true;
  const ok = await w.syncFromSheet(true);
  const names = JSON.parse(w.eval('JSON.stringify(DB.clients.map(c=>c.name).sort())'));
  const getAllReq = captured.find(b => b.action === 'getAll');
  assert('拉取成功', ok === true);
  assert('帶上 since=lastPullAt(500) 走增量', getAllReq && getAllReq.since === 500);
  assert('結果為 A + B2（c 已刪、b 更新、a 保留）', names.join(',') === 'A,B2', names.join(','));

  // 本機資料不乾淨（有缺 id）→ 應退回整碗拉取（since=0）
  // 註：App 載入時會自動補 id，故這裡載入後再手動塞一筆缺 id 的列來觸發 clean 防呆。
  console.log('M2 — 髒資料退回整碗拉取');
  w = boot({ duskin_v2: JSON.stringify({
    clients: [{ id: 'a', name: 'A' }],
    sheetUrl: 'https://script.google.com/x/exec', lastPullAt: 500, products: [], inventory: null
  }) });
  await wait(400);
  w.eval('DB.clients.push({name:"NoId"}); SYNC.lastPullAt=500;'); // 製造缺 id 髒資料
  const cap2 = [];
  w.fetch = async (u, o) => {
    const b = JSON.parse(o.body); cap2.push(b);
    if (b.action === 'getAll') return resp({ clients: [{ id: 'z', name: 'Z' }], skipped: [] }); // 非 incremental
    if (b.action === 'getInventory') return resp({ inventory: null });
    if (b.action === 'getProducts') return resp({ products: null });
    return resp({ ok: true });
  };
  w.confirm = () => true;
  await w.syncFromSheet(true);
  const req2 = cap2.find(b => b.action === 'getAll');
  const names2 = JSON.parse(w.eval('JSON.stringify(DB.clients.map(c=>c.name))'));
  assert('髒資料時 since=0（整碗）', req2 && req2.since === 0);
  assert('整碗拉取直接覆蓋為雲端內容', names2.join(',') === 'Z');

  console.log(failed ? `M2(前端) FAILED (${failed})` : 'M2(前端) PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('THROWN', e); process.exit(1); });
