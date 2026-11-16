// B1 — 待辦看板：任務類型、排定日（plan）與期限（dueDate）分開、今天＋四個工作天、未排排序、
//   拖放（placeTask：排日期＋當天順序）、自動結算、回收 X 階梯、舊待辦換算、點卡片排程面板。
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
  const V = [{ date: D(-20) }];
  const T = (n, startAgo, dueIn) => ({ n, start: D(-startAgo), due: D(dueIn), items: [{ product: 'DOME', qty: 1, cycle: '4W', quoted: 0 }], open: true, recovered: '', result: '' });
  const clients = [
    // a：回收已過期 9 天（XX），階段被改成開發中——一樣要記 X
    { id: 'a', name: '逾期回收店', addr: '臺南市永康區中正路1號', status: '開發中', tier: 3, need: '有', visits: V, updatedAt: 1, trials: [T(1, 23, -9)], todos: [] },
    // b：回收日在 3 天後
    { id: 'b', name: '快到期店', addr: '臺南市仁德區中山路2號', status: '試用', tier: 2, visits: V, updatedAt: 1, trials: [T(1, 11, 3)], todos: [] },
    // c：舊格式的使用者待辦（日期原本是「哪天做」）：一筆排在昨天沒做、一筆排在未來
    { id: 'c', name: '一級店', addr: '臺南市東區東門路3號', status: '開發中', tier: 1, need: '有', visits: V, updatedAt: 1, trials: [],
      todos: [{ text: 'LINE 傳報價單', dueDate: D(-1), done: false }, { text: '現場丈量', dueDate: D(40), done: false }, { text: '做合約', dueDate: '', done: false, priority: 1 }] },
    // d：成約待轉交（系統任務，期限＝成約日＋10 天）
    { id: 'd', name: '成約店', addr: '臺南市新市區中華路4號', status: '成約', tier: 2, visits: V, updatedAt: 1, trials: [], todos: [],
      contractedItems: [{ product: 'DECSR', qty: 1, cycle: '2W', quoted: 0, contractDate: D(-2) }] }
  ];
  const ls = { duskin_v2: JSON.stringify({ clients, products: [], inventory: null, gtodos: [{ text: '補庫存', dueDate: '', done: false }] }), migration_v: '99' };
  const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
  const w = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://x.github.io/salesystem/', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(win) {
      Object.defineProperty(win, 'localStorage', { value: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; }, clear() {} }, configurable: true });
      win.scrollTo = () => {}; win.fetch = async () => { throw new Error('offline'); };
    }
  }).window;
  await wait(400);
  const doc = w.document, DB = w.eval('DB');
  const by = id => DB.clients.find(c => c.id === id);
  const boardTasksOpen = () => w.boardTasks().filter(x => !x.t.done && x.c);
  const key = (id, text) => { const ci = DB.clients.findIndex(c => c.id === id); return 'c:' + ci + ':' + by(id).todos.findIndex(t => t.text === text); };
  const todo = (id, text) => by(id).todos.find(t => t.text === text);
  const shops = sel => [...doc.querySelectorAll(sel + ' .bd-card')].map(c => c.querySelector('.bd-shop').textContent + '/' + c.querySelector('.bd-ttl').textContent);

  console.log('B1 — 今天＋四個工作天');
  const days = w.boardDays(D(0));
  assert('五格、今天在最左、後面四天都不是六日', days.length === 5 && days[0] === D(0) && days.slice(1).every(d => { const g = new Date(d + 'T00:00:00').getDay(); return g !== 0 && g !== 6; }), days.join(','));
  assert('週五開始 → 接著是下週一到週四', w.boardDays('2026-11-20').join(',') === '2026-11-20,2026-11-23,2026-11-24,2026-11-25,2026-11-26');
  assert('日期軌畫出五格，今天那格寫「今天」', doc.querySelectorAll('#bd-rail .bd-day[data-drop]:not(.bd-extra)').length === 5 && doc.querySelector('#bd-rail .bd-day.today .wd').textContent === '今天');

  console.log('B1 — 舊待辦換算、類型、系統任務');
  assert('使用者訂的日期搬到排定日；期限留空', todo('c', '現場丈量').plan === D(40) && !todo('c', '現場丈量').dueDate);
  assert('依文字猜類型：丈量＝到場、LINE＝線上、做合約＝雜事', todo('c', '現場丈量').type === 'visit' && todo('c', 'LINE 傳報價單').type === 'online' && todo('c', '做合約').type === 'misc');
  const rb = by('b').todos.find(t => t.source === 'auto-recycle');
  assert('試用一開始就有回收任務（不用等 7 天）：到場、期限＝回收日、未排', rb && rb.type === 'visit' && rb.dueDate === D(3) && !rb.plan, JSON.stringify(rb));
  assert('階段不是試用但試用品沒收回的店也有回收任務', by('a').todos.some(t => t.source === 'auto-recycle'));
  const ho = by('d').todos.find(t => t.source === 'handoff');
  assert('轉交任務：到場、期限＝成約日＋10 天', ho && ho.type === 'visit' && ho.dueDate === D(8));

  console.log('B1 — 自動結算');
  assert('排在昨天沒做完的 → 回到未排、記順延 1 次', !todo('c', 'LINE 傳報價單').plan && todo('c', 'LINE 傳報價單').bumped === 1);
  assert('排在未來的不動', todo('c', '現場丈量').plan === D(40));
  assert('再跑一次不會重複順延', w.settleTodos() === 0 && todo('c', 'LINE 傳報價單').bumped === 1);

  console.log('B1 — 未排的排序');
  const tray = shops('.bd-tray');
  assert('回收排最前：X 等級高的先（逾期回收店 XX），再來是快到期的', tray[0].startsWith('逾期回收店/回收') && tray[1].startsWith('快到期店/回收'), tray.join(' | '));
  assert('接著是有期限的（轉交），最後才是沒期限的', tray.indexOf('成約店/轉交（成約後 10 天內）') > 1 && tray.findIndex(x => x.includes('安排報價')) > 1 && tray.indexOf('成約店/轉交（成約後 10 天內）') < tray.indexOf('一級店/做合約'), tray.join(' | '));
  assert('沒期限的裡面：有 P 旗標的在沒旗標的前面', tray.indexOf('一級店/做合約') < tray.indexOf('一級店/LINE 傳報價單') && tray.indexOf('一級店/LINE 傳報價單') < tray.indexOf('一般/補庫存'), tray.join(' | '));
  assert('排在五天以外的收在「已排在其他日期」', /已排在其他日期/.test(doc.querySelector('.bd-more summary').textContent) && shops('.bd-more').includes('一級店/現場丈量'));
  assert('排序依據寫在系統裡、畫面上叫得出來', w.eval('TRAY_SORT_RULES').length === 4 && !!doc.querySelector('.bd-tray .bd-link'));
  w.eval("BD.filter='online'"); w.renderGT();
  assert('篩選「線上」只剩線上任務', shops('.bd-tray').join() === '一級店/LINE 傳報價單');
  w.eval("BD.filter='all'"); w.renderGT();

  console.log('B1 — 回收 X 階梯');
  const cardA = [...doc.querySelectorAll('.bd-tray .bd-card')].find(c => /逾期回收店/.test(c.textContent));
  assert('過期 9 天＝XX：階梯亮兩格、第四格是禁區', cardA.querySelectorAll('.bd-xl i.on').length === 2 && cardA.querySelectorAll('.bd-xl i.ban').length === 1 && /再 5 天變 XXX/.test(cardA.textContent), cardA.textContent);
  assert('還沒到回收日：寫再幾天記 X', /回收日 .*再 3 天記 X/.test([...doc.querySelectorAll('.bd-tray .bd-card')].find(c => /快到期店/.test(c.textContent)).textContent));
  assert('等級算法：到回收日 X、+7 天 XX、+21 天 XXXX', w.xLevelOn('2026-06-15', '2026-06-14') === 0 && w.xLevelOn('2026-06-15', '2026-06-15') === 1 && w.xLevelOn('2026-06-15', '2026-06-22') === 2 && w.xLevelOn('2026-06-15', '2026-07-06') === 4);

  console.log('B1 — 排日期與當天順序（拖放落地後做的事）');
  const d1 = days[1];
  w.placeTask(key('b', rb.text), d1, null);
  w.placeTask(key('d', ho.text), d1, null);
  w.placeTask(key('a', by('a').todos.find(t => t.source === 'auto-recycle').text), d1, 0);   // 插到第一位
  w.eval("BD.sel='" + d1 + "'"); w.renderGT();
  let col = shops('.bd-col.sel');
  assert('三張都排到那天，插到第 0 位的在最上面', col.length === 3 && col[0].startsWith('逾期回收店') && col[1].startsWith('快到期店') && col[2].startsWith('成約店'), col.join(' | '));
  assert('到場任務有順序編號 1、2、3', [...doc.querySelectorAll('.bd-col.sel .bd-ord')].map(e => e.textContent).join('') === '123');
  assert('回收的期限沒有因為改排而變', rb.dueDate === D(3) && rb.plan === d1);
  assert('日期軌那格顯示件數與 X 回收', /3 件/.test(doc.querySelector('.bd-day.sel').textContent) && /X 回收/.test(doc.querySelector('.bd-day.sel').textContent), doc.querySelector('.bd-day.sel').textContent);
  assert('主角區：還有 3 件、要到場 3 家', /3\s*件還沒做/.test(doc.querySelector('.bd-slab').textContent) && /要到場\s*3\s*家/.test(doc.querySelector('.bd-slab').textContent), doc.querySelector('.bd-slab').textContent);
  doc.querySelector('.bd-col.sel .bd-ck').click();
  await wait(20);
  assert('勾完成：留在當天清單但排到最下面、劃掉', doc.querySelectorAll('.bd-col.sel .bd-card.done').length === 1 && shops('.bd-col.sel')[2].startsWith('逾期回收店'));
  w.placeTask(key('b', rb.text), '', null);
  assert('放回未排', !rb.plan && shops('.bd-tray').some(x => x.startsWith('快到期店')));

  console.log('B1 — 點卡片的排程面板');
  w.openBdSheet(key('c', '做合約'));
  const sheet = doc.getElementById('bd-sheet');
  assert('面板列出五天、其他日期、放回未排、編輯、開啟客戶', sheet.querySelectorAll('.bd-pick button').length === 5 && !!sheet.querySelector('#bd-other') && ['放回未排', '編輯', '開啟客戶'].every(t => sheet.textContent.includes(t)));
  sheet.querySelectorAll('.bd-pick button')[2].click();
  assert('點第三天 → 排到那天、面板關閉', todo('c', '做合約').plan === days[2] && !doc.getElementById('bd-sheet'));

  console.log('B1 — 回收任務直接在看板按「已回收」');
  const rcard = [...doc.querySelectorAll('.bd-card')].find(e => e.dataset.k === key('b', rb.text));
  assert('回收卡片寫出試用品', !!rcard && /×/.test((rcard.querySelector('.bd-items') || {}).textContent || ''), rcard && rcard.textContent);
  assert('一般任務沒有試用品那一行', ![...doc.querySelectorAll('.bd-card')].find(e => e.dataset.k === key('c', '做合約')).querySelector('.bd-items'));
  w.openBdSheet(key('b', rb.text));
  const rbtn = doc.querySelector('#bd-sheet [data-act="recover"]');
  assert('回收任務的面板有「已回收」鈕；一般任務沒有', !!rbtn && (w.openBdSheet(key('c', '做合約')), !doc.querySelector('#bd-sheet [data-act="recover"]')));
  doc.getElementById('bd-sheet').remove();
  w.openBdSheet(key('b', rb.text)); doc.querySelector('#bd-sheet [data-act="recover"]').click();
  assert('跳出回收視窗，標題帶店名', doc.getElementById('trial-recover-modal').classList.contains('on') && /快到期店・第 1 次試用回收/.test(doc.getElementById('tr-title').textContent), doc.getElementById('tr-title').textContent);
  const stBefore = by('b').status;
  w.finishRecover('');
  assert('只記已回收：試用關閉、回收任務完成、階段不動', !by('b').trials[0].open && by('b').trials[0].recovered === D(0) && rb.done && by('b').status === stBefore, JSON.stringify(by('b').trials[0]));
  assert('留在看板（不跳到客戶頁），未排裡不再有這張', doc.getElementById('panel-todos').classList.contains('on') && !shops('.bd-tray').some(x => x.startsWith('快到期店/回收')));
  assert('不再記 X', w.trialXInfo(by('b')) === null);

  console.log('B1 — 當日時間軸：時段與指定時間');
  {
    const td = w.today(), ci = DB.clients.findIndex(c => c.id === 'c');
    by('c').todos.push({ text: '軸甲', done: false, type: 'visit', plan: '', dueDate: '' }, { text: '軸乙', done: false, type: 'online', plan: '', dueDate: '' }, { text: '軸丙', done: false, type: 'misc', plan: '', dueDate: '' });
    const k = n => 'c:' + ci + ':' + by('c').todos.findIndex(t => t.text === n), T = n => todo('c', n);
    const seq = () => w.boardTasks().filter(x => x.t.plan === td && !x.t.done && /^軸/.test(x.t.text)).sort((a, b) => a.t.order - b.t.order).map(x => x.t.text + ':' + w.todoSlot(x.t)).join(' ');
    w.placeTask(k('軸甲'), td, null); w.placeTask(k('軸乙'), td, null); w.placeTask(k('軸丙'), td, null);
    assert('新排進來的任務預設在上午', seq() === '軸甲:am 軸乙:am 軸丙:am', seq());
    const tl = doc.querySelector('.bd-col.sel .bd-tl');
    assert('時間軸有四條線、三段清單、午休區間；線上只有時間沒有字', tl.querySelectorAll('.bd-mark').length === 4 && tl.querySelectorAll('[data-slot]').length === 3 && !!tl.querySelector('.bd-noon [data-slot="noon"]') && [...tl.querySelectorAll('.bd-mark')].map(m => m.textContent).join(',') === '08:30,12:00,13:00,17:30');
    w.placeTask(k('軸乙'), td, 0, 'noon');
    assert('拖進午休', T('軸乙').slot === 'noon' && seq() === '軸甲:am 軸丙:am 軸乙:noon', seq());
    w.setTaskTime(k('軸甲'), '14:00');
    assert('指定 14:00 → 移到下午並釘住', T('軸甲').time === '14:00' && seq() === '軸丙:am 軸乙:noon 軸甲:pm', seq());
    const card = doc.querySelector('.bd-card[data-k="' + k('軸甲') + '"]');
    assert('釘住的卡片沒有拖曳把手，改成時鐘鈕，左邊顯示時間', card.classList.contains('timed') && !card.querySelector('.bd-grip') && !!card.querySelector('.bd-pin') && card.querySelector('.bd-tick').textContent === '14:00');
    w.setTaskTime(k('軸丙'), '13:30');
    assert('有時間的任務之間照時間先後', seq() === '軸乙:noon 軸丙:pm 軸甲:pm', seq());
    w.placeTask(k('軸乙'), td, 2, 'pm');
    assert('沒指定時間的可以排在它們後面', seq() === '軸丙:pm 軸甲:pm 軸乙:pm', seq());
    w.setTaskTime(k('軸甲'), '07:00');
    assert('上班時間外的時間不收', T('軸甲').time === '14:00');
    w.openBdSheet(k('軸甲'));
    assert('面板可改時間與取消指定', doc.querySelector('#bd-time').value === '14:00' && !!doc.querySelector('#bd-sheet [data-act="untime"]'));
    doc.querySelector('#bd-sheet [data-act="untime"]').click();
    assert('取消指定 → 留在原段、恢復可拖', !T('軸甲').time && w.todoSlot(T('軸甲')) === 'pm' && !!doc.querySelector('.bd-card[data-k="' + k('軸甲') + '"] .bd-grip'));
    w.placeTask(k('軸丙'), '', null);
    assert('放回未排 → 指定時間清掉', !T('軸丙').time && !T('軸丙').plan);
    ['軸甲', '軸乙', '軸丙'].forEach(n => { by('c').todos.splice(by('c').todos.findIndex(t => t.text === n), 1); }); w.renderGT();
  }

  console.log('B1 — 看板直接刪除');
  {
    const src = (id, source) => by(id).todos.find(t => t.source === source && !t.done);
    const kOf = (id, t) => 'c:' + DB.clients.findIndex(c => c.id === id) + ':' + by(id).todos.indexOf(t);
    const sys = boardTasksOpen().find(x => x.t.source === 'auto-recycle' || x.t.source === 'auto-quote');
    assert('還有系統任務可測', !!sys);
    w.openBdSheet(sys.k); doc.querySelector('#bd-sheet [data-act="del"]').click();
    w.renderGT();
    assert('刪除系統任務：收進已完成、重畫後不會補一張新的', sys.t.done && sys.c.todos.filter(t => t.source === sys.t.source && (t.trialN || 1) === (sys.t.trialN || 1)).length === 1 && !doc.querySelector('.bd-card[data-k="' + sys.k + '"]:not(.done)'));
    const ho = src('d', 'handoff');
    if (ho) { w.delGT('c', DB.clients.findIndex(c => c.id === 'd'), by('d').todos.indexOf(ho)); assert('轉交不能刪', !ho.done && by('d').todos.includes(ho)); }
    const n0 = by('c').todos.length, mine = by('c').todos.find(t => !t.source && !t.done);
    w.openBdSheet(kOf('c', mine)); doc.querySelector('#bd-sheet [data-act="del"]').click();
    assert('自己的任務直接移除', by('c').todos.length === n0 - 1 && !by('c').todos.includes(mine));
    doc.querySelector('#undo-toast button').click();
    assert('可以復原', by('c').todos.length === n0);
  }

  console.log('B1 — 新增與編輯');
  doc.getElementById('qa-inp').value = '打電話追結果 #成約店'; w.qaSubmit();
  const nt = todo('d', '打電話追結果');
  assert('快速新增沒寫日期 → 進未排、自動分類線上', nt && !nt.plan && nt.type === 'online', JSON.stringify(nt));
  w.gtEdit('c', DB.clients.findIndex(c => c.id === 'd'), by('d').todos.indexOf(nt));
  w.tmSetType('visit'); doc.getElementById('tm-due').value = days[3]; doc.getElementById('tm-deadline').value = days[4]; w.saveTodoModal();
  assert('編輯視窗可改類型、排定日、期限', nt.type === 'visit' && nt.plan === days[3] && nt.dueDate === days[4]);
  assert('資料有存下來', JSON.parse(ls.duskin_v2).clients.find(c => c.id === 'd').todos.some(t => t.text === '打電話追結果' && t.plan === days[3]));

  console.log(failed ? `B1 FAILED (${failed})` : 'B1 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
