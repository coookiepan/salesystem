// 新線索：Claude 排程寫進 leads 分頁 → App 待辦頁「新線索」→ 建成客戶（待拜訪＋初訪待辦）／略過。資料全為自編。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let failed = 0;
const assert = (name, cond, extra) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : ''))); if (!cond) failed++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

// ── 後端：getLeads／markLead（從 index.html 抽出 APPS_SCRIPT_CODE，用假的試算表跑）──
console.log('L1 — 後端 leads 分頁');
const code = html.match(/const APPS_SCRIPT_CODE=`([\s\S]*?)`;/)[1];
const grid = [];
const sheet = {
  getLastRow() { return grid.length; }, setFrozenRows() {},
  getRange(r, c, nr, nc) {
    nr = nr || 1; nc = nc || 1;
    const api = {
      getValues() { return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (grid[r - 1 + i] || [])[c - 1 + j] ?? '')); },
      setValues(v) { v.forEach((row, i) => { grid[r - 1 + i] = grid[r - 1 + i] || []; row.forEach((x, j) => { grid[r - 1 + i][c - 1 + j] = x; }); }); return api; },
      setValue(x) { return api.setValues([[x]]); },
      setNumberFormat() { return api; },
    };
    return api;
  },
};
let made = null, uuid = 0;
const SpreadsheetApp = { getActiveSpreadsheet() { return { getSheetByName(n) { return n === 'leads' ? made : null; }, insertSheet() { made = sheet; return sheet; } }; } };
const Utilities = { getUuid() { return 'uuid-' + (++uuid); }, formatDate(d) { return d.toISOString().slice(0, 10); } };
const Session = { getScriptTimeZone() { return 'Asia/Taipei'; } };
const gas = new Function('SpreadsheetApp', 'Utilities', 'Session', code + '\n;return {getLeads,markLead,BACKEND_VER};')(SpreadsheetApp, Utilities, Session);
assert('後端版本 ≥ 7', gas.BACKEND_VER >= 7);
assert('第一次讀：自動建分頁與表頭，沒有線索', gas.getLeads().leads.length === 0 && grid[0][0] === '編號' && grid[0][10] === '狀態');
// 排程加的列：不填編號與狀態；日期可能被試算表變成日期格式
grid.push(['', '測試咖啡', '臺南市永康區測試路1號', '永康區', '餐飲', '每日簡報', 'https://example.com/a', '12 月開幕，徵正職', new Date('2026-12-05T00:00:00Z'), '2026-11-24', '']);
grid.push(['', '測試工廠', '臺南市新市區測試路2號', '新市區', '工廠', '每日簡報', '', '新廠完工', '', '2026-11-24', '']);
grid.push(['', '', '', '', '', '', '', '', '', '', '']);
let got = gas.getLeads().leads;
assert('回傳兩筆（空白列不算），補上編號並寫回分頁', got.length === 2 && got[0].id === 'uuid-1' && grid[1][0] === 'uuid-1' && grid[2][0] === 'uuid-2', JSON.stringify(got));
assert('日期格式的儲存格轉回 yyyy-MM-dd', got[0].open === '2026-12-05' && got[0].added === '2026-11-24');
assert('再讀一次編號不變', gas.getLeads().leads[0].id === 'uuid-1' && uuid === 2);
gas.markLead('uuid-1', 'done'); gas.markLead('uuid-2', 'skip');
assert('處理過的不再回傳，但列留著（排程靠它避免重複）', gas.getLeads().leads.length === 0 && grid[1][10] === 'done' && grid[2][10] === 'skip' && grid[1][1] === '測試咖啡');
assert('找不到的編號也算完成（不卡佇列）', gas.markLead('nope', 'skip').missing === true && gas.markLead('', 'skip').missing === true);

// ── 前端 ──
(async () => {
  const leads = [
    { id: 'L1', name: '測試咖啡', addr: '臺南市永康區測試路1號', district: '永康區', type: '餐飲', source: '每日簡報', url: 'https://example.com/a', note: '12 月開幕 <b>徵人</b>', open: '2026-12-05', added: '2026-11-24' },
    { id: 'L2', name: '測試工廠', addr: '臺南市新市區測試路2號', district: '新市區', type: '工廠', source: '每日簡報', url: 'javascript:alert(1)', note: '', open: '', added: '2026-11-24' },
    { id: 'L3', name: '已有 的店', addr: '', district: '東區', type: '不存在的類別', source: '', url: '', note: '', open: '', added: '2026-11-24' },
    { id: 'L4', name: '測試早午餐', addr: '', district: '', type: '', source: '', url: '', note: '', open: '', added: '' },
  ];
  const clients = [{ id: 'a', name: '已有的店', addr: '臺南市東區東門路3號', status: '開發中', tier: 1, need: '有', visits: [{ date: '2026-11-01' }], updatedAt: 1, trials: [], todos: [] }];
  const ls = { duskin_v2: JSON.stringify({ clients, products: [], inventory: null, gtodos: [], sheetUrl: 'https://script.example/exec' }), migration_v: '99' };
  const posts = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
  const w = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://x.github.io/salesystem/', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      Object.defineProperty(win, 'localStorage', { value: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; }, clear() {} }, configurable: true });
      win.scrollTo = () => {};
      win.fetch = async (u, o) => {
        const b = JSON.parse((o && o.body) || '{}'); posts.push(b);
        const r = b.action === 'getLeads' ? { ok: true, leads } : { ok: true, updatedAt: Date.now() };
        return { ok: true, status: 200, json: async () => r, text: async () => JSON.stringify(r) };
      };
    }
  }).window;
  await wait(300);
  w.eval("SHEET_URL='https://script.example/exec'");
  await w.loadLeads(); await wait(50);
  const doc = w.document, DB = w.eval('DB');
  const cards = () => [...doc.querySelectorAll('#lead-box .lead-card')];

  console.log('L2 — 待辦頁「新線索」');
  assert('四筆都列出來，標題有筆數', cards().length === 4 && /新線索\s*4/.test(doc.querySelector('#lead-box summary').textContent));
  assert('說明文字有跳脫，不會變成標籤', !doc.querySelector('#lead-box .lead-note b') && /<b>徵人<\/b>/.test(doc.querySelector('#lead-box .lead-note').textContent));
  assert('只有 http(s) 連結才做成按鈕', doc.querySelectorAll('#lead-box a').length === 1 && doc.querySelector('#lead-box a').getAttribute('href') === 'https://example.com/a');

  console.log('L3 — 建成客戶');
  w.leadToClient('L1'); await wait(50);
  const c = DB.clients.find(x => x.name === '測試咖啡');
  assert('建成待拜訪客戶，類別與地址帶入', c && c.status === w.eval('STATUS.PLAN') && c.type === '餐飲' && c.segment === '街邊店' && c.addr === '臺南市永康區測試路1號', JSON.stringify(c));
  assert('備註帶來源、預計開幕、說明、連結', /每日簡報/.test(c.note) && /預計開幕 2026-12-05/.test(c.note) && /example\.com\/a/.test(c.note));
  const t = c.todos.find(x => x.text === '初訪');
  assert('帶一張「初訪」待辦：到場、未排、沒有期限', t && t.type === 'visit' && !t.plan && !t.dueDate && !t.done);
  assert('初訪出現在看板的未排', w.boardTasks().some(x => x.c && x.c.name === '測試咖啡' && x.t.text === '初訪' && !x.t.plan));
  assert('客戶與線索狀態都送上雲', posts.some(p => p.action === 'save' && p.client.name === '測試咖啡') && posts.some(p => p.action === 'markLead' && p.id === 'L1' && p.status === 'done'));
  assert('清單少一筆', cards().length === 3);
  w.leadToClient('L2'); await wait(50);
  assert('工廠 → 客戶分類是工廠', DB.clients.find(x => x.name === '測試工廠').segment === '工廠');
  const n = DB.clients.length;
  w.leadToClient('L3'); await wait(50);
  assert('已有同名客戶（忽略空白）：不重複建檔，線索收掉', DB.clients.length === n && posts.some(p => p.action === 'markLead' && p.id === 'L3' && p.status === 'done'));

  console.log('L4 — 略過');
  w.leadSkip('L4'); await wait(50);
  assert('略過送上雲、清單清空後整塊不顯示', posts.some(p => p.action === 'markLead' && p.id === 'L4' && p.status === 'skip') && doc.getElementById('lead-box').innerHTML === '');
  assert('略過不會建客戶', !DB.clients.some(x => x.name === '測試早午餐'));

  console.log('L5 — 離線時按的，回來前不再顯示');
  w.eval("OUTBOX.push({action:'markLead',payload:{id:'L9',status:'skip'}});LEADS=[{id:'L9',name:'離線略過店'},{id:'L8',name:'還在的店'}]");
  assert('佇列裡標過的不列', w.openLeads().map(l => l.id).join() === 'L8');

  console.log(failed ? `leads.test.js FAILED (${failed})` : 'leads.test.js OK');
  process.exit(failed ? 1 : 0);
})();
