// C2 測試：前端持久化待推送佇列（outbox）
// 用 jsdom 真正載入 index.html，模擬離線編輯 / 重開 App / 恢復網路 / 拉取保護。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const store = {}; // 跨「重開」共用的 localStorage
function makeLS() {
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; }
  };
}
function boot() {
  const vc = new VirtualConsole();
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://x.github.io/salesystem/', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { // 頁面腳本執行「之前」就裝好共用 localStorage + 預設 fetch
      Object.defineProperty(w, 'localStorage', { value: makeLS(), configurable: true });
      w.scrollTo = () => {};
      w.fetch = async () => { throw new Error('default-down'); };
    }
  });
  return dom.window;
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
function assert(name, cond) { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) failed++; }

(async () => {
  console.log('C2 — 持久化待推送佇列');

  // 階段1：離線連續編輯 → 佇列收斂、pending 真實
  let w = boot(); await wait(400);
  w.document.getElementById('sheet-url').value = 'https://script.google.com/macros/s/X/exec'; w.saveSheetUrl();
  await w.autoSync('save', { client: { id: 'A', name: 'A1' } });
  await w.autoSync('save', { client: { id: 'A', name: 'A2' } });
  await w.autoSync('save', { client: { id: 'A', name: 'A3' } });
  await w.autoSync('save', { client: { id: 'B', name: 'B1' } });
  await w.autoSync('saveInventory', { inventory: { x: 1 } });
  await w.autoSync('saveInventory', { inventory: { x: 2 } });
  let ob = JSON.parse(store['duskin_outbox'] || '[]');
  assert('佇列收斂為 3 筆（A 合一 + B + inventory 合一）', ob.length === 3);
  assert('A 只留最新 A3', ob.find(o => o.key === 'save:A') && ob.find(o => o.key === 'save:A').payload.client.name === 'A3');
  assert('inventory 只留最新 x=2', ob.find(o => o.key === 'saveInventory') && ob.find(o => o.key === 'saveInventory').payload.inventory.x === 2);

  // 階段2：刪除 A → 蓋掉 A 還沒送出的 save
  await w.autoSync('delete', { id: 'A' });
  ob = JSON.parse(store['duskin_outbox'] || '[]');
  assert('刪除 A 後無 A 的 save', !ob.some(o => o.key === 'save:A'));
  assert('刪除 A 後有 A 的 delete', ob.some(o => o.key === 'delete:A'));

  // 階段3：重開 App + 恢復網路 → 自動補送、佇列清空
  w = boot(); await wait(400);
  const sent = [];
  w.fetch = async (u, o) => { sent.push(JSON.parse(o.body).action); return { json: async () => ({ ok: true }), text: async () => '{}' }; };
  const ok = await w.flushOutbox();
  ob = JSON.parse(store['duskin_outbox'] || '[]');
  assert('重開後 flush 成功', ok === true);
  assert('待推送內容全部送出', sent.sort().join(',') === 'delete,save,saveInventory');
  assert('佇列清空', ob.length === 0);

  // 階段4：待推送時拉取 → 先 flush；失敗則擋下不覆蓋
  w = boot(); await wait(400);
  w.document.getElementById('sheet-url').value = 'https://script.google.com/macros/s/X/exec'; w.saveSheetUrl();
  await w.autoSync('save', { client: { id: 'Z', name: 'Z' } });
  w.confirm = () => true; let alerted = ''; w.alert = m => { alerted = m; };
  const pulled = await w.syncFromSheet(false);
  assert('待推送時 pull 被擋下（回 false）', pulled === false);
  assert('提示使用者尚未上傳', /尚未上傳/.test(alerted));

  console.log(failed ? `C2 FAILED (${failed})` : 'C2 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('THROWN', e); process.exit(1); });
