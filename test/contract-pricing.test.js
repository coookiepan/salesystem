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
  const P = (price, cycle, price4w) => ({ price, cycle, price4w });
  eq('2W 商品選 2W → 不變', T.catalogUnit(P(170, '2W'), '2W'), 170);
  eq('2W 商品選 4W → ×2（一次更換涵蓋兩期）', T.catalogUnit(P(170, '2W'), '4W'), 340);
  eq('2W 商品選 1W → 不變（每次更換各收；考題 GLH 1週 360×4=1440）', T.catalogUnit(P(360, '2W'), '1W'), 360);
  eq('有表定 4 週換單價 → 選 4W 用它（NSAC 190→200）', T.catalogUnit(P(190, '2W', 200), '4W'), 200);
  eq('有 price4w 但選 2W → 仍用 2W 價', T.catalogUnit(P(190, '2W', 200), '2W'), 190);
  eq('4W 商品選 4W → 不變（DOME 不可變 440）', T.catalogUnit(P(220, '4W'), '4W'), 220);
  eq('4W 商品選 2W → 不變', T.catalogUnit(P(220, '4W'), '2W'), 220);
  eq('4W 商品選 1W → 不變', T.catalogUnit(P(220, '4W'), '1W'), 220);
  eq('未給所選週期 → 視同商品週期', T.catalogUnit(P(220, '4W')), 220);
  eq('無定價 → null', T.catalogUnit(null, '4W'), null);
  eq('主系統 unitPriceAt 與精靈同一套：S-20 4W = 160', w.unitPriceAt(prod('S-20'), '4W'), 160);
  eq('主系統 unitPriceAt SHH 兩週四週同價 140', w.unitPriceAt(prod('SHH'), '4W'), 140);

  console.log('C5 — cmCatalogInfo：主系統商品庫優先，合約商品庫後援');
  const dome = prod('DOME');
  eq('DOME 取主系統價', T.catalogInfo('DOME').price, dome.price);
  eq('DOME 週期 4W', T.catalogInfo('DOME').cycle, '4W');
  eq('AFDW 主系統與合約庫同價 400', T.catalogInfo('AFDW').price, 400);
  eq('HPL（只在合約商品庫）退回合約庫價', T.catalogInfo('HPL').price, 360);
  eq('HPL 週期 2W', T.catalogInfo('HPL').cycle, '2W');
  eq('不存在代號 → null', T.catalogInfo('NOPE-XYZ'), null);
  const keep = dome.price; dome.price = 0;
  eq('主系統定價 0 → 退回合約商品庫 DOME 220', T.catalogInfo('DOME').price, 220);
  eq('catalogInfo 帶 price4w（NSAC 200）', T.catalogInfo('NSAC').price4w, 200);
  dome.price = 999;
  eq('改主系統價 → 報價跟著變（單一來源）', T.catalogInfo('DOME').price, 999);
  dome.price = keep;

  console.log('C5 — cmItemCycle：客戶卡只讓地墊選週期，4W 商品的 2W 預設值無意義');
  eq('4W 商品 + 客戶卡 2W → 4W', T.itemCycle({ cycle: '2W' }, { price: 200, cycle: '4W' }), '4W');
  eq('2W 商品 + 客戶卡 4W → 4W', T.itemCycle({ cycle: '4W' }, { price: 170, cycle: '2W' }), '4W');
  eq('2W 商品 + 客戶卡無週期 → 2W', T.itemCycle({}, { price: 170, cycle: '2W' }), '2W');
  eq('無定價 + 客戶卡 1W → 1W', T.itemCycle({ cycle: '1W' }, null), '1W');

  console.log('C5 — 報價精靈：客戶卡帶入與引擎');
  DB.products.push({ code: 'MY-X', cat: '地墊', desc: '自訂地墊', price: 500, cycle: '2W', note: '', active: true });   // 只在主系統的商品
  const TR = items => [{ n: 1, start: '2026-09-01', due: '2026-09-15', items, open: true, recovered: '', result: '' }];
  const q = T.clientToConfig({ name: '店', trials: TR([
    { product: 'DOME', qty: 2, cycle: '2W', quoted: 0 },
    { product: 'DECSR', qty: 1, cycle: '4W', quoted: 0 },
    { product: 'DECLR', qty: 2, cycle: '2W', quoted: 1000 },
    { product: 'MY-X', qty: 1, cycle: '2W', quoted: 0 }
  ]) });
  eq('DOME 週期 4W', q.items[0].cycle, '4W');
  eq('DOME 單價＝主系統價（不加倍）', q.items[0].unit, dome.price);
  eq('DOME 標自動帶入', q.items[0]._unitAuto, true);
  eq('地墊選 4W → 2W價×2', q.items[1].unit, 340);
  eq('議價 quoted 1000/(2次×2件)=250', q.items[2].unit, 250);
  eq('議價不標自動帶入', q.items[2]._unitAuto, undefined);
  eq('只在主系統的商品 → 記 autoCustomCodes', q._meta.autoCustomCodes[0], 'MY-X');
  eq('由主系統帶價（地墊 2W 500）', q.items[3].unit, 500);
  eq('AFDW 現在合約庫也有（可從商品庫選）', T.CATALOG.products.AFDW.price, 400);
  const ex = T.engine.expandQuote(T.buildConfigFrom(q));   // 走真實流程：cmBuildConfig 把主系統品名轉成 nameOverride
  const rows = ex.areas[0].items;
  eq('引擎 DOME 每4週＝price×1×2', rows[0].monthly, dome.price * 2);
  eq('引擎 地墊 4W 每4週＝340×1', rows[1].monthly, 340);
  eq('引擎 議價列每4週＝250×2×2=1000（還原客戶卡議價）', rows[2].monthly, 1000);
  eq('引擎 未給 unit 時 DOME 4W 單價＝price', T.engine.expandItem({ code: 'DOME', qty: 1, cycle: '4W' }).unitPrice, dome.price);
  eq('引擎 未給 unit、未給週期 → 商品週期 4W', T.engine.expandItem({ code: 'DOME', qty: 1 }).cycle, '4W');
  eq('引擎 手填單價不換算', T.engine.expandItem({ code: 'DOME', qty: 1, cycle: '4W', unit: 180 }).monthly, 180);

  console.log('C5 — 合約精靈：同一套單價邏輯');
  const wz = T.wizInit({ name: 'W', trials: TR([
    { product: 'DOME', qty: 1, cycle: '2W', quoted: 0 },
    { product: 'DECSR', qty: 1, cycle: '4W', quoted: 0 },
    { product: 'DECLR', qty: 2, cycle: '2W', quoted: 1000 }
  ]) });
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
  DB.clients.push({ id: 'cm-focus', name: '失焦測試店', status: '試用中', trials: TR([{ product: 'DOME', qty: 1, cycle: '2W', quoted: 0 }]), todos: [], visits: [], updatedAt: 1 });
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

  console.log('C5 — 地墊 4W：不預設打折、只顯示建議 8 折；DOME 正名');
  eq('displayFw4 地墊 4W ＝ 2W價×2（340，不再自動 8 折）', w.displayFw4('DECSR', 1, '4W'), 340);
  eq('displayFw4 地墊 2W ＝ 340', w.displayFw4('DECSR', 1, '2W'), 340);
  eq('refTiers 地墊 4W → 9/85/8 三檔', w.refTiers('DECSR', '4W').join(','), '0.9,0.85,0.8');
  eq('refTiers 地墊 2W → 兩檔', w.refTiers('DECSR', '2W').join(','), '0.9,0.85');
  eq('refTiers 非地墊 → 兩檔', w.refTiers('DOME', '4W').join(','), '0.9,0.85');
  eq('refQuote 地墊 4W 兩片八折 = 680×0.8', w.refQuote('DECSR', 2, '4W', 0.8), 544);
  eq('tiers 地墊 4W 三檔單價 306/289/272', T.tiers('DECSR', '4W').map(t => t.unit).join(','), '306,289,272');
  eq('tiers 地墊 2W 兩檔', T.tiers('DECSR', '2W').map(t => t.unit).join(','), '153,145');
  eq('tiers DOME 兩檔 198/187', T.tiers('DOME', '4W').map(t => t.unit).join(','), '198,187');
  eq('DOME 品名＝網狀尿石去除劑 40g', dome.desc, '網狀尿石去除劑 40g');
  eq('DOME 價格 220', dome.price, 220);
  eq('合約內建庫 DOME 也是 220', T.CATALOG.products.DOME.price, 220);
  // 合約精靈：地墊 4W 列顯示建議 8 折提示、單價欄仍是原價 340（不預設帶折扣）
  DB.clients.push({ id: 'cm-mat', name: '地墊店', status: '試用中', trials: TR([{ product: 'DECSR', qty: 1, cycle: '4W', quoted: 0 }, { product: 'DOME', qty: 1, cycle: '2W', quoted: 0 }]), todos: [], visits: [], updatedAt: 1 });
  S.curIdx = DB.clients.length - 1;
  w.ContractMaker.openContract();
  w.document.getElementById('cmw-next-btn').click();
  await wait(50);
  const matRows = w.document.querySelectorAll('#cmw-items .cm-item');
  eq('地墊 4W 單價欄＝340（原價）', Number(matRows[0].querySelectorAll('input[type=number]')[1].value), 340);
  assert('地墊 4W 列有三檔建議：9折 $306／85折 $289／8折 $272', /9折 \$306/.test(matRows[0].textContent) && /85折 \$289/.test(matRows[0].textContent) && /8折 \$272/.test(matRows[0].textContent), matRows[0].textContent);
  assert('DOME 列兩檔（9折／85折），沒有 8 折', /9折 \$198/.test(matRows[1].textContent) && !/8折/.test(matRows[1].textContent));
  matRows[0].querySelectorAll('.tier')[2].click();
  await wait(30);
  const rows2 = w.document.querySelectorAll('#cmw-items .cm-item');
  eq('點 8折 → 契約單價帶入 272', Number(rows2[0].querySelectorAll('input[type=number]')[1].value), 272);
  assert('帶入後該檔亮起', rows2[0].querySelectorAll('.tier')[2].classList.contains('on'));
  // 客戶卡：報價欄 placeholder＝建議價、標示「建議8折」
  w.openCD(S.curIdx); w.openCDItems();   // 客戶卡 → 編輯品項 modal（試用品項列在這裡）
  await wait(50);
  const cardTxt = w.document.getElementById('cdm-items').textContent || '';
  assert('客戶卡地墊 4W 顯示三檔建議（9折 $306／85折 $289／8折 $272）', /9折 \$306/.test(cardTxt) && /85折 \$289/.test(cardTxt) && /8折 \$272/.test(cardTxt), cardTxt.slice(0, 300));
  w.document.querySelector('#cdm-items .tier:nth-of-type(3)').click();
  await wait(30);
  eq('點 8折 → 報價欄帶入 272', Number(w.document.querySelector('#cdm-items .price-inp').value), 272);
  assert('拖把也可選週期（2W 商品）', w.document.querySelectorAll('#cdm-items .csel').length === 1);   // DECSR 有、DOME 沒有

  console.log('C5 — migration v9：舊資料的 DOME 品名自動正名並同步上雲');
  const oldProducts = JSON.parse(JSON.stringify(w.eval('DEFAULT_PRODUCTS')));
  oldProducts.find(p => p.code === 'DOME').desc = '大型香水芳香劑 300ml';
  const w2 = boot({ duskin_v2: JSON.stringify({ clients: [], inventory: [], products: oldProducts, gtodos: [], sheetUrl: 'https://script.google.com/macros/s/x/exec' }), migration_v: '8' });   // 有設雲端才會入列推送
  await wait(300);
  const dome2 = w2.getProd('DOME');
  eq('v9 後 DOME 品名正名', dome2.desc, '網狀尿石去除劑 40g');
  eq('v9 後 DOME 價格不動', dome2.price, 220);
  const outbox2 = JSON.parse(w2.localStorage.getItem('duskin_outbox') || '[]');
  assert('商品庫變更進待推送佇列（saveProducts）', outbox2.some(o => o.action === 'saveProducts'), JSON.stringify(outbox2).slice(0, 120));

  console.log('C5 — migration v10：套用 2026-09 價格表到既有商品庫、客戶品項與庫存');
  const oldP = JSON.parse(JSON.stringify(w.eval('DEFAULT_PRODUCTS'))).filter(p => !['BXH', 'BXR', 'DWXH'].includes(p.code));
  oldP.find(p => p.code === 'DWSSH').price = 200;                       // 舊價
  oldP.find(p => p.code === 'NSAC').price4w = undefined;                // 舊資料沒有 4 週換單價
  oldP.push({ code: 'NFM-DS', cat: '拖把', desc: '紫色除塵抹布(舊碼)', price: 120, cycle: '2W', note: '', active: true });
  oldP.push({ code: 'FFSR', cat: '地墊', desc: 'FOREVER地墊紅 S 71x85', price: 170, cycle: '2W', note: '', active: true });
  oldP.push({ code: 'MY-OWN', cat: '地墊', desc: '我自己加的', price: 999, cycle: '2W', note: '', active: true });
  const w3 = boot({ duskin_v2: JSON.stringify({ clients: [
      { id: 'c1', name: '舊碼客戶', status: '試用中', trialItems: [{ product: 'NH-S-4W', qty: 1, cycle: '2W', quoted: 0 }, { product: 'FFSR', qty: 2, cycle: '2W', quoted: 0 }], todos: [], visits: [], updatedAt: 1 }
    ], inventory: [{ name: 'NFM-DS', stock: 2, std: 2, cat: '拖把' }, { name: 'S-20', stock: 5, std: 5, cat: '拖把' }], products: oldP, gtodos: [], sheetUrl: 'https://script.google.com/macros/s/x/exec' }), migration_v: '9' });
  await wait(300);
  eq('DWSSH 200 → 170', w3.getProd('DWSSH').price, 170);
  eq('NSAC 補上 4 週換單價 200', w3.getProd('NSAC').price4w, 200);
  eq('表上新增的 BXH 補進商品庫', w3.getProd('BXH').price, 550);
  eq('NFM-DS 移除', w3.getProd('NFM-DS'), null);
  eq('FOREVER 紅款移除', w3.getProd('FFSR'), null);
  eq('使用者自己加的商品不動', w3.getProd('MY-OWN').price, 999);
  const c1 = w3.eval('DB.clients')[0];
  eq('客戶品項 NH-S-4W → NH-S 且週期 4W（v10 改碼後 v11 打包成第 1 次）', c1.trials[0].items[0].product + '/' + c1.trials[0].items[0].cycle, 'NH-S/4W');
  eq('客戶品項 FFSR → FFSK', c1.trials[0].items[1].product, 'FFSK');
  eq('客戶品項改碼後 4W 金額仍算得出（FFSK 兩片 2W = 680）', w3.displayFw4('FFSK', 2, '2W'), 680);
  eq('庫存 NFM-DS → NH-S', w3.eval('DB.inventory').find(i => i.name === 'NH-S').stock, 2);
  const outbox3 = JSON.parse(w3.localStorage.getItem('duskin_outbox') || '[]');
  assert('商品庫、庫存、改碼客戶都進待推送佇列', ['saveProducts', 'saveInventory', 'save'].every(a => outbox3.some(o => o.action === a)), outbox3.map(o => o.action).join(','));

  console.log('C5 — 工業區對話框要疊在全域底部導覽之上（nav.js z-index:120）');
  const iz = fs.readFileSync(path.join(ROOT, 'izcrm.html'), 'utf8');
  const nav = fs.readFileSync(path.join(ROOT, 'nav.js'), 'utf8');
  const navZ = Number((nav.match(/#global-nav\{[^}]*z-index:(\d+)/) || [])[1]);
  const dlgZ = Number((iz.match(/\.modal-bg\{[^}]*z-index:(\d+)/) || [])[1]);
  assert('izcrm .modal-bg z-index > #global-nav', dlgZ > navZ, dlgZ + ' vs ' + navZ);

  console.log(failed ? 'C5 FAILED ❌ (' + failed + ')' : 'C5 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
