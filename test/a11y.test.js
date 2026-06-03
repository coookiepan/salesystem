// L4 無障礙輕量守門：
//   1) 沒有「icon-only 卻無 aria-label/title」的按鈕（螢幕報讀者讀得到每個按鈕）
//   2) <html lang> 與 viewport meta 存在
//   3) 任何 <img> 都有 alt
// 這是回歸防護：未來新增無標籤的 icon 按鈕，CI 會擋下。
const fs = require('fs');
const path = require('path');
const h = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let failed = 0;
function assert(name, cond, extra) { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : ''))); if (!cond) failed++; }

console.log('L4 — 無障礙輕量守門');

// 1) icon-only 無標籤按鈕
const re = /<button\b([^>]*)>([\s\S]*?)<\/button>/g;
let m; const bad = [];
function lineOf(i) { return h.slice(0, i).split('\n').length; }
while ((m = re.exec(h)) !== null) {
  const attrs = m[1], inner = m[2];
  const hasLabel = /aria-label\s*=/.test(attrs) || /\btitle\s*=/.test(attrs);
  const text = inner.replace(/<[^>]*>/g, '').replace(/[\s ]/g, '').replace(/[×✏️🗑️➕→←✓✗📋🔄🩺📍🏭⚠🌥🆕]/g, '');
  if (!hasLabel && text.length === 0) bad.push(lineOf(m.index) + ': ' + inner.replace(/\s+/g, ' ').trim().slice(0, 50));
}
assert('沒有 icon-only 無標籤按鈕', bad.length === 0, bad.join(' | '));

// 2) 文件基本可及性
assert('<html> 有 lang', /<html[^>]*\blang=/.test(h));
assert('有 viewport meta', /name="viewport"/.test(h));

// 3) 圖片 alt
const imgs = h.match(/<img\b[^>]*>/g) || [];
assert('所有 <img> 皆有 alt', imgs.every(t => /\balt=/.test(t)), '缺 alt：' + imgs.filter(t => !/\balt=/.test(t)).length);

// 4) 裝飾性 icon SVG 已標記 aria-hidden（避免報讀雜訊）
const svgs = (h.match(/<svg\b[^>]*>/g) || []);
assert('裝飾性 SVG 皆 aria-hidden', svgs.every(t => /aria-hidden/.test(t)), '未標記：' + svgs.filter(t => !/aria-hidden/.test(t)).length);

console.log(failed ? `L4 FAILED (${failed})` : 'L4 PASSED ✅');
process.exit(failed ? 1 : 0);
