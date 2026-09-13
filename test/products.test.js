// P2 — 商品主檔單一化：DB.products 是全系統唯一商品來源（主系統／報價合約精靈／庫存／工業區CRM），
//    價格表基準自癒（雲端整包覆蓋也洗不掉）、基準不可刪只能停用、商品頁可直接管庫存。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const izHtml = fs.readFileSync(path.join(root, 'izcrm.html'), 'utf8');

let failed = 0;
const assert = (name, cond, extra) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : ''))); if (!cond) failed++; };
const eq = (name, a, b) => assert(name, a === b, 'got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b));
const wait = ms => new Promise(r => setTimeout(r, ms));

const pushed = [];
function boot(store, cloudProducts, page) {
  const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
  const dom = new JSDOM(page === 'iz' ? izHtml : html, {
    runScripts: 'dangerously', url: 'https://x.github.io/salesystem/', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      Object.defineProperty(w, 'localStorage', { value: {
        getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; } }, configurable: true });
      w.scrollTo = () => {};
      w.fetch = async (url, opt) => {
        const b = JSON.parse(opt.body); pushed.push(b.action); const r = a => ({ ok: true, json: async () => a });
        if (b.action === 'getAll') return r({ clients: [], ids: [] });
        if (b.action === 'getInventory') return r({ inventory: [] });
        if (b.action === 'getProducts') return r({ products: JSON.parse(JSON.stringify(cloudProducts || [])) });
        return r({ ok: true });
      };
    }
  });
  return dom.window;
}

(async () => {
  // 使用者的雲端商品清單是舊的、缺一堆代號（DWTH 不見了就是這樣來的）
  const STALE_CLOUD = [
    { code: 'DECSR', cat: '地墊', desc: '中英歡迎地墊 S 71x85', price: 170, cycle: '2W', note: '', active: true },
    { code: 'S-20', cat: '拖把', desc: '業務用握把式抹布', price: 100, cycle: '2W', note: '', active: true },
    { code: 'MY-OWN', cat: '地墊', desc: '我自己加的', price: 999, cycle: '2W', note: '', active: true }
  ];
  const store = { migration_v: '11', duskin_v2: JSON.stringify({
    sheetUrl: 'https://script.google.com/macros/s/x/exec', clients: [], inventory: [], gtodos: [],
    products: [{ code: 'DECSR', cat: '地墊', desc: '中英歡迎地墊 S 71x85', price: 170, cycle: '2W', note: '', active: true }] }) };
  const w = boot(store, STALE_CLOUD);
  await wait(500);
  const DB = w.eval('DB');
  const N = w.eval('DEFAULT_PRODUCTS').length;

  console.log('P2 — migration v12：本機殘缺的商品庫補回價格表基準');
  eq('補成完整基準（1 筆 → 全部）', DB.products.length, N);
  assert('DWTH 回來了', !!w.getProd('DWTH'));
  eq('DWTH 4W 原價 1880', w.displayFw4('DWTH', 1, '4W'), 1880);
  eq('補回的帶系列與規格', w.getProd('DWTH').series + '/' + w.getProd('DWTH').size, '吸塵吸水系列/T');
  assert('補完自動推上雲（saveProducts）', pushed.includes('saveProducts'), pushed.join(','));

  console.log('P2 — 雲端整包覆蓋也洗不掉（原本 DWTH 消失的根因）');
  await w.syncFromSheet(true);
  eq('拉完仍是完整基準＋使用者自訂', DB.products.length, N + 1);
  assert('DWTH 沒被洗掉', !!w.getProd('DWTH'));
  eq('DWTH 4W 原價仍是 1880', w.displayFw4('DWTH', 1, '4W'), 1880);
  assert('使用者自己加的商品保留', !!w.getProd('MY-OWN'));
  eq('雲端那份較舊也不會覆蓋價格表的價', w.getProd('DECSR').price, 170);
  eq('自癒後把補好的再推回雲端', pushed.filter(a => a === 'saveProducts').length >= 2, true);

  console.log('P2 — 單一來源：精靈的商品庫就是主檔');
  const T = w.ContractMaker._test;
  assert('沒有第二份商品清單（CM_CATALOG 已移除）', w.eval('typeof CM_CATALOG') === 'undefined');
  eq('精靈商品庫的每一筆都是主檔的同一個物件', T.sellable().every(p => w.getProd(p.code) === p), true);
  eq('排除配件', T.sellable().some(p => p.code === 'SHB'), false);
  eq('排除口味', T.sellable().some(p => p.code === 'AF-BP'), false);
  eq('排除停用', T.sellable().some(p => p.code === 'LYSR'), false);
  eq('DWTH 可從精靈商品庫選', T.sellable().some(p => p.code === 'DWTH'), true);
  // 改主檔價格 → 精靈、客戶卡同時跟著變
  const dw = w.getProd('DWTH'); dw.price = 1000;
  eq('改主檔價 → 客戶卡 4W', w.displayFw4('DWTH', 1, '4W'), 2000);
  eq('改主檔價 → 報價精靈單價', T.catalogUnit(T.catalogInfo('DWTH'), '4W'), 2000);
  const wzItems = T.wizInit({ name: 'X', trials: [{ n: 1, start: '2026-09-01', due: '2026-09-15', open: true, items: [{ product: 'DWTH', qty: 1, cycle: '4W', quoted: 0 }] }] }).items;
  eq('改主檔價 → 合約精靈契約單價 2000', wzItems[0].contractUnit, 2000);
  dw.price = 940;
  // 改主檔品名 → 精靈帶的品名跟著變
  dw.desc = '改過的品名';
  eq('改主檔品名 → 引擎帶出同一個品名', T.engine.expandItem({ code: 'DWTH', qty: 1, cycle: '2W' }).name, '改過的品名');
  dw.desc = '吸塵吸水地墊灰 T 150x240';
  eq('訂製品 HPL 在主檔、帶合約年數 → B 型合約', T.detectContractType([{ code: 'HPL' }]), 'B');
  eq('一般商品 → A 型', T.detectContractType([{ code: 'DWTH' }]), 'A');

  console.log('P2 — 基準商品不可刪除，只能停用');
  const idx = DB.products.findIndex(p => p.code === 'DWTH');
  let alerted = '';
  w.eval('appAlert=(m)=>{window.__a=m;return Promise.resolve(true)}');
  w.openProdModal(idx);
  eq('價格表商品的刪除鈕隱藏', w.document.getElementById('pm-del-btn').style.display, 'none');
  await w.deleteProd();
  alerted = w.eval('window.__a || ""');
  assert('按下刪除會擋掉並說明改用「取消啟用」', /不能刪除/.test(alerted) && /啟用/.test(alerted), alerted);
  assert('DWTH 還在', !!w.getProd('DWTH'));
  const myIdx = DB.products.findIndex(p => p.code === 'MY-OWN');
  w.openProdModal(myIdx);
  eq('自訂商品的刪除鈕看得到', w.document.getElementById('pm-del-btn').style.display, '');
  w.eval('appConfirm=async()=>true');
  await w.deleteProd();
  assert('自訂商品可以刪', !w.getProd('MY-OWN'));

  console.log('P2 — 商品頁編輯：系列／規格／訂製年數存得進去');
  w.openProdModal(DB.products.findIndex(p => p.code === 'DWTH'));
  w.document.getElementById('pm-series').value = '測試系列';
  w.document.getElementById('pm-size').value = 'TT';
  w.document.getElementById('pm-years').value = '3';
  w.saveProd();
  const dw2 = w.getProd('DWTH');
  eq('系列／規格／年數寫入', dw2.series + '/' + dw2.size + '/' + dw2.contractYears, '測試系列/TT/3');
  eq('4W 單價欄留空的地墊 → 4W＝2W價×2', w.unitPriceAt(dw2, '4W'), 1880);
  dw2.series = '吸塵吸水系列'; dw2.size = 'T'; delete dw2.contractYears;

  console.log('P2 — 商品頁直接管車上庫存');
  w.openProdModal(DB.products.findIndex(p => p.code === 'DWTH'));
  assert('還沒在庫存 → 顯示「加入庫存」', /加入庫存/.test(w.document.getElementById('pm-inv').innerHTML));
  w.addProdToInv('DWTH');
  const inv = DB.inventory.find(x => x.name === 'DWTH');
  assert('加進庫存並帶入分類', inv && inv.cat === '地墊' && inv.std === 1, JSON.stringify(inv));
  assert('改顯示目前庫存', /車上庫存/.test(w.document.getElementById('pm-inv').innerHTML));
  w.addProdToInv('DWTH');
  eq('重複加不會變兩筆', DB.inventory.filter(x => x.name === 'DWTH').length, 1);
  w.openInvModal();
  w.document.getElementById('im-name').value = 'DWSH'; w.renderInvNameHint();
  assert('庫存輸入代號 → 顯示主檔品名', /吸塵吸水地墊灰 S/.test(w.document.getElementById('im-hint').textContent), w.document.getElementById('im-hint').textContent);
  w.document.getElementById('im-name').value = 'NOPE'; w.renderInvNameHint();
  assert('打錯代號 → 提醒商品庫沒有', /商品庫沒有/.test(w.document.getElementById('im-hint').textContent));

  console.log('P2 — 工業區CRM 讀同一份主檔');
  const izStore = { duskin_v2: store.duskin_v2 };
  const wz = boot(izStore, null, 'iz');
  await wait(300);
  const izProds = wz.eval('products()');
  assert('工業區報價試算看得到 DWTH（唯讀同一份）', izProds.some(p => p.code === 'DWTH'), '共 ' + izProds.length + ' 筆');

  console.log(failed ? 'P2 FAILED ❌ (' + failed + ')' : 'P2 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
