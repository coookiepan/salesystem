// R2 — 公司新規解約明細比對（SERVE別新規解約明細）＋成約品項終止日＋週報既增／既減／解約列＋上半部數字。
//   用真的 SheetJS 寫出再讀回一份自編的假報表。測試資料全是虛構的——真實的公司報表含客戶資料，不進 repo。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.join(__dirname, '..');
const XLSX = require(path.join(root, 'vendor', 'xlsx.mini.min.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
const assert = (name, cond, extra) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : ''))); if (!cond) failed++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

// 公司報表欄位（A=0）：A 區分、B 建檔日期、C 解約日期、D 經過年月、F 顧客編號、G 顧客名稱、H 市場、I 交易、J 4週換算營業額（欄名尾巴有空白）、Q 異動日期
const row = cells => { const r = new Array(17).fill(''); Object.keys(cells).forEach(k => { r[XLSX.utils.decode_col(k)] = cells[k]; }); return r; };
const ent = (kind, date, custNo, name, amt, end) => row({ A: kind, B: date, C: end || '', D: 0, F: custNo, G: name, H: '業務市場ㄧ', I: '現金', J: amt });
const aoa = [
  row({ A: '日期：2026/11/01~2026/11/20', E: 'SERVE別新規解約明細', K: '製作日期：2026/11/20 17:43:00' }),
  row({ A: '統計區分：換算為4週營業額後再統計 ', K: '1.Page' }),
  row({}),
  row({ A: '含同家族變更統計：是', K: '變更以增減合計統計：否' }),
  row({ A: '區分', B: '建檔日期', C: '解約日期', D: '經過年月', F: '顧客編號', G: '顧客名稱', H: '市場', I: '交易', J: '4週換算營業額 ', L: '若已解約累計至解約前之營業額', M: '業種別大', Q: '異動日期' }),
  row({ A: '005 測試所_0001 測試員' }),
  ent('同一商品既減', '2026/11/05', '2000001', '甲甲食堂', -280),
  ent('既增', '2026/11/19', '2000002', '乙乙診所(預付款)', 335),
  ent('新成約', '2026/11/04', '2000003', '丙丙兒科', 760),
  ent('解約', '2026/11/10', '2000004', '丁丁商行', -630, '2026/11/10'),
  ent('新成約', '2026/11/06', '2000005', '完全陌生的新店', 500),
  ent('新成約', '2026/11/07', '2000006', '己己早餐', 400),
  row({ I: '新契合計', J: 1660 }), row({ I: '變更合計', J: 55 }), row({ I: '解約合計', J: -630 }), row({ I: '淨增', J: 1085 }),
  row({ H: '總合計', I: '新契合計', J: 1660 }), row({ I: '變更合計', J: 55 }), row({ I: '解約合計', J: -630 }), row({ I: '淨增', J: 1085 })
];

(async () => {
  const wbOut = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wbOut, XLSX.utils.aoa_to_sheet(aoa), '0001 測試員');
  const rows = XLSX.utils.sheet_to_json(XLSX.read(XLSX.write(wbOut, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' }).Sheets['0001 測試員'], { header: 1, raw: true, defval: '' });

  const ls = {};
  const K = (product, quoted, contractDate, extra) => Object.assign({ product, qty: 1, cycle: '4W', quoted, contractDate }, extra || {});
  const base = (id, name, extra) => Object.assign({ id, name, phone: '', addr: '', status: '成約', tier: 2, handoff: 'done', todos: [], visits: [{ date: '2026-06-01' }], trials: [], updatedAt: 1 }, extra);
  const clients = [
    base('a', '甲甲食堂', { contractedItems: [K('DOME', 220, '2026-04-28'), K('FFSK', 280, '2026-06-15')] }),          // 既減 280：剛好等於一個品項
    base('b', '乙乙診所', { contractedItems: [K('BSH', 340, '2026-09-16')] }),                                          // 既增 335：你沒記
    base('c', '丙丙兒科', { custNo: '2000003', contractedItems: [K('DOME', 220, '2026-11-04'), K('GSH', 760, '2026-11-04')] }), // 新成約：你記 980、公司 760
    base('d', '丁丁商行', { contractedItems: [K('DECSR', 630, '2026-08-01'), K('BT1', 0, '2026-08-01', { bundledTo: 'DECSR', bundleRole: 'acc', cycle: '' })] }), // 解約
    base('f', '己己早餐', { contractedItems: [K('DOME', 400, '2026-11-07')] }),                                          // 完全一致
    base('g', '只有我記的店', { contractedItems: [K('DOME', 220, '2026-11-12')] })                                       // 公司表沒有
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
  const SHELVED = w.eval('STATUS.SHELVED'), DEAL = w.eval('STATUS.DEAL');

  console.log('R2 — 解析');
  const data = w.parseDealRows(rows);
  assert('期間', data.from === '2026-11-01' && data.to === '2026-11-20', data.from + '~' + data.to);
  assert('6 筆異動（業務員標題列與合計列不算）', data.entries.length === 6, String(data.entries.length));
  assert('區分歸成四類、金額帶正負', data.entries.map(e => e.kind + e.amt).join(',') === 'dec-280,inc335,new760,cancel-630,new500,new400', data.entries.map(e => e.kind + e.amt).join(','));
  assert('表尾合計以總合計為準', data.totals.new === 1660 && data.totals.change === 55 && data.totals.cancel === -630 && data.totals.net === 1085, JSON.stringify(data.totals));
  let threw = '';
  try { w.parseDealRows([['隨便一張表'], ['a', 'b']]); } catch (e) { threw = e.message; }
  assert('不是這種報表 → 明確報錯', /找不到/.test(threw), threw);

  console.log('R2 — 落差');
  data.at = Date.now(); ls.duskin_deal = JSON.stringify(data);
  let r = w.dealDiff(data);
  const kinds = () => r.issues.map(i => i.kind + ':' + (i.c ? i.c.id : i.g.custNo)).sort().join(',');
  assert('五種落差各歸各位；己己完全一致', kinds() === 'adddiff:c,extraadd:g,noadd:b,noend:a,noend:d,nomatch:2000005' && r.okShops === 1, kinds() + ' ok=' + r.okShops);
  w.openServeModal();
  const htmlList = w.document.getElementById('deal-list').innerHTML;
  assert('既減：金額剛好等於一個品項 → 先勾好那一個', /id="deal-ck-2000001-1" checked/.test(htmlList) && !/id="deal-ck-2000001-0" checked/.test(htmlList));
  assert('摘要顯示公司四個合計', /新契.*1,660.*淨增.*1,085/.test(w.document.getElementById('deal-summary').textContent));

  console.log('R2 — 照公司的：既減只終止勾選的品項');
  w.dealEnd('2000001', false); await wait(20);
  const a = by('a');
  assert('FFSK 填上終止日＝公司日期，DOME 不動，仍是成約', a.contractedItems[1].endDate === '2026-11-05' && !a.contractedItems[0].endDate && a.status === DEAL && a.custNo === '2000001');
  assert('現在的成約金額只算還在租的', w.calcFW4(a) === 220 && w.liveContracted(a).length === 1);

  console.log('R2 — 照公司的：解約全部終止並轉擱置');
  w.dealEnd('2000004', true); await wait(20);
  const d = by('d');
  assert('主商品與配件都終止、轉擱置、理由解約、擱置日＝解約日', d.contractedItems.every(it => it.endDate === '2026-11-10') && d.status === SHELVED && d.shelveReason === '解約' && d.shelvedAt === '2026-11-10');
  r = w.dealDiff(w.dealData());
  assert('處理完的兩家不再列為落差', !r.issues.some(i => i.c && (i.c.id === 'a' || i.c.id === 'd')), kinds());

  console.log('R2 — 表單：手動終止／復原');
  w.eval("S.cfContracted=JSON.parse(JSON.stringify(DB.clients.find(c=>c.id==='b').contractedItems))");
  w.endContracted(0);
  assert('按「終止」→ 終止日＝今天', w.eval('S.cfContracted[0].endDate') === w.today());
  w.setContractEnd(0, '');
  assert('按「復原」→ 終止日清掉', w.eval('S.cfContracted[0].endDate') === undefined);

  console.log('R2 — 週報：既增／既減／解約列（除稅、減少是負數）與上半部數字');
  by('b').contractedItems.push(K('DOME', 335, '2026-11-19'));   // 補上既增
  w.eval('saveLocal()');
  w.openReportModal();
  w.document.getElementById('rpt-from').value = '2026-11-01';
  w.document.getElementById('rpt-to').value = '2026-11-20';
  w.document.getElementById('rpt-start-month').value = '11';
  w.genReport();
  const lines = w.document.getElementById('rpt-4w').value.split('\n').map(l => l.split('\t'));
  const find = n => lines.filter(l => l[1] === n).map(l => l[7] + ' ' + l[13]).join('|');
  assert('之前就有成約、期間內又加 → 既增 335 ÷ 1.05 ＝ 319', find('乙乙診所') === '319 既增', find('乙乙診所'));
  assert('第一次成約 → 成約', find('己己早餐') === '381 成約', find('己己早餐'));
  assert('減完還有在租的 → 既減，負數', find('甲甲食堂') === '-267 既減', find('甲甲食堂'));
  assert('全部終止 → 解約，負數；已轉擱置也要列', find('丁丁商行') === '-600 解約', find('丁丁商行'));
  assert('列號連續', lines.every((l, i) => l[0] === String(i + 1)));
  const top = w.document.getElementById('rpt-top').textContent;
  assert('上半部照抄公司合計；試用表還沒匯入會提示', /新契 1,660/.test(top) && /淨增 1,085/.test(top) && /還沒匯入「SERVE別試用顧客一覽表」/.test(top), top);
  const sv = w.parseServeRows([
    ['', '試用單號', '營業所', '負責人', '顧客編號', '顧客名稱', '', '電話號碼', '', '狀態', '最初試用', '試用日', '', '', '回收預定日', '商品名稱', '', '', '', '試用數', '試用金額', '', '', '4W試用金額', '回收日', '', '回收數', '遺失數', '契約數', '次數'],
    ['', '', '測試所', '0001 測試員(R)', '', '', '', '顧客試用軒數 : 20', '', '', '顧客試用金額 : ', '', '', '', 14060, '4W試用金額 : ', '', '', '', '', 22020],
    ['', '005261102001', '', '', '1000001', '甲', '', '06-1', '', '未回收', '2026/11/02', '2026/11/02', '', '', '2026/11/16', '1', 'DOME', '', '', 1, 220, '', '', 220, '', '', 0, 0, '', 1]
  ]);
  assert('試用表表頭的三個合計讀得到', sv.totals.shops === 20 && sv.totals.amt === 14060 && sv.totals.amt4w === 22020, JSON.stringify(sv.totals));

  console.log(failed ? `R2 FAILED (${failed})` : 'R2 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
