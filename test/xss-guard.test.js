// M1 XSS 防呆：掃描 index.html，禁止把「使用者/管理者可編輯的自由文字欄位」
// 直接插進 HTML 模板而未經 escHtml。抓的是最常見的腳印：整段 ${obj.field}
// （可帶 ||fallback）直出值。textContent / .value 賦值不算 HTML 注入，排除。
// 這道關卡讓未來新增的渲染若漏跳脫，CI 會直接擋下。
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

let failed = 0;
function assert(name, cond, extra) { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : ''))); if (!cond) failed++; }

console.log('M1 — XSS 跳脫防呆');
const h = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert('escHtml 跳脫函式存在', /function\s+escHtml\s*\(/.test(h));

const FIELDS = 'name|desc|note|addr|address|contact|type|company|code|color|size|cycle|product|memo|text|title|label';
const OBJ = 'p|c|v|it|t|n|cl|client|x';
const re = /\$\{\s*((?:[a-zA-Z_]\w*\.)?(?:[a-zA-Z_]\w*\.)*[a-zA-Z_]\w*)\s*(\|\|[^}]*?)?\}/g;
const fieldRe = new RegExp('^(?:' + OBJ + ')\\.(?:[a-zA-Z_]\\w*\\.)*(?:' + FIELDS + ')$');
const lines = h.split('\n');
let m; const hits = [];
while ((m = re.exec(h)) !== null) {
  if (!fieldRe.test(m[1])) continue;
  const lineNo = h.slice(0, m.index).split('\n').length;
  if (/textContent|\.value\b/.test(lines[lineNo - 1])) continue; // 非 HTML 注入
  hits.push(lineNo + ': ${' + m[1] + (m[2] || '') + '}');
}
assert('沒有未跳脫的直出欄位插入 HTML', hits.length === 0, hits.join(' , '));

console.log('M5 — localStorage 配額處理');
assert('saveLocal 會偵測 QuotaExceededError', /QuotaExceededError/.test(h));
assert('saveLocal 配額滿時會提示使用者', /本機儲存空間已滿/.test(h));

console.log(failed ? `M1/M5 FAILED (${failed})` : 'M1 + M5 PASSED ✅');
process.exit(failed ? 1 : 0);
