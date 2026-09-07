// C5 — 商品價格邏輯（報價精靈／合約精靈共用入口）＋ 合約精靈輸入不失焦 ＋ 工業區對話框疊層
//   規則：Product.price＝商品自身週期下的每次更換單價；定價以主系統商品庫（DB.products）為準，CM_CATALOG 後援。
//   換得比商品週期更久（2W 商品選 4W）→ ×倍數；一樣或更勤 → 單價不變。4W 金額＝單價 × 次數 × 數量。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

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
  return dom.window;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
function assert(name, cond, extra) { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : ''))); if (!cond) failed++; }
function eq(name, actual, expected) { assert(name, actual === expected, 'got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected)); }

(async () => {
  const w = boot();
  await wait(300);
  const T = w.ContractMaker._test;
  const DB = w.eval('DB'), S = w.eval('S');   // let 宣告不掛在 window 上
  const prod = code => DB.products.find(p => p.code === code);

  console.log('C5 — cmCatalogUnit：商品週期 → 所選週期的每次更換單價');
  eq('2W 商品選 2W → 不變', T.catalogUnit(170, '2W', '2W'), 170);
  eq('2W 商品選 4W → ×2（一次更換涵蓋兩期）', T.catalogUnit(170, '2W', '4W'), 340);
  eq('2W 商品選 1W → 不變（每次更換各收；考題 GLH 1週 360×4=1440）', T.catalogUnit(360, '2W', '1W'), 360);
  eq('4W 商品選 4W → 不變（DOME 200 不可變 400）', T.catalogUnit(200, '4W', '4W'), 200);
  eq('4W 商品選 2W → 不變', T.catalogUnit(200, '4W', '2W'), 200);
  eq('4W 商品選 1W → 不變', T.catalogUnit(200, '4W', '1W'), 200);
  eq('未給所選週期 → 視同商品週期', T.catalogUnit(200, '4W'), 200);
  eq('無定價 → null', T.catalogUnit(null, '2W', '4W'), null);

  console.log('C5 — cmCatalogInfo：主系統商品庫優先，合約商品庫後援');
  const dome = prod('DOME');
  eq('DOME 取主系統價', T.catalogInfo('DOME').price, dome.price);
  eq('DOME 週期 4W', T.catalogInfo('DOME').cycle, '4W');
  eq('AFDW（只在主系統）也有定價', T.catalogInfo('AFDW').price, prod('AFDW').price);
  eq('HPL（只在合約商品庫）退回合約庫價', T.catalogInfo('HPL').price, 360);
  eq('HPL 週期 2W', T.catalogInfo('HPL').cycle, '2W');
  eq('不存在代號 → null', T.catalogInfo('NOPE-XYZ'), null);
  const keep = dome.price; dome.price = 0;
  eq('主系統定價 0 → 退回合約商品庫 DOME 200', T.catalogInfo('DOME').price, 200);
  dome.price = 999;
  eq('改主系統價 → 報價跟著變（單一來源）', T.catalogInfo('DOME').price, 999);
  dome.price = keep;

  console.log('C5 — cmItemCycle：客戶卡只讓地墊選週期，4W 商品的 2W 預設值無意義');
  eq('4W 商品 + 客戶卡 2W → 4W', T.itemCycle({ cycle: '2W' }, { price: 200, cycle: '4W' }), '4W');
  eq('2W 商品 + 客戶卡 4W → 4W', T.itemCycle({ cycle: '4W' }, { price: 170, cycle: '2W' }), '4W');
  eq('2W 商品 + 客戶卡無週期 → 2W', T.itemCycle({}, { price: 170, cycle: '2W' }), '2W');
  eq('無定價 + 客戶卡 1W → 1W', T.itemCycle({ cycle: '1W' }, null), '1W');

  console.log('C5 — 報價精靈：客戶卡帶入與引擎');
  const q = T.clientToConfig({ name: '店', trialItems: [
    { product: 'DOME', qty: 2, cycle: '2W', quoted: 0 },
    { product: 'DECSR', qty: 1, cycle: '4W', quoted: 0 },
    { product: 'DECLR', qty: 2, cycle: '2W', quoted: 1000 },
    { product: 'AFDW', qty: 1, cycle: '2W', quoted: 0 }
  ] });
  eq('DOME 週期 4W', q.items[0].cycle, '4W');
  eq('DOME 單價＝主系統價（不加倍）', q.items[0].unit, dome.price);
  eq('DOME 標自動帶入', q.items[0]._unitAuto, true);
  eq('地墊選 4W → 2W價×2', q.items[1].unit, 340);
  eq('議價 quoted 1000/(2次×2件)=250', q.items[2].unit, 250);
  eq('議價不標自動帶入', q.items[2]._unitAuto, undefined);
  eq('AFDW 不在合約庫 → 記 autoCustomCodes', q._meta.autoCustomCodes[0], 'AFDW');
  eq('AFDW 由主系統帶價', q.items[3].unit, prod('AFDW').price);
  const ex = T.engine.expandQuote(T.buildConfigFrom(q));   // 走真實流程：cmBuildConfig 把主系統品名轉成 nameOverride
  const rows = ex.areas[0].items;
  eq('引擎 DOME 每4週＝price×1×2', rows[0].monthly, dome.price * 2);
  eq('引擎 地墊 4W 每4週＝340×1', rows[1].monthly, 340);
  eq('引擎 議價列每4週＝250×2×2=1000（還原客戶卡議價）', rows[2].monthly, 1000);
  eq('引擎 未給 unit 時 DOME 4W 單價＝price', T.engine.expandItem({ code: 'DOME', qty: 1, cycle: '4W' }).unitPrice, dome.price);
  eq('引擎 未給 unit、未給週期 → 商品週期 4W', T.engine.expandItem({ code: 'DOME', qty: 1 }).cycle, '4W');
  eq('引擎 手填單價不換算', T.engine.expandItem({ code: 'DOME', qty: 1, cycle: '4W', unit: 180 }).monthly, 180);

  console.log('C5 — 合約精靈：同一套單價邏輯');
  const wz = T.wizInit({ name: 'W', trialItems: [
    { product: 'DOME', qty: 1, cycle: '2W', quoted: 0 },
    { product: 'DECSR', qty: 1, cycle: '4W', quoted: 0 },
    { product: 'DECLR', qty: 2, cycle: '2W', quoted: 1000 }
  ] });
  eq('DOME 契約單價＝price', wz.items[0].contractUnit, dome.price);
  eq('DOME 週期 4W', wz.items[0].cycle, '4W');
  eq('地墊 4W 契約單價 340', wz.items[1].contractUnit, 340);
  eq('議價 契約單價 250', wz.items[2].contractUnit, 250);
  eq('議價不標自動帶入', wz.items[2]._unitAuto, false);
  const wz2 = T.wizSetItemProduct(0, 'DECSR');
  eq('換商品 → 週期跟商品 2W', wz2.items[0].cycle, '2W');
  eq('換商品 → 單價重帶 170', wz2.items[0].contractUnit, 170);
  eq('換商品 → 標自動帶入', wz2.items[0]._unitAuto, true);

  console.log('C5 — 合約精靈 UI：打數量／單價不失焦、金額就地更新');
  DB.clients.push({ id: 'cm-focus', name: '失焦測試店', status: '試用中', trialItems: [{ product: 'DOME', qty: 1, cycle: '2W', quoted: 0 }], todos: [], visits: [], updatedAt: 1 });
  S.curIdx = DB.clients.length - 1;
  w.ContractMaker.openContract();
  w.document.getElementById('cmw-next-btn').click();   // 步驟 2 商品明細
  await wait(50);
  const rowInputs = w.document.querySelectorAll('#cmw-items .cm-item input[type=number]');
  assert('商品明細列已渲染（數量＋單價）', rowInputs.length >= 2, 'inputs=' + rowInputs.length);
  const unitInp = rowInputs[1];
  eq('單價欄預設＝DOME 主系統價', Number(unitInp.value), dome.price);
  unitInp.focus();
  unitInp.value = '25'; unitInp.dispatchEvent(new w.Event('input', { bubbles: true }));
  unitInp.value = '250'; unitInp.dispatchEvent(new w.Event('input', { bubbles: true }));
  assert('連打兩個數字後游標仍在同一個 input', w.document.activeElement === unitInp && unitInp.isConnected);
  eq('列金額就地更新（每件4W 250）', /每件4W金額 250/.test(unitInp.closest('.cm-item').textContent), true);
  eq('合計就地更新', w.document.getElementById('cmw-total').textContent, '4W 租賃金額合計：250');
  const qtyInp = rowInputs[0];
  qtyInp.focus(); qtyInp.value = '3'; qtyInp.dispatchEvent(new w.Event('input', { bubbles: true }));
  assert('打數量也不失焦', w.document.activeElement === qtyInp && qtyInp.isConnected);
  eq('合計 250×1×3', w.document.getElementById('cmw-total').textContent, '4W 租賃金額合計：750');
  // 手填過單價後換週期不重算；自動帶入的才重算
  const sel = unitInp.closest('.cm-item').querySelector('select');
  sel.value = '2W'; sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  await wait(20);
  eq('手填單價換週期 → 保留 250', Number(w.document.querySelectorAll('#cmw-items .cm-item input[type=number]')[1].value), 250);

  console.log('C5 — 工業區對話框要疊在全域底部導覽之上（nav.js z-index:120）');
  const iz = fs.readFileSync(path.join(ROOT, 'izcrm.html'), 'utf8');
  const nav = fs.readFileSync(path.join(ROOT, 'nav.js'), 'utf8');
  const navZ = Number((nav.match(/#global-nav\{[^}]*z-index:(\d+)/) || [])[1]);
  const dlgZ = Number((iz.match(/\.modal-bg\{[^}]*z-index:(\d+)/) || [])[1]);
  assert('izcrm .modal-bg z-index > #global-nav', dlgZ > navZ, dlgZ + ' vs ' + navZ);

  console.log(failed ? 'C5 FAILED ❌ (' + failed + ')' : 'C5 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
