// Z2 — 行程規劃（trip planner）與工業區CRM 交接信箱（handoff）
//   行程＝nextdate 機制：今天/逾期/未來分組、逾期批次移到今天
//   順路走廊：同區、途中、再過去一站
//   handoff：主系統啟動消化 duskin_iz_handoff → 正規建檔（冪等）
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
  dom.window._store = store;
  return dom.window;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
function assert(name, cond, extra) { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : ''))); if (!cond) failed++; }
const D = (off) => { const d = new Date(Date.now() + off * 86400000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

(async () => {
  console.log('Z2 — 順路走廊 tripOnTheWay');
  let w = boot({ duskin_v2: JSON.stringify({ clients: [], products: [], inventory: null }) });
  await wait(400);
  let m = w.eval('tripOnTheWay(new Set(["官田區"]))');
  assert('新市在往官田途中', m.get('新市區') === '往官田區途中');
  assert('善化在往官田途中', m.get('善化區') === '往官田區途中');
  assert('六甲是官田再過去一站', m.get('六甲區') === '官田區再過去一站');
  assert('關廟線不受影響', !m.has('歸仁區'));
  assert('已在行程的區不列入', !m.has('官田區'));

  console.log('Z2 — 行程分組與逾期處理');
  const td = D(0);
  w = boot({ duskin_v2: JSON.stringify({ clients: [
    { id: 'a', name: '今天A', addr: '臺南市官田區工業路1號', status: '複訪', nextdate: td, todos: [], visits: [{date:'2026-01-01',mood:3,note:''}], updatedAt: 1 },
    { id: 'b', name: '逾期B', addr: '臺南市永康區中正路2號', status: '複訪', nextdate: D(-5), todos: [], visits: [{date:'2026-01-01',mood:3,note:''}], updatedAt: 1 },
    { id: 'c', name: '未來C', addr: '臺南市仁德區中山路3號', status: '複訪', nextdate: D(3), todos: [], visits: [{date:'2026-01-01',mood:3,note:''}], updatedAt: 1 },
    { id: 'd', name: '建議D未拜訪', addr: '臺南市善化區成功路4號', status: '', nextdate: '', todos: [], visits: [], updatedAt: 1 },
    { id: 'e', name: '建議E待辦', addr: '臺南市官田區文化路5號', status: '複訪', nextdate: '', todos: [{ text: '送報價單', dueDate: '', done: false }], visits: [{date:'2026-01-01',mood:3,note:''}], updatedAt: 1 },
    { id: 'f', name: '建議F成交', addr: '臺南市六甲區珊瑚路6號', status: '已成約', nextdate: '', todos: [], contractedItems: [{ product: 'S-20', qty: 1, cycle: '2W' }], visits: [{date:'2026-01-01',mood:3,note:''}], updatedAt: 1 },
    { id: 'g', name: '不建議G複訪', addr: '臺南市官田區八田路7號', status: '複訪', nextdate: '', todos: [], visits: [{date:'2026-01-01',mood:3,note:''}], updatedAt: 1 }
  ], products: [], inventory: null }) });
  await wait(400);
  w.appConfirm = async () => true;
  w.renderTrip();
  const out = w.document.getElementById('trip-out').innerHTML;
  assert('今天分組含今天A', /今天A/.test(out) && /📅 今天（1 家）/.test(out));
  assert('逾期收合區含逾期B', /逾期（1 家）/.test(out) && /逾期B/.test(out));
  assert('逾期在 details 裡（不蓋住今天）', /<details[^>]*>[\s\S]*逾期B/.test(out));
  assert('未來 7 天含未來C', /未來C/.test(out));
  assert('順路建議：同區待辦E', /建議E待辦/.test(out) && /📌/.test(out));
  assert('順路建議：途中的善化未拜訪D', /建議D未拜訪/.test(out) && /往官田區途中/.test(out));
  assert('順路建議：再過去一站的六甲成交F', /建議F成交/.test(out) && /官田區再過去一站/.test(out));
  assert('一般複訪G不在建議中', !/不建議G複訪/.test(out));

  const captured = [];
  w.fetch = async (u, o) => { captured.push(JSON.parse(o.body)); return { json: async () => ({ ok: true }) }; };
  w.eval('SHEET_URL="https://script.google.com/x/exec"');
  w.tripMoveAllToday();
  assert('全部移到今天：B 的 nextdate 變今天', w.eval('DB.clients.find(c=>c.id==="b").nextdate') === td);
  assert('移動有觸發雲端保存', captured.some(b => b.action === 'save' && b.client && b.client.id === 'b'));
  w.tripSetDate(0, '');
  assert('移出行程：A 的 nextdate 清空', w.eval('DB.clients.find(c=>c.id==="a").nextdate') === '');

  console.log('Z2 — 沒行程也能選區＋收合狀態保留');
  w = boot({ duskin_v2: JSON.stringify({ clients: [
    { id: 'p1', name: '官田未拜訪', addr: '臺南市官田區工業路1號', status: '', nextdate: '', todos: [], visits: [], updatedAt: 1 },
    { id: 'p2', name: '善化未拜訪', addr: '臺南市善化區成功路2號', status: '', nextdate: '', todos: [], visits: [], updatedAt: 1 },
    { id: 'p3', name: '逾期一', addr: '臺南市永康區中正路3號', status: '複訪', nextdate: D(-3), todos: [], visits: [{ date: '2026-01-01', mood: 3, note: '' }], updatedAt: 1 },
    { id: 'p4', name: '逾期二', addr: '臺南市永康區中正路4號', status: '複訪', nextdate: D(-2), todos: [], visits: [{ date: '2026-01-01', mood: 3, note: '' }], updatedAt: 1 }
  ], products: [], inventory: null }) });
  await wait(400);
  w.renderTrip();
  let t = w.document.getElementById('trip-out').innerHTML;
  assert('沒行程也顯示選區列', /今天想跑哪一區/.test(t) && /官田區/.test(t));
  assert('未選區時顯示提示', /點上方選一區/.test(t));
  w.tripPickDist('官田區');
  t = w.document.getElementById('trip-out').innerHTML;
  assert('選區後同區建議出現', /官田未拜訪/.test(t));
  assert('走廊建議一併出現（往官田途中的善化）', /善化未拜訪/.test(t) && /往官田區途中/.test(t));
  w.eval('TRIP_OPEN.overdue=true');
  w.tripSetDate(2, '');   // 清除「逾期一」→ 觸發整頁重渲染
  t = w.document.getElementById('trip-out').innerHTML;
  assert('清除一筆後逾期區仍保持展開', /<details open/.test(t) && /逾期二/.test(t));

  console.log('Z2 — 工業區CRM 交接信箱（handoff 消化）');
  w = boot({
    duskin_v2: JSON.stringify({ clients: [{ id: 'exist1', name: '既有客戶', addr: '', status: '複訪', todos: [], visits: [{date:'2026-01-01',mood:3,note:''}], updatedAt: 1 }], products: [], inventory: null, sheetUrl: 'https://script.google.com/x/exec' }),
    duskin_iz_handoff: JSON.stringify([
      { id: 'iz-new-1', izId: 'fac1', name: '新工廠甲', addr: '臺南市官田區工業路9號', phone: '06-1234567', contact: '王窗口', note: '（由工業區CRM 建檔）　業種：金屬', at: 1 },
      { id: 'exist1', izId: 'fac2', name: '重複的不該建', addr: '', phone: '', contact: '', note: '', at: 1 }
    ])
  });
  await wait(400);
  assert('新工廠建檔成功', w.eval('DB.clients.some(c=>c.id==="iz-new-1"&&c.name==="新工廠甲")'));
  assert('帶入電話與窗口', w.eval('DB.clients.find(c=>c.id==="iz-new-1").phone') === '06-1234567' && w.eval('DB.clients.find(c=>c.id==="iz-new-1").contact') === '王窗口');
  assert('型態=工廠、狀態=未拜訪', w.eval('DB.clients.find(c=>c.id==="iz-new-1").type') === '工廠' && w.eval('DB.clients.find(c=>c.id==="iz-new-1").status') === '未拜訪');
  assert('同 id 冪等：既有客戶未被覆蓋', w.eval('DB.clients.filter(c=>c.id==="exist1").length') === 1 && w.eval('DB.clients.find(c=>c.id==="exist1").name') === '既有客戶');
  assert('信箱消化後清空', w._store.duskin_iz_handoff === undefined);
  assert('建檔進入待推送佇列（斷網不丟）', w.eval('OUTBOX.some(op=>op.payload&&op.payload.client&&op.payload.client.id==="iz-new-1")'));

  console.log(failed ? `Z2 FAILED (${failed})` : 'Z2 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
