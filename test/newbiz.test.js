// 新登記商家解析（tools/newbiz/parse.js）。資料全為自編，不含真實商號與負責人。
const assert = require('assert');
const { parseItemText, classify, floorOf, rocToIso } = require('../tools/newbiz/parse.js');

const SAMPLE = [
  '                                              商業登記設立登記所營事業項目清冊',
  '                                                               115年10月',
  '序號   統一編號         登記機關     商    業   名   稱   負責人        商   業   所   在   地   資本額        核准設立日期                  營   業   項   目   說   明',
  '',
  '1    00000001   臺南市政府    測試早餐店              王小明   臺南市永康區測試里中山南路1段100號          30,000   115/10/21   F501060 餐館業',
  '                                                  1樓                                              F501030 飲料店業',
  '                                                                                                  ZZ99999 除許可業務外，得經營法令非禁止或限制之業務',
  '2    00000002   臺南市政府    測試水電工程行            陳大華   臺南市東區測試里東門路2段5巷          200,000   115/10/02   E601010 電器承裝業',
  '                                                  3號                                              E603050 自動控制設備工程業',
  '                                              商業登記設立登記所營事業項目清冊',
  '                                                               115年10月',
  '序號   統一編號         登記機關     商   業   名   稱   負責人        商   業   所   在   地   資本額        核准設立日期                  營   業   項   目   說   明',
  '3    00000003   臺南市政府    測試美學工作室            林美麗   臺南市中西區測試里民族路3段200號5樓之1        100,000   115/10/05   JZ99080 美容美髮服務業',
  '4    00000004   臺南市政府    測試健身工作室安平店         張三     臺南市仁德區測試里中正路88號1樓                     115/10/16   J802010 運動訓練業',
  '5    00000005   臺南市政府    測試選品社              李四     臺南市歸仁區測試里大廟六街9號          50,000   115/10/07   F399040 無店面零售業',
].join('\n');

const recs = parseItemText(SAMPLE);
assert.strictEqual(recs.length, 5, '跨頁表頭不算一筆');
assert.deepStrictEqual(recs.map(r => r.seq), [1, 2, 3, 4, 5]);

// 地址折行要接回來，營業項目逐行收進來
assert.strictEqual(recs[0].addr, '臺南市永康區測試里中山南路1段100號1樓');
assert.deepStrictEqual(recs[0].items.map(i => i.code), ['F501060', 'F501030', 'ZZ99999']);
assert.strictEqual(recs[0].capital, 30000);
assert.strictEqual(recs[0].date, '115/10/21');
assert.strictEqual(recs[1].addr, '臺南市東區測試里東門路2段5巷3號');

// 沒填資本額（分店）不能把後面的欄位吃錯
assert.strictEqual(recs[3].capital, null);
assert.strictEqual(recs[3].date, '115/10/16');
assert.strictEqual(recs[3].items[0].name, '運動訓練業');

const c = recs.map(classify);
assert.deepStrictEqual([c[0].district, c[0].li, c[0].road, c[0].floor], ['永康區', '測試里', '中山南路1段', '1樓']);
assert.deepStrictEqual([c[0].kind, c[0].grade, c[0].mine], ['餐飲', 'A', true]);
assert.deepStrictEqual([c[1].kind, c[1].grade], ['工程', 'C']);
assert.deepStrictEqual([c[2].kind, c[2].grade, c[2].mine, c[2].floor], ['美容美髮', 'C', false, '樓上']); // 樓上非餐飲；中西區不是我的區
assert.deepStrictEqual([c[3].kind, c[3].grade], ['運動休閒', 'B']);
assert.deepStrictEqual([c[4].grade, c[4].why], ['C', '只登記網路銷售']);
assert.strictEqual(c[0].dateIso, '2026-10-21');
assert.ok(!c[0].itemText.includes('除許可業務外'), 'ZZ99999 不列進營業項目');

// 登記十項以上、餐飲排在後面 → 不算餐飲店，但留下提示
const many = classify({ name: '測試企業社', addr: '臺南市永康區測試里中華路1號1樓', date: '115/10/01',
  items: [...Array.from({ length: 10 }, (_, i) => ({ code: 'F20' + (1000 + i), name: '測試' + i + '零售業' })), { code: 'F501060', name: '餐館業' }] });
assert.deepStrictEqual([many.kind, many.grade, many.why], ['零售', 'B', '登記項目多，含餐飲']);

assert.strictEqual(floorOf('臺南市東區某路1號地下1樓'), '1樓');
assert.strictEqual(floorOf('臺南市東區某路1號'), '未標示');
assert.strictEqual(rocToIso('115/06/01'), '2026-06-01');


// ── 寫進試算表的列：只留我的區、非 C 級 ──
const { toRows, sanity, lastMonthRoc } = require('../tools/newbiz/parse.js');
const rows = toRows(recs, '11510');
assert.deepStrictEqual(rows.map(r => r.ban), ['00000001', '00000004'], '工程行、中西區、只做網路的都不進試算表');
assert.deepStrictEqual(Object.keys(rows[0]), ['ban', 'name', 'addr', 'district', 'kind', 'grade', 'date', 'floor', 'items', 'owner', 'ym', 'capital']);
assert.deepStrictEqual([rows[0].capital, rows[1].capital], [30000, null], '資本額帶數字；沒填的是 null');
assert.strictEqual(rows[0].date, '2026-10-21');
assert.ok(/只解析出/.test(sanity(recs)), '筆數太少要擋下');
const big = Array.from({ length: 60 }, (_, i) => ({ seq: i + 1, ban: String(10000000 + i), addr: '臺南市東區測試路1號', date: '115/10/01', items: [{ code: 'F501060', name: '餐館業' }] }));
assert.strictEqual(sanity(big), '');
big[30].seq = 99;
assert.ok(/序號不連續/.test(sanity(big)));
assert.strictEqual(lastMonthRoc(new Date('2026-11-05T21:10:00Z')), '11510', 'UTC 5 日 21:10＝臺灣 6 日 05:10');
assert.strictEqual(lastMonthRoc(new Date('2027-01-05T21:10:00Z')), '11512', '跨年');

// ── 後端：importNewbiz／getNewbiz／markNewbiz（從 index.html 抽出 APPS_SCRIPT_CODE，用假的試算表跑）──
const fs = require('fs'), path = require('path');
const code = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').match(/const APPS_SCRIPT_CODE=`([\s\S]*?)`;/)[1];
const grid = [];   // grid[r][c]，0 起算；第 0 列是表頭
let maxRows = 3;
const sheet = {
  getLastRow() { return grid.length; }, getMaxRows() { return maxRows; },
  insertRowsAfter(_, n) { maxRows += n; }, setFrozenRows() {},
  getRange(r, c, nr, nc) {
    nr = nr || 1; nc = nc || 1;
    const api = {
      getValues() { return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (grid[r - 1 + i] || [])[c - 1 + j] ?? '')); },
      setValues(v) { if (r - 1 + nr > maxRows) throw new Error('超出分頁列數'); v.forEach((row, i) => { grid[r - 1 + i] = grid[r - 1 + i] || []; row.forEach((x, j) => { grid[r - 1 + i][c - 1 + j] = x; }); }); return api; },
      setValue(x) { return api.setValues([[x]]); },
      setNumberFormat() { return api; },
    };
    return api;
  },
};
let made = null;
const SpreadsheetApp = { getActiveSpreadsheet() { return { getSheetByName(n) { return n === 'newbiz' ? made : null; }, insertSheet() { made = sheet; return sheet; } }; } };
const Maps = { newGeocoder() { return { setLanguage() { return this; }, setRegion() { return this; },
  geocode(a) { return /查無/.test(a) ? { status: 'ZERO_RESULTS', results: [] } : { status: 'OK', results: [{ geometry: { location: { lat: 23, lng: 120.2 }, location_type: 'ROOFTOP' }, formatted_address: a }] }; } }; } };
const gas = new Function('SpreadsheetApp', 'Maps', code + '\n;return {importNewbiz,getNewbiz,markNewbiz,BACKEND_VER};')(SpreadsheetApp, Maps);
assert.ok(gas.BACKEND_VER >= 6);
const more = [rows[0], rows[1], Object.assign({}, rows[1], { ban: '00000009', name: '測試查無地址店', addr: '臺南市東區查無路9號' })];
let r1 = gas.importNewbiz(more);
assert.deepStrictEqual([r1.added, r1.updated, r1.geocoded, r1.noGeo, r1.total], [3, 0, 2, 1, 3]);
assert.strictEqual(grid[0][0], '統一編號');
assert.strictEqual(grid[1][0], '00000001', '統編開頭的 0 要留著');
let got = gas.getNewbiz().newbiz;
assert.strictEqual(got.length, 3);
assert.deepStrictEqual([got[0].ban, got[0].grade, got[0].lat, got[0].lng], ['00000001', 'A', 23, 120.2]);
assert.strictEqual(got[2].lat, null, '查無座標的回 null，前端不上圖');
assert.deepStrictEqual([got[0].capital, got[1].capital, grid[0][14], grid[2][14]], [30000, null, '資本額', ''], '資本額存在最後一欄；沒填留空');
gas.markNewbiz('00000004', 'skip');
assert.deepStrictEqual(gas.getNewbiz().newbiz.map(x => x.ban), ['00000001', '00000009'], '略過的不再回傳');
// 重跑同一個月：不重複、不洗掉「略過」、已有座標的不重查
r1 = gas.importNewbiz(more.map(x => Object.assign({}, x, { kind: x.ban === '00000001' ? '餐飲改' : x.kind })));
assert.deepStrictEqual([r1.added, r1.updated, r1.geocoded, r1.total], [0, 3, 0, 3]);
assert.strictEqual(grid[2][13], 'skip');
assert.strictEqual(grid[1][14], 30000, '重跑後資本額還在');
assert.strictEqual(gas.getNewbiz().newbiz[0].kind, '餐飲改');
assert.deepStrictEqual(gas.markNewbiz('99999999', 'skip'), { ok: true, missing: true });

console.log('newbiz.test.js OK');
