// 商品牌價總表產生器
// 直接從 index.html 內的 DEFAULT_PRODUCTS 抽資料，避免重複維護。
// 產出：商品價格總表.csv（Excel／Google 試算表可直接開啟，含 UTF-8 BOM）。
//
// 欄位完全對應「設定 → 商品資料庫」面板顯示的牌價，不做任何試算換算：
//   - 單價 = 商品資料庫的 price（牌價），配件／機台／口味（price=0）單價留空。
//   - 更換週期、備註照原資料。
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const m = html.match(/const DEFAULT_PRODUCTS=(\[[\s\S]*?\n\]);/);
if (!m) { console.error('找不到 DEFAULT_PRODUCTS'); process.exit(1); }
const PRODUCTS = new Function('return ' + m[1] + ';')();

const CATS = ['拖把', '地墊', '芳香'];
const cycleText = c => ({ '1W': '每 1 週', '2W': '每 2 週', '4W': '每 4 週' }[c] || '');

const priced = PRODUCTS.filter(p => p.price > 0);
const parts = PRODUCTS.filter(p => !(p.price > 0)); // 配件／機台／口味（無牌價）

// CSV 逸出
const q = v => {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const rows = [];
rows.push('DUSKIN 商品牌價總表');
rows.push('資料來源：商品資料庫（設定→商品資料庫）；單價為牌價（每次更換／件），未含任何折扣或加總。');
rows.push('');
rows.push(['分類', '代號', '品名', '更換週期', '單價(NT$)', '備註'].map(q).join(','));
for (const cat of CATS) {
  for (const p of priced.filter(x => x.cat === cat)) {
    rows.push([p.cat, p.code, p.desc, cycleText(p.cycle), p.price, p.note || ''].map(q).join(','));
  }
}
rows.push('');
rows.push('配件／機台／口味（無獨立牌價，隨主商品搭配）');
rows.push(['分類', '代號', '品名', '備註'].map(q).join(','));
for (const cat of CATS) {
  for (const p of parts.filter(x => x.cat === cat)) {
    rows.push([p.cat, p.code, p.desc, p.note || ''].map(q).join(','));
  }
}

fs.writeFileSync(path.join(root, '商品價格總表.csv'), '﻿' + rows.join('\r\n'));
console.log(`完成：牌價商品 ${priced.length} 項、配件／機台／口味 ${parts.length} 項 → 商品價格總表.csv`);
