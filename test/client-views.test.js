// Z3 — 客戶列表視角與排序
//   分類：試用回收（區分組＋逾期最久優先＋區域標頭）、成約待轉交（等最久優先）
//   排序誠實化：trial=新→舊且空值沉底、status 未設狀態不搶頭、單一狀態分類跳過 statusFilter
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
let failed = 0;
function assert(name, cond, extra) { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : ''))); if (!cond) failed++; }
function cardOrder(w) { // 依渲染順序取出卡片名稱（去掉型別小字）
  return [...w.document.querySelectorAll('#clients-list .cc .cc-name')].map(e => e.textContent.trim().split(/\s/)[0]);
}

(async () => {
  const V = [{ date: '2026-01-01', mood: 3, note: '' }];
  const clients = [
    // 試用中三家：仁德晚開始、官田早開始、官田較晚開始 → 區分組後官田在仁德前（zh 排序），官田內逾期久的在前
    { id: 't-rende', name: '仁德試用', addr: '臺南市仁德區中山路1號', status: '試用中', trialDate: '2026-07-10', todos: [], visits: V, updatedAt: 1 },
    { id: 't-guantian-old', name: '官田試用久', addr: '臺南市官田區工業路2號', status: '試用中', trialDate: '2026-06-01', todos: [], visits: V, updatedAt: 1 },
    { id: 't-guantian-new', name: '官田試用新', addr: '臺南市官田區工業路3號', status: '試用中', trialDate: '2026-07-01', todos: [], visits: V, updatedAt: 1 },
    // 成約：D1 早成約未轉交、D2 晚成約未轉交、D3 已轉交（不該出現在成約待轉交）
    { id: 'd1', name: '成約等很久', addr: '臺南市永康區中正路4號', status: '已成約', contractedItems: [{ product: 'S-20', qty: 1, cycle: '2W', contractDate: '2026-05-01' }], todos: [], visits: V, updatedAt: 1 },
    { id: 'd2', name: '成約剛簽', addr: '臺南市永康區中正路5號', status: '已成約', contractedItems: [{ product: 'S-20', qty: 1, cycle: '2W', contractDate: '2026-07-15' }], todos: [], visits: V, updatedAt: 1 },
    { id: 'd3', name: '已轉交了', addr: '臺南市永康區中正路6號', status: '已轉交', contractedItems: [{ product: 'S-20', qty: 1, cycle: '2W', contractDate: '2026-04-01' }], todos: [], visits: V, updatedAt: 1 },
    // 排序測試用：無狀態、無試用日 vs 有試用日、舊「已結案」狀態
    { id: 'n1', name: '無狀態客', addr: '臺南市新市區中華路7號', status: '', todos: [], visits: [], updatedAt: 9 },
    { id: 'n2', name: '有試用日客', addr: '臺南市新市區中華路8號', status: '複訪', trialDate: '2026-07-18', todos: [], visits: V, updatedAt: 2 },
    { id: 'n3', name: '已結案客', addr: '臺南市新市區中華路9號', status: '已結案', todos: [], visits: V, updatedAt: 3 },
    // 已拜訪定義修正：純成約、沒有拜訪紀錄的客戶也算已拜訪（有互動）
    { id: 'n4', name: '純成約沒拜訪', addr: '臺南市新市區中華路10號', status: '已轉交', contractedItems: [{ product: 'DOME', qty: 1, cycle: '4W', contractDate: '2026-06-20' }], todos: [], visits: [], updatedAt: 4 }
  ];
  let w = boot({ duskin_v2: JSON.stringify({ clients, products: [], inventory: null }) });
  await wait(400);

  console.log('Z3 — 試用回收：區分組＋逾期最久優先');
  w.toggleCat('試用回收');
  let names = cardOrder(w);
  assert('只含試用中三家', names.length === 3 && !names.includes('成約等很久'), names.join(','));
  assert('仁德在官田前（區分組 zh 排序）', names[0] === '仁德試用', names.join(','));
  assert('官田內逾期久的在前', names.indexOf('官田試用久') < names.indexOf('官田試用新'), names.join(','));
  let out = w.document.getElementById('clients-list').innerHTML;
  assert('有區域標頭（分區分組）', /仁德區/.test(out) && /官田區/.test(out));
  assert('卡片顯示試用第 N 天', /試用第 \d+ 天/.test(out));
  // 在 ⚙️ 隱藏試用中也不該空白
  w.eval('statusFilter["試用中"]=false');
  w.renderClients();
  assert('隱藏「試用中」狀態仍看得到試用回收', cardOrder(w).length === 3);
  w.eval('statusFilter["試用中"]=true');

  console.log('Z3 — 成約待轉交');
  w.toggleCat('成約待轉交');
  names = cardOrder(w);
  assert('只含未轉交的成約', names.length === 2 && !names.includes('已轉交了'), names.join(','));
  assert('等最久的在最上面', names[0] === '成約等很久', names.join(','));
  out = w.document.getElementById('clients-list').innerHTML;
  assert('卡片顯示成約日', /成約日：2026-05-01/.test(out));

  console.log('Z3 — 排序誠實化');
  w.toggleCat('全部');
  w.document.getElementById('csort').value = 'trial';
  w.renderClients();
  names = cardOrder(w);
  assert('試用 新→舊：最新在最上', names[0] === '有試用日客', names.join(','));
  assert('沒有試用日的沉到最底', names[names.length - 1] === '無狀態客', names.join(','));
  w.eval('statusFilter["拒絕"]=true');   // 讓已結案（併入拒絕）可見，才能驗證排序位置
  w.document.getElementById('csort').value = 'status';
  w.renderClients();
  names = cardOrder(w);
  // 舊 bug：不在 SO 裡的狀態 indexOf=-1 會排到「最前面」——已結案該併入拒絕排最後
  assert('狀態排序：已結案不搶最前、併入拒絕沉底', names[0] !== '已結案客' && names[names.length - 1] === '已結案客', names.join(','));
  assert('狀態排序：無狀態視為未拜訪排在複訪前', names.indexOf('無狀態客') < names.indexOf('有試用日客'), names.join(','));
  // 卡片標籤誠實化：從沒試用過的客戶顯示「首次」而非「試用日」
  w.document.getElementById('csort').value = 'default';
  w.toggleCat('已拜訪');
  out = w.document.getElementById('clients-list').innerHTML;
  assert('真試用日標「試用日」', /試用日：2026-07-18/.test(out));
  assert('成約客戶只有首訪紀錄 → 標「首次」不標試用日', /首次：2026-01-01/.test(out));

  console.log('Z3 — 已拜訪定義與藥丸數量');
  names = cardOrder(w);
  assert('純成約沒拜訪也算已拜訪', names.includes('純成約沒拜訪'), names.join(','));
  const pills = w.document.getElementById('status-pills').textContent.replace(/\s+/g, '');
  assert('藥丸顯示數量：試用回收 3', /試用回收3/.test(pills), pills);
  assert('藥丸顯示數量：成約待轉交 2', /成約待轉交2/.test(pills), pills);

  console.log(failed ? `Z3 FAILED (${failed})` : 'Z3 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
