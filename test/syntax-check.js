// 語法檢查：在不執行的前提下，確認所有要上線的 JS 都能正確 parse。
//   1) index.html 內所有 inline <script>（含主程式）
//   2) APPS_SCRIPT_CODE 模板字串本身（貼到 Apps Script 的後端程式）
//   3) sw.js（Service Worker）
// 用 new Function 只檢查語法、不執行，所以引用瀏覽器全域不會報錯。
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

let failed = 0;
function check(name, code) {
  try { new Function(code); console.log('  ✓ ' + name); }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); failed++; }
}

console.log('語法檢查');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// 1) 所有 inline <script>（排除有 src 的外部腳本）
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m, i = 0;
while ((m = re.exec(html)) !== null) {
  const body = m[1].trim();
  if (body) check('inline <script> #' + (++i), body);
}
if (i === 0) { console.log('  ✗ 找不到任何 inline script'); failed++; }

// 2) Apps Script 後端模板
const gas = html.match(/const APPS_SCRIPT_CODE=`([\s\S]*?)`;/);
if (gas) check('APPS_SCRIPT_CODE 後端程式', gas[1]);
else { console.log('  ✗ 找不到 APPS_SCRIPT_CODE'); failed++; }

// 3) Service Worker
check('sw.js', fs.readFileSync(path.join(root, 'sw.js'), 'utf8'));

console.log(failed ? `語法檢查 FAILED (${failed})` : '語法檢查 PASSED ✅');
process.exit(failed ? 1 : 0);
