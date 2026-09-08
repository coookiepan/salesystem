// T2 — 每次試用一筆（c.trials）：migration v11 打包舊資料、進行中／已回收語意（推進表只算未回收）、
//    回收日 X 分級、每次試用各自的回收待辦、新一次試用（空品項、3 次提醒）、回收結果四選一
//    （成約／報價中＋一週追蹤／再試用複製品項／拒絕）、編輯表單的「本次試用」、首頁與長官快照、報價匯入。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const homeHtml = fs.readFileSync(path.join(root, 'home.html'), 'utf8');

let failed = 0;
const assert = (name, cond, extra) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : ''))); if (!cond) failed++; };
const eq = (name, a, b) => assert(name, a === b, 'got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b));
const wait = ms => new Promise(r => setTimeout(r, ms));
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); };

function boot(store, url) {
  const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
  const dom = new JSDOM(url && url.endsWith('home.html') ? homeHtml : html, {
    runScripts: 'dangerously', url: url || 'https://x.github.io/salesystem/', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      Object.defineProperty(w, 'localStorage', { value: {
        getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } }, configurable: true });
      w.scrollTo = () => {}; w.fetch = async () => { throw new Error('offline'); };
    }
  });
  return dom.window;
}

(async () => {
  const TODAY = ymd(new Date());
  // 舊格式資料（migration v11 之前）：A 試用中、B 報價（品項還在）、C 未拜訪
  const store = {
    migration_v: '10',
    duskin_v2: JSON.stringify({ sheetUrl: 'https://script.google.com/macros/s/x/exec', inventory: [], products: [], gtodos: [], clients: [
      { id: 'A', name: '進行中的店', addr: '臺南市永康區中山路1號', status: '試用中', trialDate: daysAgo(10), trialItems: [{ product: 'DECSR', qty: 1, cycle: '2W', quoted: 0 }], todos: [], visits: [{ date: daysAgo(10), mood: 3, note: '', insight: '', statusChange: '試用中', nextdate: null }], updatedAt: 1 },
      { id: 'B', name: '報價中的店', addr: '臺南市永康區中山路2號', status: '報價', trialItems: [{ product: 'S-20', qty: 2, cycle: '2W', quoted: 0 }], todos: [], visits: [{ date: '2026-07-01', mood: 3, note: '', insight: '', statusChange: '試用中', nextdate: null }, { date: '2026-07-20', mood: 3, note: '', insight: '', statusChange: '報價', nextdate: null }], updatedAt: 1 },
      { id: 'C', name: '沒試用的店', addr: '臺南市永康區中山路3號', status: '未拜訪', trialItems: [], todos: [], visits: [], updatedAt: 1 },
      { id: 'D', name: '要成約的店', addr: '臺南市永康區中山路4號', status: '試用中', trialDate: daysAgo(14), trialItems: [{ product: 'DWSH', qty: 2, cycle: '2W', quoted: 720 }, { product: 'S-20', qty: 1, cycle: '2W', quoted: 0 }, { product: 'SHB', qty: 1, cycle: '2W', quoted: 0, bundledTo: 'S-20', bundleRole: 'acc' }], todos: [], visits: [{ date: daysAgo(14), mood: 3, note: '', insight: '', statusChange: '試用中', nextdate: null }], updatedAt: 1 }
    ] })
  };
  const w = boot(store);
  await wait(400);
  w.eval('appConfirm=async()=>true');
  const DB = w.eval('DB'), S = w.eval('S');
  const byId = id => DB.clients.find(c => c.id === id);

  console.log('T2 — migration v11：舊的試用日＋品項打包成第 1 次');
  const A = byId('A'), B = byId('B'), C = byId('C');
  assert('A 試用中 → 第 1 次、進行中、回收日＝開始＋14', A.trials.length === 1 && A.trials[0].open && A.trials[0].start === daysAgo(10) && A.trials[0].due === daysAgo(-4), JSON.stringify(A.trials));
  assert('B 報價 → 第 1 次已回收、開始日取狀態變試用的拜訪', B.trials.length === 1 && !B.trials[0].open && B.trials[0].start === '2026-07-01' && B.trials[0].items.length === 1, JSON.stringify(B.trials));
  assert('C 沒試用 → trials 空陣列', Array.isArray(C.trials) && C.trials.length === 0);
  assert('舊欄位都清掉', !('trialItems' in A) && !('trialDate' in A) && !('trialItems' in C));
  const ob = JSON.parse(store.duskin_outbox || '[]');
  assert('有試用資料的客戶重推上雲（A、B、D），沒有的（C）不推', ob.filter(o => o.action === 'save').map(o => o.payload.client.id).sort().join(',') === 'A,B,D', JSON.stringify(ob.map(o => o.action + ':' + (o.payload.client || {}).id)));

  console.log('T2 — 進行中／已回收的語意');
  eq('openTrialItems A（進行中）＝1 品項', w.openTrialItems(A).length, 1);
  eq('openTrialItems B（已回收）＝0', w.openTrialItems(B).length, 0);
  eq('trialItemsOf B 仍回最近一次（客戶卡估算／報價匯入）', w.trialItemsOf(B).length, 1);
  eq('推進表金額 A ＝ 340', w.calcReportAmt(A), 340);
  eq('推進表金額 B ＝ 0（已回收不算）', w.calcReportAmt(B), 0);
  eq('客戶卡 4W 估算 B 仍看得到提案 400', w.calcFW4(B), 400);
  eq('報價匯入用最近一次品項（B → S-20）', w.ContractMaker._test.clientToConfig(B).items[0].code, 'S-20');
  eq('trialStartDate A ＝ 第 1 次開始日', w.trialStartDate(A), daysAgo(10));

  console.log('T2 — 回收日 X 分級（到回收日記 X，之後每 7 天多一個）');
  const X = (c, base) => w.trialXInfo(c, base);
  eq('回收日前 → 0 級、還 4 天', X(A, daysAgo(0)).level + '/' + X(A, daysAgo(0)).left, '0/4');
  eq('回收日當天 → X', X(A, daysAgo(-4)).marks, 'X');
  eq('回收日後 7 天 → XX', X(A, daysAgo(-11)).marks, 'XX');
  eq('已回收的（B）不分級', X(B), null);
  const A2 = JSON.parse(JSON.stringify(A)); A2.trials[0].due = daysAgo(-30);
  eq('回收日手動延後 → 以新回收日算', X(A2, daysAgo(0)).level, 0);

  console.log('T2 — 每次試用各自的回收待辦');
  w.autoAddRecycleTodos();
  const rt = (A.todos || []).find(t => t.source === 'auto-recycle');
  assert('A 開始 10 天 → 自動加「回收試用品（第 1 次）」到期＝回收日', rt && rt.text.includes('第 1 次') && rt.dueDate === A.trials[0].due && rt.trialN === 1, JSON.stringify(A.todos));
  w.autoAddRecycleTodos();
  eq('不重複產生', (A.todos || []).filter(t => t.source === 'auto-recycle').length, 1);

  console.log('T2 — 詳情頁：試用卡、新一次試用（空品項）、3 次提醒');
  w.navTo('clients', w.document.getElementById('nav-clients'));
  w.openCD(DB.clients.indexOf(A));
  await wait(50);
  eq('次數標示 1／3', w.document.getElementById('cd-trial-count').textContent, '1／3 次');
  const card = w.document.querySelector('#cd-tri .trial-card.open');
  assert('進行中的卡片：第 1 次、有回收完成鈕', card && /第 1 次試用/.test(card.textContent) && /回收完成/.test(card.textContent), card && card.textContent);
  let confirms = 0; w.eval('appConfirm=async()=>{window.__c=(window.__c||0)+1;return true;}');
  await w.startTrial();
  await wait(50);
  confirms = w.eval('window.__c||0');
  assert('還有進行中 → 先確認一次再開', confirms === 1);
  eq('第 2 次建立、品項空的', A.trials.length + '/' + A.trials[1].items.length, '2/0');
  assert('直接開品項編輯（第 2 次）', w.document.getElementById('cd-items-modal').classList.contains('on') && /第 2 次試用/.test(w.document.getElementById('cdm-title').textContent));
  eq('品項 modal 帶出開始日／回收日', w.document.getElementById('cdm-trial-start').value + '→' + w.document.getElementById('cdm-trial-due').value, TODAY + '→' + w.addDays(TODAY, 14));
  w.closeCDItems();
  A.trials[1].items = [{ product: 'S-20', qty: 1, cycle: '2W', quoted: 0 }];

  console.log('T2 — 回收結果：再試用（一模一樣的品項）→ 第 3 次；超過 3 次會提醒');
  w.openRecoverModal(2);
  w.finishRecover('再試用');
  await wait(30);
  assert('第 2 次已回收、結果再試用', !A.trials[1].open && A.trials[1].result === '再試用' && A.trials[1].recovered === TODAY);
  assert('第 3 次進行中、品項複製自第 2 次', A.trials[2].open && A.trials[2].items.length === 1 && A.trials[2].items[0].product === 'S-20' && A.trials[2].items !== A.trials[1].items);
  eq('狀態維持試用中', A.status, '試用中');
  eq('次數標示：已達上限', w.document.getElementById('cd-trial-count').textContent, '3／3 次（已達上限）');
  w.eval('window.__c=0');
  await w.startTrial();
  await wait(30);
  eq('第 4 次：進行中確認＋上限確認共 2 次', w.eval('window.__c'), 2);
  eq('仍可開第 4 次', A.trials.length, 4);
  w.closeCDItems();

  console.log('T2 — 回收結果：報價中 → 一週後追蹤問是否拒絕');
  A.todos.push({ text: '回收試用品（第 4 次）', dueDate: TODAY, done: false, source: 'auto-recycle', trialN: 4 });
  w.openRecoverModal(4);
  w.finishRecover('報價中');
  await wait(30);
  eq('狀態改為報價', A.status, '報價');
  const qf = A.todos.find(t => t.source === 'quote-followup');
  assert('加了一週追蹤待辦', qf && qf.dueDate === w.addDays(TODAY, 7) && !qf.done, JSON.stringify(A.todos));
  assert('這次（第 4 次）的回收待辦被結案，第 1 次還沒回收的不動', A.todos.find(t => t.source === 'auto-recycle' && t.trialN === 4).done && !A.todos.find(t => t.source === 'auto-recycle' && t.trialN === 1).done);
  qf.dueDate = TODAY;   // 模擬一週後
  w.eval('appConfirm=async()=>false');   // 再等一週
  await w.checkQuoteFollowups();
  assert('選「再等一週」→ 到期日往後 7 天、狀態不變', qf.dueDate === w.addDays(TODAY, 7) && A.status === '報價');
  qf.dueDate = TODAY;
  w.eval('appConfirm=async()=>true');    // 改成拒絕
  await w.checkQuoteFollowups();
  assert('選「改成拒絕」→ 狀態拒絕、待辦完成、補一筆拜訪', A.status === '拒絕' && qf.done && A.visits.some(v => v.statusChange === '拒絕'));

  console.log('T2 — 回收結果：成約（品項轉成約）／拒絕');
  const D = byId('D');
  w.openCD(DB.clients.indexOf(D));
  w.openRecoverModal(1);
  w.finishRecover('成約');
  await wait(30);
  assert('D 第 1 次已回收、結果成約', !D.trials[0].open && D.trials[0].result === '成約');
  assert('品項（含配件）轉成約、帶成約日、保留議價', D.contractedItems.length === 3 && D.contractedItems.every(it => it.contractDate === TODAY) && D.contractedItems[0].quoted === 720);
  eq('狀態已成約', D.status, '已成約');
  eq('成約後 4W 用成約品項', w.calcFW4(D), 720 + 200);
  const B2 = byId('B');
  B2.trials.push(w.newTrial(B2, [{ product: 'DOME', qty: 1, cycle: '4W', quoted: 0 }])); B2.status = '試用中';
  w.openCD(DB.clients.indexOf(B2));
  w.openRecoverModal(2);
  w.finishRecover('拒絕');
  await wait(30);
  assert('拒絕 → 狀態拒絕、試用關閉', B2.status === '拒絕' && !B2.trials[1].open && B2.trials[1].result === '拒絕');

  console.log('T2 — 編輯表單：本次試用');
  w.openCF(-1);
  assert('新客戶：沒有試用區塊，只有「開始第 1 次試用」鈕', w.document.getElementById('cf-trial-box').style.display === 'none' && /第 1 次/.test(w.document.getElementById('cf-trial-start-btn').textContent));
  await w.cfStartTrial();
  assert('開始後：區塊出現、開始日今天、回收日＋14、狀態自動試用中', w.document.getElementById('cf-trial-box').style.display === 'block' && w.document.getElementById('cf-trial-start').value === TODAY && w.document.getElementById('cf-trial-due').value === w.addDays(TODAY, 14) && w.document.getElementById('cf-status').value === '試用中');
  w.document.getElementById('cf-name').value = '表單新店';
  S.cfItems.push({ product: 'DECSR', qty: 2, cycle: '2W', quoted: 0 });
  await w.saveClient();
  await wait(150);
  const N = DB.clients.find(c => c.name === '表單新店');
  assert('存檔 → 第 1 次試用進行中、品項寫入', N && N.trials.length === 1 && N.trials[0].open && N.trials[0].items[0].product === 'DECSR', N && JSON.stringify(N.trials));
  w.openCF(DB.clients.indexOf(N));
  assert('再編輯：帶出進行中的第 1 次', /第 1 次試用（進行中）/.test(w.document.getElementById('cf-trial-title').textContent) && S.cfItems.length === 1);
  w.closeForm();

  console.log('T2 — 首頁與長官快照');
  DB.clients.push({ id: 'H', name: '該收的店', status: '試用中', trials: [{ n: 1, start: daysAgo(15), due: daysAgo(1), items: [{ product: 'S-20', qty: 1 }], open: true, recovered: '', result: '' }], todos: [], visits: [], updatedAt: 1 });
  w.saveLocal();
  const wh = boot(store, 'https://x.github.io/salesystem/home.html');
  await wait(300);
  eq('首頁「試用該收」只算到了回收日的進行中試用（H），未到期的 A 不算', wh.document.getElementById('s-trial').textContent, '1');
  const raw = [{ status: '試用中', trialDate: '2026-08-01', trialItems: [{ product: 'S-20', qty: 1 }] }];
  eq('長官快照舊格式打包', w.packAllTrials(raw) === 1 && raw[0].trials[0].due, '2026-08-15');

  console.log(failed ? 'T2 FAILED ❌ (' + failed + ')' : 'T2 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
