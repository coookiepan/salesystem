#!/usr/bin/env node
// 新登記商家：把一個月的清冊文字解析後寫進試算表（由 .github/workflows/newbiz.yml 每月呼叫）。
//   node tools/newbiz/run.js --last-month        印出上個月的民國年月
//   node tools/newbiz/run.js 11510 list.txt      解析並寫入（需環境變數 NEWBIZ_ENDPOINT＝Apps Script 網址）
// 這個 repo 是公開的，執行紀錄也是：這裡只印筆數，不印店名、地址、負責人。
'use strict';
const fs = require('fs');
const { parseItemText, toRows, sanity, lastMonthRoc } = require('./parse.js');

async function main() {
  const [a, b] = process.argv.slice(2);
  if (a === '--last-month') { console.log(lastMonthRoc()); return; }
  if (!/^\d{5}$/.test(a || '') || !b) throw new Error('用法：run.js <民國年月> <清冊文字檔>');
  const recs = parseItemText(fs.readFileSync(b, 'utf8'));
  const problem = sanity(recs);
  if (problem) throw new Error(a + ' 清冊有問題：' + problem);
  const rows = toRows(recs, a);
  console.log(a + '：全市 ' + recs.length + ' 筆，我的區且非 C 級 ' + rows.length + ' 筆（A ' + rows.filter(r => r.grade === 'A').length + '）');
  const url = process.env.NEWBIZ_ENDPOINT;
  if (!url) throw new Error('沒有設定 NEWBIZ_ENDPOINT（GitHub → Settings → Secrets → Actions）');
  // 後端一次最多花 200 秒定位；沒定位完就再送同一批（已有座標的不會重查），最多四趟。
  for (let round = 1; round <= 4; round++) {
    const res = await fetch(url, { method: 'POST', body: JSON.stringify({ action: 'importNewbiz', rows }) });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { throw new Error('後端回的不是 JSON（網址錯了，或部署權限不是「所有人」）'); }
    if (json.error) throw new Error('後端回報錯誤：' + (json.error === 'Unknown action' ? '後端是舊版，請重新部署 Apps Script' : json.error));
    console.log('  第 ' + round + ' 趟：新增 ' + json.added + '、更新 ' + json.updated + '、定位成功 ' + json.geocoded + '、尚無座標 ' + json.noGeo + '、分頁共 ' + json.total + ' 筆');
    if (!json.noGeo || !json.geocoded) break;
  }
}
main().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
