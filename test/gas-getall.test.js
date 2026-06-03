// C4 測試：後端 getAllClients 逐列容錯
// 從 index.html 抽出 APPS_SCRIPT_CODE，在 Node 用假的 Apps Script 服務跑起來，
// 驗證「單一列 JSON 壞掉時，整批 getAll 不會失敗、只跳過壞列並回報列號」。
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/const APPS_SCRIPT_CODE=`([\s\S]*?)`;/);
if (!m) { console.error('FAIL: 無法從 index.html 抽出 APPS_SCRIPT_CODE'); process.exit(1); }
const code = m[1];

function makeSheet(data) { // data：第 1 欄各列值，index 0 = 第 1 列
  return {
    getLastRow() { return data.length; },
    getLastColumn() { return 1; },
    getRange(row, col, numRows) {
      numRows = numRows || 1;
      return {
        getValues() { const out = []; for (let i = 0; i < numRows; i++) { const v = data[row - 1 + i]; out.push([v === undefined ? '' : v]); } return out; },
        getValue() { const v = data[row - 1]; return v === undefined ? '' : v; },
        setValue(v) { data[row - 1] = v; }
      };
    }
  };
}

const clients = ['data',
  JSON.stringify({ id: 'a', name: '甲' }),
  JSON.stringify({ id: 'b', name: '乙' }),
  '{bad json,,,',                 // 第 4 列：故意壞掉
  JSON.stringify({ id: 'c', name: '丙' })];
const clientsSheet = makeSheet(clients);
const emptySheet = makeSheet([]);

const SpreadsheetApp = { getActiveSpreadsheet() { return {
  getName() { return '王大明'; },
  getSheetByName(n) { return n === 'clients' ? clientsSheet : emptySheet; },
  getSheets() { return [clientsSheet]; },
  insertSheet() { return emptySheet; }
}; } };
const ContentService = { MimeType: { JSON: 'json' }, createTextOutput(t) { return { _t: t, setMimeType() { return this; }, getContent() { return this._t; } }; } };
const PropertiesService = { getScriptProperties() { return { getProperty() { return null; } }; } };
// H1：紀錄取鎖 / 放鎖次數，驗證寫入動作有序列化、且結束一定釋放
const lockLog = { acquired: 0, released: 0, held: false };
const LockService = { getScriptLock() { return {
  tryLock() { lockLog.acquired++; lockLog.held = true; return true; },
  releaseLock() { lockLog.released++; lockLog.held = false; }
}; } };

const api = new Function('SpreadsheetApp', 'ContentService', 'PropertiesService', 'LockService',
  code + '\n;return {handleRequest, getAllClients};')(SpreadsheetApp, ContentService, PropertiesService, LockService);

let failed = 0;
function assert(name, cond) { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) failed++; }

console.log('C4 — getAllClients 逐列容錯');
let res, threw = false;
try { res = api.getAllClients(); } catch (e) { threw = true; }
assert('壞列不再讓 getAll 拋錯', !threw);
assert('好資料 3 筆', res && res.clients.length === 3);
assert('內容為 甲/乙/丙', res && res.clients.map(c => c.name).join(',') === '甲,乙,丙');
assert('回報跳過列號 [4]', res && JSON.stringify(res.skipped) === '[4]');

const out = api.handleRequest({ parameter: {}, postData: { contents: JSON.stringify({ action: 'getAll' }) } });
const parsed = JSON.parse(out.getContent());
assert('handleRequest(getAll) 回 3 筆 + skipped=[4]', parsed.clients.length === 3 && JSON.stringify(parsed.skipped) === '[4]');
assert('讀取動作不取鎖', lockLog.acquired === 0);

console.log('H1 — 寫入動作並發鎖');
const saveOut = api.handleRequest({ parameter: {}, postData: { contents: JSON.stringify({ action: 'save', client: { id: 'd', name: '丁' } }) } });
const saved = JSON.parse(saveOut.getContent());
assert('save 動作成功寫入', saved.ok === true);
assert('save 取得鎖一次', lockLog.acquired === 1);
assert('save 結束釋放鎖（finally 保證）', lockLog.released === 1 && lockLog.held === false);

console.log('M2 — getAllClients(since) 增量同步');
const incClients = ['data',
  JSON.stringify({ id: 'x', name: 'X', updatedAt: 1000 }),   // 舊：應略過
  JSON.stringify({ id: 'y', name: 'Y', updatedAt: 5000 }),   // 新：應回傳
  JSON.stringify({ id: 'z', name: 'Z' })];                   // 無 updatedAt（舊資料）：應回傳
const incSheet = makeSheet(incClients);
const SA2 = { getActiveSpreadsheet() { return {
  getName() { return 'S'; },
  getSheetByName(n) { return n === 'clients' ? incSheet : makeSheet([]); },
  getSheets() { return [incSheet]; }, insertSheet() { return makeSheet([]); }
}; } };
const api2 = new Function('SpreadsheetApp', 'ContentService', 'PropertiesService', 'LockService',
  code + '\n;return {getAllClients};')(SA2, ContentService, PropertiesService, LockService);
const inc = api2.getAllClients(3000); // since = 3000
assert('帶 incremental 旗標', inc.incremental === true);
assert('只回傳有更動/無時間的列（Y + Z）', inc.clients.map(c => c.name).sort().join(',') === 'Y,Z');
assert('未更動的 X 被略過', !inc.clients.some(c => c.name === 'X'));
assert('ids 含全部三筆（供前端偵測刪除）', (inc.ids || []).slice().sort().join(',') === 'x,y,z');
assert('不帶 since 仍為整碗（無 incremental）', !api2.getAllClients().incremental);

console.log(failed ? `C4/H1/M2 FAILED (${failed})` : 'C4 + H1 + M2 PASSED ✅');
process.exit(failed ? 1 : 0);
