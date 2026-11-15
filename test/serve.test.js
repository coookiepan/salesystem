// R1 — 公司試用表比對（SERVE別試用顧客一覽表）＋週報成約列除稅。
//   用真的 SheetJS（vendor/xlsx.mini.min.js）寫出再讀回一份自編的假報表，驗證解析；
//   再驗證配對（顧客編號／電話／名稱）、四種落差、逐筆「照公司的」只動那一筆、週報成約列 ÷1.05。
//   測試資料全是虛構的——真實的公司報表含客戶資料，不進 repo。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.join(__dirname, '..');
const XLSX = require(path.join(root, 'vendor', 'xlsx.mini.min.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
const assert = (name, cond, extra) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : ''))); if (!cond) failed++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

// 公司報表的欄位位置（A=0）：B 單號、D 逾期記號、E 顧客編號、F 名稱、H 電話、J 狀態、K 最初試用、L 試用日、O 回收預定、
// P 商品序號、Q 商品代號、T 試用數、U 試用金額、X 4W、Y 回收日、AA 回收數、AB 遺失、AC 契約數、AD 次數
const row = cells => { const r = new Array(30).fill(''); Object.keys(cells).forEach(k => { r[XLSX.utils.decode_col(k)] = cells[k]; }); return r; };
const order = (no, mark, custNo, name, phone, status, start, due, item) => row(Object.assign({ B: no, D: mark, E: custNo, F: name, H: phone, J: status, K: '2026/09/01', L: start, O: due }, item));
const item = (code, qty, amt, amt4w, rec) => ({ P: '1', Q: code, T: qty, U: amt, X: amt4w, Y: rec || '', AA: rec ? qty : 0, AB: 0, AD: 1 });
const aoa = [
  row({ A: '單位：測試所', I: 'SERVE別試用顧客一覽表', W: '製作日期：2026/11/13 08:32:53' }),
  row({ A: '對象期間：2026/10/01 ~ 2026/11/30', W: '頁碼：1.Page' }),
  row({}),
  row({ A: '日期指定區分：查詢試用日期' }),
  row({ B: '試用單號', C: '營業所', D: '負責人', E: '顧客編號', F: '顧客名稱', H: '電話號碼', J: '狀態', K: '最初試用', L: '試用日', O: '回收預定日', P: '商品名稱', T: '試用數', U: '試用金額', X: '4W試用金額', Y: '回收日', AA: '回收數', AB: '遺失數', AC: '契約數', AD: '次數' }),
  row({ C: '測試所', D: '0001 測試員(R)', H: '顧客試用軒數 : 5', K: '顧客試用金額 : ', O: 0, P: '4W試用金額 : ', U: 0 }),
  order('005261102001', '', '1000001', '甲甲餐飲股份有限公司', '06-1111111', '未回收', '2026/11/02', '2026/11/16', item('DECSR', 1, 170, 340)),
  order('005261016003', '已回收', '1000002', '乙乙診所', '06-2222222', '已回收', '2026/10/16', '2026/10/30', item('DOME', 2, 440, 440, '2026/11/02')),
  order('005261008005', 'XX', '1000003', '丙丙有限公司', '尚無', '未回收', '2026/10/08', '2026/10/22', item('FNBK', 1, 0, 0)),
  row(item('FNPF2-K', 1, 350, 350)),
  row(item('BT1', 1, 0, 0)),
  order('005261020009', '', '1000004', '丁丁商行', '06-4444444', '未回收', '2026/10/20', '2026/11/03', item('S-20', 1, 100, 200)),
  row(item('SHB', 1, 0, 0)),
  order('005261101007', '', '1000004', '丁丁商行', '06-4444444', '未回收', '2026/11/01', '2026/11/15', item('DOME', 1, 220, 220)),
  order('005261105002', '', '1000005', '完全陌生的新店', '06-5555555', '未回收', '2026/11/05', '2026/11/19', item('DOME', 1, 220, 220)),
  row({ Q: '合計', T: 9, U: 1500, X: 1770 }),
  row({ Q: '總合計', T: 9, U: 1500, X: 1770 })
];

(async () => {
  console.log('R1 — 解析（真的 SheetJS 寫出再讀回）');
  const wbOut = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbOut, XLSX.utils.aoa_to_sheet(aoa), 'SAL_010_R_0015_01');
  const buf = XLSX.write(wbOut, { type: 'buffer', bookType: 'xlsx' });
  const wbIn = XLSX.read(buf, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(wbIn.Sheets[wbIn.SheetNames[0]], { header: 1, raw: true, defval: '' });

  const ls = {};
  const T = (n, start, due, items, open, recovered) => ({ n, start, due, items, open, recovered: recovered || '', result: '' });
  const clients = [
    // 甲：電話對得上、同一天的試用但品項不同、你記成已回收
    { id: 'a', name: '甲甲', phone: '(06)111-1111', addr: '', status: '開發中', tier: 1, need: '有', todos: [], visits: [{ date: '2026-11-02' }], updatedAt: 1,
      trials: [T(1, '2026-11-02', '2026-11-16', [{ product: 'DECLR', qty: 1, cycle: '2W', quoted: 300 }], false, '2026-11-10')] },
    // 乙：名稱（去掉字尾）對得上、完全一致
    { id: 'b', name: '乙乙診所', phone: '', addr: '', status: '開發中', tier: 2, need: '未定', todos: [], visits: [{ date: '2026-10-16' }], updatedAt: 1,
      trials: [T(1, '2026-10-16', '2026-10-30', [{ product: 'DOME', qty: 2, cycle: '4W', quoted: 0 }], false, '2026-11-02')] },
    // 丙：已配對過（custNo）、芳香機——公司把錢記在口味、你記在機台，應視為一致
    { id: 'c', name: '阿丙的店', phone: '', addr: '', custNo: '1000003', status: '試用', tier: 2, todos: [], visits: [{ date: '2026-10-08' }], updatedAt: 1,
      trials: [T(1, '2026-10-08', '2026-10-22', [{ product: 'FNBK', qty: 1, cycle: '4W', quoted: 0 }, { product: 'FNPF2-K', qty: 1, cycle: '', quoted: 0, bundledTo: 'FNBK', bundleRole: 'flavor' }, { product: 'BT1', qty: 1, cycle: '', quoted: 0, bundledTo: 'FNBK', bundleRole: 'acc' }], true)] },
    // 丁：電話對得上；公司兩張單，你只記了 11/01 那張（差兩天＝同一筆、日期不同），另外多記一筆公司沒有的
    { id: 'd', name: '丁丁', phone: '06-4444444', addr: '', status: '試用', tier: 3, visits: [{ date: '2026-10-03' }], updatedAt: 1,
      todos: [{ text: '回收試用品（第 1 次）', dueDate: '2026-10-17', done: false, source: 'auto-recycle', trialN: 1 }],
      trials: [T(1, '2026-10-03', '2026-10-17', [{ product: 'GLH', qty: 1, cycle: '2W', quoted: 0 }], true), T(2, '2026-11-03', '2026-11-17', [{ product: 'DOME', qty: 1, cycle: '4W', quoted: 0 }], true)] },
    // 戊：公司表上沒有這家，但你在期間內記了試用
    { id: 'e', name: '只有我記的店', phone: '', addr: '', status: '試用', tier: 2, todos: [], visits: [{ date: '2026-11-08' }], updatedAt: 1,
      trials: [T(1, '2026-11-08', '2026-11-22', [{ product: 'DOME', qty: 1, cycle: '4W', quoted: 0 }], true)] },
    // 己：名稱相近的候選（給「完全陌生的新店」）不存在；成約客戶供週報測試
    { id: 'f', name: '成約店', phone: '', addr: '', status: '成約', tier: 1, todos: [], visits: [{ date: '2026-11-04' }], updatedAt: 1, trials: [],
      contractedItems: [{ product: 'DECSR', qty: 1, cycle: '2W', quoted: 630, contractDate: '2026-11-04' }] }
  ];
  ls.duskin_v2 = JSON.stringify({ clients, products: [], inventory: null });
  ls.migration_v = '99';
  const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
  const w = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://x.github.io/salesystem/', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      Object.defineProperty(win, 'localStorage', { value: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; }, clear() {} }, configurable: true });
      win.scrollTo = () => {}; win.fetch = async () => { throw new Error('offline'); };
    }
  }).window;
  await wait(400);
  const DB = w.eval('DB');
  const by = id => DB.clients.find(c => c.id === id);

  const data = w.parseServeRows(rows);
  assert('對象期間', data.from === '2026-10-01' && data.to === '2026-11-30', data.from + '~' + data.to);
  assert('6 張試用單、5 家（合計列與業務小計列不算）', data.orders.length === 6 && new Set(data.orders.map(o => o.custNo)).size === 5);
  assert('4W 合計對得上表尾', data.orders.reduce((a, o) => a + w.serveAmt4w(o), 0) === 1770);
  const o3 = data.orders.find(o => o.custNo === '1000003');
  assert('一張單多個商品、逾期記號、日期轉成 YYYY-MM-DD', o3.items.length === 3 && o3.marks === 'XX' && o3.start === '2026-10-08' && o3.due === '2026-10-22', JSON.stringify(o3));
  assert('已回收的單帶回收日', data.orders.find(o => o.custNo === '1000002').items[0].recovered === '2026-11-02');
  let threw = '';
  try { w.parseServeRows([['隨便一張表'], ['a', 'b']]); } catch (e) { threw = e.message; }
  assert('不是這種報表 → 明確報錯', /找不到「試用單號」/.test(threw), threw);

  console.log('R1 — 配對與落差');
  data.at = Date.now(); ls.duskin_serve = JSON.stringify(data);
  let r = w.serveDiff(data);
  const kinds = () => r.issues.map(i => i.kind + ':' + (i.c ? i.c.id : i.custNo)).sort().join(',');
  assert('電話（不同寫法）配到甲、名稱去字尾配到乙、顧客編號配到丙', w.serveFindClient(data.orders[0]) === by('a') && w.serveFindClient(data.orders[1]) === by('b') && w.serveFindClient(o3) === by('c'));
  assert('乙完全一致、丙（芳香機：公司記口味／你記機台）也視為一致', r.okShops === 2 && !r.issues.some(i => i.c === by('b') || i.c === by('c')), kinds());
  const ia = r.issues.find(i => i.c === by('a'));
  assert('甲：兩邊都有但不一樣（回收狀態＋品項）', ia && ia.kind === 'diff' && ia.diffs.some(x => /公司：未回收／你：已回收/.test(x)) && ia.diffs.some(x => /品項：公司 DECSR×1／你 DECLR×1/.test(x)), ia && ia.diffs.join(' | '));
  const id = r.issues.filter(i => i.c === by('d'));
  assert('丁：10/20 那張你沒記（missing）、11/01 與你的 11/03 視為同一筆但日期不同（diff）、你的 10/03 公司沒有（extra）',
    id.map(i => i.kind).sort().join(',') === 'diff,extra,missing' && id.find(i => i.kind === 'missing').o.start === '2026-10-20' && id.find(i => i.kind === 'extra').t.start === '2026-10-03', id.map(i => i.kind + (i.o ? i.o.start : i.t.start)).join(','));
  assert('戊：公司表沒有這家，但你期間內有試用 → extra', r.issues.some(i => i.kind === 'extra' && i.c === by('e')));
  assert('陌生的新店 → 配不上', r.issues.some(i => i.kind === 'nomatch' && i.custNo === '1000005'));

  console.log('R1 — 逐筆「照公司的」：只動那一筆');
  const before = JSON.stringify(DB.clients.filter(c => c.id !== 'a'));
  w.openServeModal();
  assert('畫面列出四種落差', ['配不上店', '公司有、你沒記', '兩邊都有、內容不一樣', '你有、公司沒有'].every(t => w.document.getElementById('serve-list').textContent.includes(t)));
  w.serveApply(ia.o.no);
  const a = by('a');
  assert('甲更新：品項換成公司的、改回進行中、回收日清掉、記下顧客編號', a.trials[0].items[0].product === 'DECSR' && a.trials[0].open && !a.trials[0].recovered && a.custNo === '1000001', JSON.stringify(a.trials[0]));
  assert('甲因為還在試用 → 階段變試用、補一筆拜訪紀錄', a.status === '試用' && a.visits.some(v => /公司試用表補登/.test(v.insight || '')));
  assert('其他店完全沒被動到', JSON.stringify(DB.clients.filter(c => c.id !== 'a')) === before);
  r = w.serveDiff(w.serveData());
  assert('甲的落差消失', !r.issues.some(i => i.c === by('a')));

  const miss = r.issues.find(i => i.kind === 'missing' && i.c === by('d'));
  w.serveApply(miss.o.no);
  const d = by('d');
  assert('丁補上 10/20：依試用日重排成第 2 次，拖把配件掛在主商品底下', d.trials.map(t => t.start).join(',') === '2026-10-03,2026-10-20,2026-11-03' && d.trials[1].n === 2 && d.trials[2].n === 3 && d.trials[1].items.find(it => it.product === 'SHB').bundledTo === 'S-20', JSON.stringify(d.trials.map(t => [t.n, t.start])));
  assert('原本的待辦仍指向第 1 次', d.todos[0].trialN === 1);
  r = w.serveDiff(w.serveData());
  w.serveApply(r.issues.find(i => i.kind === 'diff' && i.c === by('d')).o.no);
  assert('丁的 11/03 照公司改成 11/01', by('d').trials[2].start === '2026-11-01' && by('d').trials[2].due === '2026-11-15');

  w.serveCreate('1000005');
  const nw = DB.clients.find(c => c.custNo === '1000005');
  assert('建立新客戶：帶名稱電話與顧客編號、階段待拜訪', nw && nw.name === '完全陌生的新店' && nw.phone === '06-5555555' && nw.status === '待拜訪');
  r = w.serveDiff(w.serveData());
  assert('新客戶的試用變成「公司有、你沒記」等你逐筆補', r.issues.some(i => i.kind === 'missing' && i.c === nw) && !r.issues.some(i => i.kind === 'nomatch'));
  w.serveLink('1000005', DB.clients.indexOf(by('e')));
  assert('手動改配對：顧客編號移到指定的店，原本那家清掉', by('e').custNo === '1000005' && !nw.custNo);

  console.log('R1 — 週報：成約列用除稅後金額、試用列用含稅金額');
  w.openReportModal();
  w.document.getElementById('rpt-from').value = '2026-11-02';
  w.document.getElementById('rpt-to').value = '2026-11-08';
  w.document.getElementById('rpt-start-month').value = '11';
  w.genReport();
  const lines = w.document.getElementById('rpt-4w').value.split('\n').map(l => l.split('\t'));
  const deal = lines.find(l => l[1] === '成約店');
  assert('成約店列入推進表：金額 630 ÷ 1.05 ＝ 600、進度說明「成約」', deal && deal[7] === '600' && deal[13] === '成約', deal && deal.join('|'));
  const tri = lines.find(l => l[1] === '甲甲');
  assert('試用中的店維持含稅金額（DECSR 2W 原價 ×2 ＝ 340）', tri && tri.slice(7, 13).includes('340'), tri && tri.join('|'));

  console.log(failed ? `R1 FAILED (${failed})` : 'R1 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
