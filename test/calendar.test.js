// G1 — Google 日曆同步＋待辦依評價排序。
//   後端 syncCalendar：整份對齊（缺的補、多的刪）、重跑不重複、只動整天事件、單筆失敗不擋其他筆。
//   前端 calendarItems：待辦／回收日／下次拜訪日 → 提醒清單（標題帶評價、逾期移到今天、擱置不列）、內容沒變不打後端。
//   待辦清單：同一區塊內 P 旗標 → 評價 → 日期。
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
  console.log('G1 — 後端 syncCalendar（假的 CalendarApp）');
  const code = html.match(/const APPS_SCRIPT_CODE=`([\s\S]*?)`;/)[1];
  const store = [];   // 假日曆裡的事件
  let failTitle = '';
  const mkEv = (title, date, allDay) => ({
    getTitle: () => title, isAllDayEvent: () => allDay !== false, getAllDayStartDate: () => date,
    deleteEvent() { store.splice(store.indexOf(this), 1); }
  });
  const cal = {
    getEvents: (s, e) => store.filter(ev => ev.getAllDayStartDate() >= s && ev.getAllDayStartDate() < e),
    createAllDayEvent(title, date) { if (title === failTitle) throw new Error('quota'); store.push(mkEv(title, date)); }
  };
  let createdCal = 0;
  const CalendarApp = { getCalendarsByName: () => (createdCal ? [cal] : []), createCalendar: () => { createdCal++; return cal; }, getDefaultCalendar: () => ({ getName: () => 'x' }) };
  const Utilities = { formatDate: d => ymd(d) };
  const Session = { getScriptTimeZone: () => 'Asia/Taipei' };
  const api = new Function('CalendarApp', 'Utilities', 'Session', code + '\n;return {syncCalendar, BACKEND_VER};')(CalendarApp, Utilities, Session);
  const titles = () => store.map(e => ymd(e.getAllDayStartDate()) + '|' + e.getTitle()).sort().join(',');

  assert('後端版本 4（有日曆功能）', api.BACKEND_VER === 4);
  let r = api.syncCalendar([{ date: D(0), title: 'A' }, { date: D(3), title: 'B' }], D(0), D(60));
  assert('第一次：自動建立專用日曆、建 2 筆', createdCal === 1 && r.created === 2 && r.deleted === 0 && titles() === [D(0) + '|A', D(3) + '|B'].sort().join(','), titles());
  r = api.syncCalendar([{ date: D(0), title: 'A' }, { date: D(3), title: 'B' }], D(0), D(60));
  assert('重跑同一份：不新增不刪除（不重複）', r.created === 0 && r.deleted === 0 && store.length === 2);
  r = api.syncCalendar([{ date: D(0), title: 'A' }, { date: D(5), title: 'B' }], D(0), D(60));
  assert('B 改日期 → 舊的刪、新的建', r.created === 1 && r.deleted === 1 && titles() === [D(0) + '|A', D(5) + '|B'].sort().join(','), titles());
  const old = new Date(); old.setDate(old.getDate() - 10); old.setHours(0, 0, 0, 0);
  store.push(mkEv('上週的舊提醒', old));
  store.push(mkEv('使用者自己加的有時間事件', new Date(), false));
  r = api.syncCalendar([{ date: D(0), title: 'A' }], D(0), D(60));
  assert('過期的舊提醒清掉、有時間的事件不動', r.deleted === 2 && store.length === 2 && store.some(e => e.getTitle() === '使用者自己加的有時間事件'), titles());
  failTitle = '會失敗的';
  r = api.syncCalendar([{ date: D(0), title: 'A' }, { date: D(1), title: '會失敗的' }, { date: D(2), title: 'C' }], D(0), D(60));
  assert('單筆失敗不擋其他筆，回報 failed', r.failed === 1 && r.created === 1 && store.some(e => e.getTitle() === 'C'));
  assert('缺日期範圍 → 回錯誤不動日曆', !!api.syncCalendar([], '', '').error);

  console.log('G1 — 前端 calendarItems／待辦排序');
  const ls = {};
  const posts = [];
  const clients = [
    { id: 'a', name: '一級店', addr: '臺南市永康區1號', status: '開發中', tier: 1, need: '有', nextdate: D(2), visits: [{ date: D(-3) }], updatedAt: 1,
      todos: [{ text: '送報價單', dueDate: D(1), done: false }, { text: '做完的', dueDate: D(1), done: true }, { text: '太遠的', dueDate: D(90), done: false }] },
    { id: 'b', name: '三級店', addr: '', status: '試用', tier: 3, visits: [{ date: D(-9) }], updatedAt: 1,
      trials: [{ n: 1, start: D(-9), due: D(5), items: [], open: true, recovered: '', result: '' }],
      todos: [{ text: '回收試用品（第 1 次）', dueDate: D(5), done: false, source: 'auto-recycle', trialN: 1 }, { text: '逾期的事', dueDate: D(-4), done: false }] },
    { id: 'c', name: '擱置店', addr: '', status: '擱置', tier: 2, shelveReason: '嫌貴', nextdate: D(1), visits: [{ date: D(-30) }], todos: [], updatedAt: 1 },
    { id: 'd', name: '二級店', addr: '', status: '開發中', tier: 2, need: '未定', visits: [{ date: D(-2) }], updatedAt: 1, todos: [{ text: '回電', dueDate: D(1), done: false }] },
    { id: 'e', name: '有旗標的三級店', addr: '', status: '開發中', tier: 3, need: '有', visits: [{ date: D(-2) }], updatedAt: 1, todos: [{ text: '急件', dueDate: D(1), done: false, priority: 1 }] }
  ];
  ls.duskin_v2 = JSON.stringify({ clients, products: [], inventory: null, gtodos: [{ text: '繳停車費', dueDate: D(1), done: false }], sheetUrl: 'https://script.google.com/macros/s/x/exec' });
  ls.migration_v = '99';
  const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
  const w = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://x.github.io/salesystem/', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      Object.defineProperty(win, 'localStorage', { value: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; }, clear() {} }, configurable: true });
      win.scrollTo = () => {};
      win.fetch = async (u, o) => {
        const body = JSON.parse(o.body); posts.push(body);
        const res = body.action === 'ping' ? { ok: true, ver: win.__ver || 4 } : body.action === 'syncCalendar' ? { ok: true, created: body.events.length, deleted: 0, failed: 0 } : { ok: true };
        return { json: async () => res };
      };
    }
  }).window;
  await wait(400);
  w.eval('appAlert=(m,t)=>{window.__alert=(t||"")+m;return Promise.resolve(true)}');

  const items = w.calendarItems();
  const t = items.map(i => i.date + '|' + i.title);
  assert('待辦帶評價與店名', t.includes(D(1) + '|1級｜一級店：送報價單'), t.join(' / '));
  assert('下次拜訪日列入', t.includes(D(2) + '|1級｜一級店：拜訪'));
  assert('試用回收日列入一次（不和回收待辦重複）', t.filter(x => /三級店：回收試用品/.test(x)).length === 1 && t.includes(D(5) + '|3級｜三級店：回收試用品（第 1 次）'), t.join(' / '));
  assert('逾期的移到今天並標（逾期）', t.includes(D(0) + '|3級｜三級店：逾期的事（逾期）'));
  assert('已完成、超過 60 天、擱置的店不列', !t.some(x => /做完的|太遠的|擱置店/.test(x)));
  assert('一般待辦列入（沒有評價前綴）', t.includes(D(1) + '|繳停車費'));
  assert('同一天依評價排（1級 → 2級 → 3級 → 沒評價）', items.filter(i => i.date === D(1)).map(i => i.title[0]).join('') === '123繳', items.filter(i => i.date === D(1)).map(i => i.title).join(' / '));

  assert('沒開啟時不會打後端', !posts.some(p => p.action === 'syncCalendar'));
  w.__ver = 3;
  await w.setCalSync(true);
  assert('後端太舊 → 不開啟、提示更新後端', ls.cal_sync !== '1' && /authorizeCalendar/.test(w.__alert || ''), w.__alert);
  w.__ver = 4;
  await w.setCalSync(true);
  const sent = posts.filter(p => p.action === 'syncCalendar');
  assert('開啟 → 立刻送出整份清單與範圍', ls.cal_sync === '1' && sent.length === 1 && sent[0].events.length === items.length && sent[0].from === D(0) && sent[0].to === D(60));
  assert('設定頁顯示上次同步結果', /上次同步/.test(w.document.getElementById('cal-status').textContent) && w.document.getElementById('cal-sync-on').checked);
  await w.syncCalendar();
  assert('內容沒變 → 不再打後端', posts.filter(p => p.action === 'syncCalendar').length === 1);
  w.eval('DB.clients[3].todos[0].done=true');
  await w.syncCalendar();
  const sent2 = posts.filter(p => p.action === 'syncCalendar');
  assert('待辦完成 → 重新對齊，少一筆', sent2.length === 2 && sent2[1].events.length === items.length - 1);
  await w.setCalSync(false);
  assert('關閉 → 旗標清掉', ls.cal_sync === undefined && !w.document.getElementById('cal-sync-on').checked);

  w.navTo('todos', w.document.getElementById('nav-todos')); w.renderGT();
  const rows = [...w.document.querySelectorAll('#gt-list .todo-row')].map(r => r.textContent.replace(/\s+/g, ''));
  const soon = rows.filter(r => /送報價單|急件|繳停車費/.test(r)).map(r => (/急件/.test(r) ? 'P' : /送報價單/.test(r) ? '1' : 'G')).join('');
  assert('待辦清單同一區塊：P 旗標 → 評價 1 級 → 沒評價的一般待辦', soon === 'P1G', rows.join(' | '));
  assert('待辦列上標出評價', rows.some(r => /一級店1級/.test(r)), rows.join(' | '));

  console.log(failed ? `G1 FAILED (${failed})` : 'G1 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
