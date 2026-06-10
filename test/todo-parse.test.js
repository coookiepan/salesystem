// T1 待辦快速輸入：自然語言解析（parseQuickTodo / stripTokens / dueLabel）
// 以 JSDOM 載入完整 App 後直接呼叫純函式驗證。base 參數固定「今天」確保測試可重現。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function boot() {
  const store = {};
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

(async () => {
  console.log('T1 — 待辦自然語言解析');
  const w = boot(); await wait(400);

  // 基準日：2026-06-10（週三）
  const BASE = '2026-06-10';
  const p = (s) => w.parseQuickTodo(s, BASE);

  assert('「今天」→ 當天', p('今天回電').dueDate === '2026-06-10');
  assert('「明天」→ +1', p('明天回收試用品').dueDate === '2026-06-11');
  assert('「後天」→ +2', p('後天送貨').dueDate === '2026-06-12');
  assert('「大後天」→ +3（不被「後天」搶先）', p('大後天送貨').dueDate === '2026-06-13');
  assert('「3天後」→ +3', p('3天後追蹤').dueDate === '2026-06-13');
  assert('「2週後」→ +14', p('2週後簽約').dueDate === '2026-06-24');
  assert('「週五」→ 本週五（基準日為週三）', p('週五拜訪').dueDate === '2026-06-12');
  assert('「週三」當天同曜日 → 下週三', p('週三拜訪').dueDate === '2026-06-17');
  assert('「下週一」→ 下週的週一', p('下週一開會').dueDate === '2026-06-15');
  assert('「下週日」→ 下週的週日', p('下週日盤點').dueDate === '2026-06-21');
  assert('「禮拜六」→ 本週六', p('禮拜六結帳').dueDate === '2026-06-13');
  assert('「6/20」→ 今年 6/20', p('6/20 簽約').dueDate === '2026-06-20');
  assert('「6月20日」→ 同上', p('6月20日簽約').dueDate === '2026-06-20');
  assert('「1/5」已過 → 明年', p('1/5 拜年').dueDate === '2027-01-05');
  assert('「15號」→ 本月 15', p('15號收款').dueDate === '2026-06-15');
  assert('「5號」已過 → 下個月 5 號', p('5號收款').dueDate === '2026-07-05');
  assert('無日期字眼 → 不設日期', p('回收拖把').dueDate === '');

  assert('「p1」→ 優先級 1', p('回電 p1').priority === 1);
  assert('「P3」→ 優先級 3（大小寫不拘）', p('回電 P3').priority === 3);
  assert('型號內的 p2 不誤判（S-p2x）', p('補貨 S-p2x').priority === 0);

  // stripTokens：剝除已套用 token、收斂空白
  const r1 = p('明天 回收試用品 p1');
  assert('剝除「明天」「p1」後剩正文', w.stripTokens('明天 回收試用品 p1', r1.tokens) === '回收試用品');
  const r2 = p('6/20 簽約');
  assert('剝除「6/20」後剩「簽約」', w.stripTokens('6/20 簽約', r2.tokens) === '簽約');

  // dueLabel 人話標籤（相對今天，僅驗證格式不驗證相對值）
  assert('dueLabel 今天', w.dueLabel(w.today()) === '今天');
  assert('dueLabel 空值回空字串', w.dueLabel('') === '');

  // 快速新增整合：#客戶 唯一比對 → 掛到該客戶；無 # → 一般待辦(gtodos)
  w.eval('DB.clients=[{id:"c1",name:"王記餐廳",todos:[],updatedAt:1}];DB.gtodos=[];SHEET_URL="";');
  w.document.getElementById('qa-inp').value = '明天回收 #王記 p1';
  w.qaOnInput(); w.qaSubmit();
  const c1 = JSON.parse(w.eval('JSON.stringify(DB.clients[0].todos)'));
  assert('#王記 唯一比對 → 掛到王記餐廳', c1.length === 1, JSON.stringify(c1));
  assert('待辦文字已剝除 token', c1.length === 1 && c1[0].text === '回收');
  assert('優先級寫入', c1.length === 1 && c1[0].priority === 1);
  assert('日期寫入', c1.length === 1 && !!c1[0].dueDate);
  w.document.getElementById('qa-inp').value = '買咖啡濾紙';
  w.qaOnInput(); w.qaSubmit();
  const g = JSON.parse(w.eval('JSON.stringify(DB.gtodos)'));
  assert('無 # → 進一般待辦', g.length === 1 && g[0].text === '買咖啡濾紙');

  console.log(failed ? `T1 FAILED (${failed})` : 'T1 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('THROWN', e); process.exit(1); });
