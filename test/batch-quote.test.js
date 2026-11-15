// Q1 — 批次報價單：挑出「該報價」的店 → 勾選 → 交給 ContractMaker 產一個 Word 檔（一家一頁）。
//   這裡驗證主程式這一半：挑店規則、出不了的原因、勾選數量、傳給模組的店與檔名、不改資料。
//   Word 檔本身由 ContractMaker.saveQuotes 產生（docx 函式庫走 CDN，測試環境不載入，故以替身攔截）。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let failed = 0;
const assert = (name, cond, extra) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : ''))); if (!cond) failed++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const D = n => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };

(async () => {
  const T = items => [{ n: 1, start: D(-8), due: D(6), items, open: true, recovered: '', result: '' }];
  const V = [{ date: D(-8) }];
  const clients = [
    { id: 'a', name: '試用沒報價', status: '試用', tier: 2, todos: [], visits: V, updatedAt: 1, trials: T([{ product: 'DECSR', qty: 2, cycle: '2W', quoted: 0 }]) },
    { id: 'b', name: '一級店', status: '試用', tier: 1, todos: [], visits: V, updatedAt: 1, trials: T([{ product: 'DOME', qty: 3, cycle: '4W', quoted: 0 }]) },
    { id: 'c', name: '試用已報價', status: '試用', quoted: true, tier: 1, visits: V, updatedAt: 1, trials: T([{ product: 'DOME', qty: 1, cycle: '4W', quoted: 0 }]),
      todos: [{ text: '報價追蹤（報價後一週，問結果）', dueDate: D(3), done: false, source: 'quote-followup' }] },
    { id: 'd', name: '待辦寫了報價但沒品項', status: '開發中', tier: 2, need: '有', visits: V, updatedAt: 1, trials: [], todos: [{ text: '送報價單', dueDate: D(1), done: false }] },
    { id: 'e', name: '待辦報價已完成', status: '開發中', tier: 2, need: '有', visits: V, updatedAt: 1, trials: [], todos: [{ text: '送報價單', dueDate: D(-1), done: true }] },
    { id: 'f', name: '擱置的店', status: '擱置', tier: 3, shelveReason: '嫌貴', visits: V, updatedAt: 1, trials: T([{ product: 'DOME', qty: 1, cycle: '4W', quoted: 0 }]).map(t => Object.assign(t, { open: false })), todos: [{ text: '報價', dueDate: '', done: false }] },
    { id: 'g', name: '開發中有成約品項要報價', status: '開發中', tier: 3, need: '有', visits: V, updatedAt: 1, trials: [], contractedItems: [], todos: [{ text: '安排報價', dueDate: D(2), done: false, source: 'auto-quote' }] }
  ];
  clients[6].trials = T([{ product: 'S-20', qty: 1, cycle: '2W', quoted: 0 }]).map(t => Object.assign(t, { open: false, recovered: D(-1) }));
  const ls = { duskin_v2: JSON.stringify({ clients, products: [], inventory: null }), migration_v: '99' };
  const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
  const w = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://x.github.io/salesystem/', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      Object.defineProperty(win, 'localStorage', { value: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; }, clear() {} }, configurable: true });
      win.scrollTo = () => {}; win.fetch = async () => { throw new Error('offline'); };
    }
  }).window;
  await wait(400);

  console.log('Q1 — 挑出該報價的店');
  const list = w.batchQuoteList();
  const names = list.map(x => x.c.name);
  assert('試用沒報價、待辦含「報價」、系統的安排報價 → 列入', ['試用沒報價', '一級店', '待辦寫了報價但沒品項', '開發中有成約品項要報價'].every(n => names.includes(n)), names.join(','));
  assert('已報價（只剩報價追蹤）、待辦已完成、擱置 → 不列', !names.some(n => /試用已報價|待辦報價已完成|擱置的店/.test(n)), names.join(','));
  assert('評價重的排前面', names[0] === '一級店', names.join(','));
  const by = n => list.find(x => x.c.name === n);
  assert('帶出品項與四週合計（DECSR×2 → 680、DOME×3 → 660）', by('試用沒報價').total === 680 && by('一級店').total === 660 && by('試用沒報價').cfg.items[0].code === 'DECSR', JSON.stringify([by('試用沒報價').total, by('一級店').total]));
  assert('沒品項的店列出原因、不能勾', !by('待辦寫了報價但沒品項').cfg && by('待辦寫了報價但沒品項').why === '客戶卡沒有品項');
  assert('沒有進行中的試用時用最近一次的品項', by('開發中有成約品項要報價').total === 200);

  console.log('Q1 — 勾選與產出');
  w.openBatchQuote();
  const doc = w.document;
  assert('視窗列出可勾的 3 家＋出不了的 1 家', doc.querySelectorAll('#bq-list .bq-ck').length === 3 && /出不了：客戶卡沒有品項/.test(doc.getElementById('bq-list').textContent));
  assert('預設全勾，按鈕寫 3 份', doc.getElementById('bq-go').textContent === '產出 Word（3 份）');
  doc.querySelectorAll('#bq-list .bq-ck')[2].checked = false; w.bqCount();
  assert('取消一家 → 2 份', doc.getElementById('bq-go').textContent === '產出 Word（2 份）');
  const before = ls.duskin_v2;
  let got = null;
  w.ContractMaker.saveQuotes = async (cs, fname) => { got = { names: cs.map(c => c.name), fname }; return 'downloaded'; };
  await w.batchQuoteGo();
  assert('只把勾選的店交給模組，檔名帶份數與日期', got && got.names.join(',') === '一級店,試用沒報價' && got.fname === '報價單_2份_' + D(0) + '.docx', JSON.stringify(got));
  assert('產出後關閉視窗', !doc.getElementById('batch-quote-modal').classList.contains('on'));
  assert('只產檔、不改客戶資料（不會自動標成已報價）', ls.duskin_v2 === before && !w.eval('DB.clients').find(c => c.id === 'a').quoted);
  w.ContractMaker.saveQuotes = async () => { throw new Error('無法下載 docx 函式庫，請檢查網路'); };
  w.eval('appAlert=(m)=>{window.__alert=m;return Promise.resolve(true)}');
  w.openBatchQuote();
  await w.batchQuoteGo();
  assert('產生失敗 → 說明原因、視窗留著可重試', /無法下載 docx/.test(w.__alert || '') && doc.getElementById('batch-quote-modal').classList.contains('on') && !doc.getElementById('bq-go').disabled);

  console.log(failed ? `Q1 FAILED (${failed})` : 'Q1 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
