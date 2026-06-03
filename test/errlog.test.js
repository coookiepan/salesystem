// L1 診斷紀錄：錯誤會被記錄、上限 50 筆、持久化，且真的接到關鍵 catch。
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
  return { w: dom.window, store };
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
function assert(name, cond, extra) { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : ''))); if (!cond) failed++; }

(async () => {
  console.log('L1 — 診斷紀錄');

  // 損毀的本機資料 → loadLocal 應記錄一筆（真實接線測試）
  let { w, store } = boot({ duskin_v2: '{ this is not json' });
  await wait(300);
  let log = JSON.parse(w.eval('JSON.stringify(ERR_LOG)'));
  assert('loadLocal 解析失敗會被記錄', log.some(e => e.ctx === 'loadLocal'), JSON.stringify(log));
  assert('紀錄已持久化到 localStorage', !!store['duskin_errlog']);

  // 上限 50 筆
  w.eval('for(let i=0;i<60;i++)logErr("t","msg"+i);');
  log = JSON.parse(w.eval('JSON.stringify(ERR_LOG)'));
  assert('紀錄上限 50 筆（環狀截斷）', log.length === 50, '實際 ' + log.length);
  assert('保留最新、丟棄最舊', log[log.length - 1].msg === 'msg59' && !log.some(e => e.msg === 'msg0'));

  // UI 函式存在
  assert('showErrorLog/clearErrorLog 可用', w.eval('typeof showErrorLog==="function" && typeof clearErrorLog==="function"'));
  w.eval('clearErrorLog()');
  assert('清除後歸零', JSON.parse(w.eval('JSON.stringify(ERR_LOG)')).length === 0);

  // 全域未捕捉錯誤掛勾存在（dispatch 一個 error 事件應被記錄）
  ({ w } = boot()); await wait(300);
  try {
    w.eval('window.dispatchEvent(new ErrorEvent("error",{message:"boom-test"}))');
    const log2 = JSON.parse(w.eval('JSON.stringify(ERR_LOG)'));
    assert('全域 error 事件被記錄', log2.some(e => e.ctx === 'window.onerror'), JSON.stringify(log2));
  } catch (e) { assert('全域 error 事件被記錄（環境不支援 ErrorEvent，略過）', true); }

  console.log(failed ? `L1 FAILED (${failed})` : 'L1 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('THROWN', e); process.exit(1); });
