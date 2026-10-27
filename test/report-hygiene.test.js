// R1 — 清單健檢（產出報表前把過期的店清乾淨）
//   問題：推進表只要狀態是「試用中／報價／將成約」就一定列進去，不看最近有沒有在動，
//         所以忘記按回收的店會永遠留在表上，日報被舊店塞滿。
//   這支測試鎖住：挑選規則、三個動作的資料後果、清完就不再出現、推進表列數提示。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const ymd = d => d.toISOString().slice(0, 10);
const TODAY = ymd(new Date());
const ago = n => ymd(new Date(Date.now() - n * 864e5));
const fut = n => ymd(new Date(Date.now() + n * 864e5));

function boot(seed) {
  const store = Object.assign({}, seed || {});
  const ls = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; }
  };
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://x.github.io/salesystem/', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
    beforeParse(w) {
      Object.defineProperty(w, 'localStorage', { value: ls, configurable: true });
      w.scrollTo = () => {};
      w.fetch = async () => { throw new Error('offline'); };
    }
  });
  return dom.window;
}
// 對話框 stub 要在 App 載入「之後」蓋，否則 index.html 的定義會把它覆蓋掉
function stubDialogs(w) { w.appConfirm = async () => true; w.appAlert = () => {}; }
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
function assert(name, cond, extra) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : '')));
  if (!cond) failed++;
}

const CLIENTS = [
  // ① 試用過了回收日還開著，而且 40 天沒動 → 最該處理
  { id: 'old-trial', name: '忘記回收的麵店', addr: '臺南市新營區中山路1號', status: '試用中',
    visits: [{ date: ago(40), mood: 3, note: '' }], todos: [],
    trials: [{ n: 1, start: ago(40), due: ago(26), items: [{ product: 'NSAC', qty: 2, cycle: '2W' }], open: true, recovered: '', result: '' }] },
  // ② 報價追蹤的提醒日早就過了
  { id: 'old-quote', name: '報價沒下文的早餐店', addr: '臺南市後壁區2號', status: '報價',
    visits: [{ date: ago(35), mood: 2, note: '' }], trials: [],
    todos: [{ text: '報價追蹤', source: 'quote-followup', dueDate: ago(28), done: false }] },
  // ③ 將成約但 50 天完全沒動（沒有進行中的試用）
  { id: 'old-closing', name: '說要簽卻沒簽', addr: '臺南市鹽水區3號', status: '將成約',
    visits: [{ date: ago(50), mood: 3, note: '' }], todos: [], trials: [] },
  // ④ 這週剛放的試用 → 不該被挑出來
  { id: 'fresh', name: '這週剛放的試用', addr: '臺南市新營區4號', status: '試用中',
    visits: [{ date: ago(3), mood: 3, note: '' }], todos: [],
    trials: [{ n: 1, start: ago(3), due: fut(11), items: [{ product: 'S-20', qty: 1, cycle: '2W' }], open: true, recovered: '', result: '' }] },
  // ⑤ 已成約：不在推進表的三種狀態內，再久沒動也不該被挑
  { id: 'won', name: '已經成約了', addr: '臺南市新營區5號', status: '已成約',
    visits: [{ date: ago(60), mood: 4, note: '' }], todos: [], trials: [],
    contractedItems: [{ product: 'S-20', qty: 1, cycle: '2W', contractDate: ago(60) }] },
  // ⑥ 20 天沒動（還沒到 21 天門檻）→ 不該被挑，驗邊界
  { id: 'edge', name: '剛好二十天', addr: '臺南市柳營區6號', status: '報價',
    visits: [{ date: ago(20), mood: 3, note: '' }], todos: [], trials: [] }
];

(async () => {
  console.log('R1 — 挑選規則：只挑推進表會算、但已經沒在動的店');
  const w = boot({ duskin_v2: JSON.stringify({ clients: JSON.parse(JSON.stringify(CLIENTS)) }) });
  await wait(400);
  stubDialogs(w);
  const ids = () => w.staleReviewList().map(r => r.id);
  const find = id => w.eval('DB.clients').find(c => c && c.id === id);
  const reasonsOf = id => (w.staleReviewList().find(r => r.id === id) || { reasons: [] }).reasons.map(x => x.kind);

  assert('三家過期的被挑出來', ['old-trial', 'old-quote', 'old-closing'].every(i => ids().includes(i)), ids().join(','));
  assert('期限內的試用不被挑', !ids().includes('fresh'));
  assert('已成約不被挑（不在推進表的三種狀態）', !ids().includes('won'));
  assert('20 天不被挑（門檻是 21 天）', !ids().includes('edge'));
  assert('剛好 21 天就會被挑', (() => {
    const c = find('edge'); c.visits = [{ date: ago(21), mood: 3, note: '' }];
    const hit = w.staleReviewList().map(r => r.id).includes('edge');
    c.visits = [{ date: ago(20), mood: 3, note: '' }];      // 還原，別污染後面的斷言
    return hit;
  })());
  assert('試用逾期排在最前面（東西還在客戶那裡）', ids()[0] === 'old-trial', ids().join(','));
  assert('理由分得出種類', reasonsOf('old-trial').includes('overdue') && reasonsOf('old-trial').includes('quiet') &&
    reasonsOf('old-quote').includes('quote'));

  console.log('R1 — 面板：每家給大按鈕');
  w.openReportModal();
  const panel = () => w.document.getElementById('rpt-stale').innerHTML;
  assert('面板列出家數與門檻', /清單健檢：\d+ 家可能已經過期/.test(panel()) && panel().includes('21 天'));
  assert('有進行中試用 → 已回收（展開四選一）', /onclick="scToggle\('old-trial'\)">已回收</.test(panel()) &&
    panel().includes("scResult('old-trial','再試用')"));
  // 沒有進行中試用的店不給「已成約」：那會做出一筆沒有成約品項的成約
  assert('沒有進行中試用 → 不給任何「成約」按鈕，帶去客戶卡', !panel().includes("scResult('old-closing'") &&
    panel().includes('開客戶卡成約'));
  assert('每家都有 還在追／拒絕', ['old-trial', 'old-quote', 'old-closing'].every(id =>
    panel().includes(`scStay('${id}')`) && panel().includes(`scRefuse('${id}')`)));
  assert('標出會被算進推進表的金額', /推進表會算 \$[\d,]+／4W/.test(panel()));
  assert('店名會轉義（XSS）', (() => {
    const c = find('old-closing'); const orig = c.name;
    c.name = '<img src=x onerror=alert(1)>';
    w.renderStaleCheck();
    const ok = panel().includes('&lt;img') && !panel().includes('<img src=x');
    c.name = orig; w.renderStaleCheck();
    return ok;
  })());

  console.log('R1 — 動作一：還在追（把到期日往後推，不是把問題蓋掉）');
  w.scStay('old-trial');
  const t1 = find('old-trial');
  assert('逾期的試用重算回收日＝今天＋14', t1.trials[0].due === fut(14), t1.trials[0].due);
  assert('試用還開著、狀態不變', t1.trials[0].open === true && t1.status === '試用中');
  assert('蓋上今天的確認日', t1.reviewedAt === TODAY);
  assert('清單上不再出現（真的變乾淨）', !ids().includes('old-trial'));
  w.scStay('old-quote');
  const q1 = find('old-quote');
  assert('逾期的報價追蹤改成一週後再問', q1.todos[0].dueDate === fut(7) && q1.todos[0].done === false);
  assert('報價那家也離開清單', !ids().includes('old-quote'));

  console.log('R1 — 動作二：已回收 → 四選一走原本的回收邏輯');
  w.scResult('old-trial', '成約');
  const t2 = find('old-trial');
  assert('試用關閉並記下結果', t2.trials[0].open === false && t2.trials[0].result === '成約' && t2.trials[0].recovered === TODAY);
  assert('品項轉成成約品項、狀態改已成約', (t2.contractedItems || []).length === 1 &&
    t2.contractedItems[0].contractDate === TODAY && t2.status === '已成約');
  assert('補一筆拜訪紀錄', t2.visits[t2.visits.length - 1].insight.includes('第 1 次試用回收：成約'));
  assert('回收後也離開清單（已不在三種狀態）', !ids().includes('old-trial'));

  console.log('R1 — 動作三：拒絕');
  const before = find('old-closing').visits.length;
  await w.scRefuse('old-closing');
  const r3 = find('old-closing');
  assert('將成約（無進行中試用）→ 狀態改拒絕', r3.status === '拒絕');
  assert('補一筆紀錄說明是健檢清掉的', r3.visits.length === before + 1 &&
    r3.visits[r3.visits.length - 1].insight === '清單健檢：拒絕');
  assert('不去動品項（沒有試用就不該憑空生成約品項）', !(r3.contractedItems || []).length);
  assert('拒絕後離開清單', !ids().includes('old-closing'));

  console.log('R1 — 清完之後推進表就乾淨了');
  w.document.getElementById('rpt-from').value = ago(6);
  w.document.getElementById('rpt-to').value = TODAY;
  w.genReport();
  const rows = w.document.getElementById('rpt-4w').value.split('\n').filter(Boolean);
  const names = rows.map(r => r.split('\t')[1]);
  assert('被拒絕的不在推進表', !names.includes('說要簽卻沒簽'), names.join(','));
  assert('按「還在追」的仍在推進表（還是真機會，不該被清掉）', names.includes('報價沒下文的早餐店'), names.join(','));
  // 既有口徑：推進表只算「未回收的試用品項」，所以剛回收成約的那一週不會出現在這張表
  assert('剛回收成約的不在推進表（既有口徑：只算未回收試用）', !names.includes('忘記回收的麵店'), names.join(','));
  assert('清完後列數提示不再顯示未確認家數',
    !/還沒做清單健檢/.test(w.document.getElementById('rpt-4w-cnt').textContent),
    w.document.getElementById('rpt-4w-cnt').textContent);
  assert('沒有過期的店時面板給綠燈', (() => {
    w.renderStaleCheck();
    return w.document.getElementById('rpt-stale').innerHTML.includes('都還在動');
  })(), w.document.getElementById('rpt-stale').innerHTML.slice(0, 120));

  console.log('R1 — 沒清就產出：列數旁邊要標出來（不偷偷刪資料）');
  const w2 = boot({ duskin_v2: JSON.stringify({ clients: JSON.parse(JSON.stringify(CLIENTS)) }) });
  await wait(400);
  stubDialogs(w2);
  w2.openReportModal();
  w2.document.getElementById('rpt-from').value = ago(6);
  w2.document.getElementById('rpt-to').value = TODAY;
  w2.genReport();
  const cnt = w2.document.getElementById('rpt-4w-cnt').textContent;
  const rows2 = w2.document.getElementById('rpt-4w').value.split('\n').filter(Boolean).map(r => r.split('\t')[1]);
  assert('過期的店還是會列進推進表（資料不被偷偷丟掉）',
    ['忘記回收的麵店', '報價沒下文的早餐店', '說要簽卻沒簽'].every(n => rows2.includes(n)), rows2.join(','));
  assert('但列數旁邊標出有幾家沒確認', /其中 3 家還沒做清單健檢/.test(cnt), cnt);

  console.log(failed ? `R1 FAILED ✗ (${failed})` : 'R1 PASSED ✅');
  process.exit(failed ? 1 : 0);
})();
