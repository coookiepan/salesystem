// L2 輸入檢查：validateClient 回傳警告（不阻擋儲存）。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'dangerously', url: 'https://x.github.io/salesystem/', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
  beforeParse(w) { w.scrollTo = () => {}; w.fetch = async () => { throw new Error('d'); }; }
});
const w = dom.window;
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
function assert(name, cond, extra) { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : ''))); if (!cond) failed++; }
const V = c => JSON.parse(w.eval('JSON.stringify(validateClient(' + JSON.stringify(c) + '))'));

(async () => {
  await wait(300);
  console.log('L2 — 輸入檢查 validateClient');
  assert('完整正確資料 → 無警告', V({ name: '王小明', regNo: '12345678', phone: '06-1234567' }).length === 0);
  assert('空名稱 → 警告', V({ name: '(未命名)' }).some(s => /名稱/.test(s)));
  assert('統編非 8 碼 → 警告', V({ name: 'X', regNo: '1234' }).some(s => /統一編號/.test(s)));
  assert('統編 8 碼 → 不警告統編', !V({ name: 'X', regNo: '04123456' }).some(s => /統一編號/.test(s)));
  assert('電話含英文字母 → 警告', V({ name: 'X', phone: 'call-me' }).some(s => /電話/.test(s)));
  assert('電話含分機/井號 → 不警告', !V({ name: 'X', phone: '06-1234567 #分機12' }).some(s => /電話/.test(s)));
  assert('多個問題會一起回報', V({ name: '', regNo: '1', phone: 'abc' }).length === 3);

  console.log(failed ? `L2 FAILED (${failed})` : 'L2 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('THROWN', e); process.exit(1); });
