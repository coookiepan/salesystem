// Z1 — 工業區CRM（izcrm.html，獨立模組）
//   主檔載入與名單渲染（XSS 防護）、聚落規則 zoneOf、報價 fw4 算法、
//   LWW 同步合併（較新者為準）、CSV 跳脫、seed 匯入冪等。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'izcrm.html'), 'utf8');

const MASTER = { v: 1, source: 'test', count: 3, factories: [
  { id: 'aaa1', no: 1, name: '甲工廠<script>alert(1)</script>', dist: '永康區', li: '鹽行里', road: '中正南路', park: '', ind: '金屬製品製造業', phone: '06-1234567', addr: '臺南市永康區鹽行里中正南路1號' },
  { id: 'bbb2', no: 2, name: '乙工廠', dist: '永康區', li: '王行里', road: '永科五路', park: '永康科技工業區', ind: '塑膠製品製造業', phone: '', addr: '臺南市永康區王行里永科五路10號' },
  { id: 'ccc3', no: 3, name: '丙工廠', dist: '仁德區', li: '太子里', road: '太子四街', park: '', ind: '其他化學製品製造業', phone: '', addr: '臺南市仁德區太子里太子四街71號' }
] };

function boot(seed, fetchImpl) {
  const store = Object.assign({}, seed || {});
  const ls = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; }
  };
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://x.github.io/salesystem/izcrm.html',
    pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    beforeParse(w) {
      Object.defineProperty(w, 'localStorage', { value: ls, configurable: true });
      w.scrollTo = () => {};
      w.fetch = fetchImpl || (async u => {
        if (String(u).includes('izdata.json')) return { ok: true, json: async () => MASTER };
        throw new Error('default-down');
      });
      if (w.navigator && !w.navigator.serviceWorker) {
        Object.defineProperty(w.navigator, 'serviceWorker', { value: { register: () => Promise.resolve() }, configurable: true });
      }
    }
  });
  dom.window._store = store;
  return dom.window;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
function assert(name, cond, extra) { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : ''))); if (!cond) failed++; }

(async () => {
  console.log('Z1 — 主檔載入與名單渲染');
  let w = boot(); await wait(300);
  assert('主檔載入 3 家', w.eval('IZ.length') === 3);
  w.navTo('list');
  const out = w.document.getElementById('list-out').innerHTML;
  assert('名單渲染出工廠', /甲工廠/.test(out));
  assert('XSS：名稱中的 <script> 被跳脫', !out.includes('<script>alert') && out.includes('&lt;script&gt;'));

  console.log('Z1 — 聚落規則 zoneOf');
  assert('官方園區優先', w.eval('zoneOf(FID.bbb2)') === '永康科技工業區');
  assert('種子規則：鹽行里 → 鹽行聚落', /鹽行/.test(w.eval('zoneOf(FID.aaa1)')));
  assert('未涵蓋 → 散戶', w.eval('zoneLabel(FID.ccc3)') === '散戶');
  w.eval('metaSet("clusters",[{name:"太乙聚落",dist:"仁德區",lis:["太子里"]}])');
  assert('自訂規則生效', w.eval('zoneOf(FID.ccc3)') === '太乙聚落');
  assert('使用者規則蓋過種子（updatedAt 較新）', w.eval('S.meta.clusters.updatedAt') > 1);

  console.log('Z1 — 報價 fw4 算法（契約單價×次數×數量）');
  assert('每2週×2件：100×2×2=400', w.eval('fw4(100,2,2)') === 400);
  assert('每1週×1件：100×4×1=400', w.eval('fw4(100,1,1)') === 400);
  assert('每4週×3件：100×1×3=300', w.eval('fw4(100,3,4)') === 300);

  console.log('Z1 — CSV 跳脫');
  assert('逗號包引號', w.eval('csvCell("a,b")') === '"a,b"');
  assert('引號翻倍', w.eval('csvCell(\'say "hi"\')') === '"say ""hi"""');
  assert('一般值原樣', w.eval('csvCell("abc")') === 'abc');

  console.log('Z1 — 同步：LWW 合併');
  const calls = [];
  w = boot({ izcrm_v1: JSON.stringify({
    records: {
      aaa1: { status: '拜訪中', updatedAt: 100 },
      bbb2: { status: '考慮中', note: '本機較新', updatedAt: 900 }
    },
    meta: {}, gasUrl: 'https://script.google.com/z/exec', lastPullAt: 0, dirty: { bbb2: 1 }, metaDirty: {}
  }) }, async (u, o) => {
    if (String(u).includes('izdata.json')) return { ok: true, json: async () => MASTER };
    const b = JSON.parse(o.body); calls.push(b);
    return { json: async () => ({ ok: true, now: 5000,
      records: {
        aaa1: { status: '已成交', updatedAt: 800 },              // 雲端較新 → 採用
        bbb2: { status: '已拒絕', note: '雲端較舊', updatedAt: 500 } // 本機較新 → 保留
      }, meta: {} }) };
  });
  await wait(300);
  const ok = await w.doSync();
  assert('同步成功', ok === true);
  assert('推送帶上 dirty 紀錄', calls.length && calls[0].records && calls[0].records.bbb2);
  assert('雲端較新者被採用', w.eval('S.records.aaa1.status') === '已成交');
  assert('本機較新者被保留', w.eval('S.records.bbb2.status') === '考慮中');
  assert('lastPullAt 更新', w.eval('S.lastPullAt') === 5000);

  console.log('Z1 — seed 匯入（只帶入本機沒有的紀錄）');
  w = boot(); await wait(300);
  w.eval('S.records.aaa1={status:"拜訪中",updatedAt:123}');
  w.eval(`(function(){
    var j={izcrmSeed:1,records:{aaa1:{status:"已成交",updatedAt:0},ccc3:{status:"已成交",customer:"某客戶",updatedAt:0}}};
    var now=Date.now(),n=0;
    for(var id in j.records){ if(S.records[id])continue; var r=Object.assign({},j.records[id]); r.updatedAt=now; S.records[id]=r; S.dirty[id]=1; n++; }
    window._seedN=n; saveS();
  })()`);
  assert('已存在的略過', w.eval('S.records.aaa1.status') === '拜訪中');
  assert('新紀錄帶入並標記待同步', w.eval('S.records.ccc3.customer') === '某客戶' && w.eval('S.dirty.ccc3') === 1);
  assert('帶入筆數正確', w.eval('window._seedN') === 1);

  console.log(failed ? `Z1 FAILED (${failed})` : 'Z1 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
