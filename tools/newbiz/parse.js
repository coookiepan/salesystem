// 新登記商家：把經濟部「商業登記設立登記所營事業項目清冊」的文字（pdftotext -layout 的輸出）
// 拆成一家一筆，並標上行政區、樓層、業種、優先度。純函式，沒有網路與檔案存取。
'use strict';

// 使用者跑的區（2026-11 指定）。要增減直接改這裡。
const MY_DISTRICTS = ['永康區', '東區', '仁德區', '歸仁區', '關廟區', '龍崎區', '新化區', '左鎮區', '山上區',
  '新市區', '善化區', '官田區', '六甲區', '柳營區', '東山區', '白河區', '楠西區', '玉井區', '南化區'];

// 業種：由上往下比對「營業項目名稱」，先中先贏。餐飲放最前面（使用者指定一定要）。
const KINDS = [
  ['餐飲', /餐館業|飲料店業|飲酒店業|其他餐飲業/],
  ['美容美髮', /美容美髮|瘦身美容/],
  ['住宿', /旅館業|民宿/],
  ['運動休閒', /運動場館|運動訓練|休閒活動場館/],
  ['洗衣', /洗衣業/],
  ['寵物', /寵物/],
  ['藥局', /西藥零售|中藥零售/],
  ['汽機車', /汽車修理|機車修理|洗車|汽車零售|機車零售/],
  ['製造', /製造業/],
  ['零售', /零售業/],
  ['批發', /批發業/],
];
const NAME_ENGINEERING = /工程|水電|營造|土木|裝修|裝潢|油漆|鐵工|鷹架|起重|吊車/;
const NAME_UNMANNED = /販賣機|夾娃娃|娃娃機|選物/;
const ITEM_RE = /^([A-Z][A-Z0-9]\d{5})\s+(.+)$/;

function parseItemText(text) {
  const recs = [];
  let cur = null, nameCol = 0, addrCol = 0;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/\f/g, '');
    if (!line.trim() || /清冊\s*$/.test(line) || /^\s*\d{3}年\d{2}月\s*$/.test(line) || /^\s*序號\s/.test(line)) continue;
    const head = line.match(/^\s*(\d+)\s+(\d{8})\s+(\S+)\s+/);
    if (head) {
      const cells = splitCells(line);
      // 序號 統編 機關 名稱 負責人 地址 [資本額] [設立日] [第一個營業項目]
      const rest = cells.slice(3);
      cur = { seq: +head[1], ban: head[2], name: '', owner: '', addr: '', capital: null, date: '', items: [] };
      nameCol = rest[0] ? rest[0].col : 0;
      cur.name = rest[0] ? rest[0].text : '';
      cur.owner = rest[1] ? rest[1].text : '';
      addrCol = rest[2] ? rest[2].col : 0;
      cur.addr = rest[2] ? rest[2].text : '';
      for (const c of rest.slice(3)) {
        if (/^[\d,]+$/.test(c.text)) cur.capital = +c.text.replace(/,/g, '');
        else if (/^\d{3}\/\d{2}\/\d{2}$/.test(c.text)) cur.date = c.text;
        else pushItem(cur, c.text);
      }
      recs.push(cur);
      continue;
    }
    if (!cur) continue;
    for (const c of splitCells(line)) {
      if (ITEM_RE.test(c.text)) pushItem(cur, c.text);
      else if (Math.abs(c.col - nameCol) < Math.abs(c.col - addrCol)) cur.name += c.text;
      else if (c.col < addrCol + 30) cur.addr += c.text;
      else if (cur.items.length) cur.items[cur.items.length - 1].name += c.text; // 項目名稱折行
    }
  }
  return recs;
}

function splitCells(line) {
  const out = [];
  const re = /\S+(?: \S+)*/g; // 以兩個以上空白分欄
  let m;
  while ((m = re.exec(line))) out.push({ col: m.index, text: m[0] });
  return out;
}

function pushItem(rec, text) {
  const m = text.match(ITEM_RE);
  if (m) rec.items.push({ code: m[1], name: m[2].trim() });
}

function rocToIso(d) {
  const m = String(d).match(/^(\d{3})\/(\d{2})\/(\d{2})$/);
  return m ? (1911 + +m[1]) + '-' + m[2] + '-' + m[3] : '';
}

function floorOf(addr) {
  const fl = [...String(addr).matchAll(/(?:地下)?([0-9一二三四五六七八九十]+)樓/g)].map(m => m[1]);
  if (!fl.length) return '未標示';
  return fl.some(f => f === '1' || f === '一') ? '1樓' : '樓上';
}

// 把一筆登記加上判讀欄位。回傳新物件，不改動原物件。
function classify(rec) {
  const m = rec.addr.match(/^臺南市(.+?區)(.+?里)?(.*)$/) || [];
  const district = m[1] || '';
  const li = m[2] || '';
  const road = ((m[3] || '').match(/^(.+?(?:路|街|大道)(?:[一二三四五六七八九十0-9]+段)?)/) || [])[1] || '';
  const floor = floorOf(rec.addr);
  const real = rec.items.filter(i => i.code !== 'ZZ99999');
  const names = real.map(i => i.name).join('、');
  // 餐飲算「主業」：第一個項目就是餐飲，或登記項目不多（十項以上通常是什麼都先登記）。
  const foodMain = real.length > 0 && KINDS[0][1].test(names) && (KINDS[0][1].test(real[0].name) || real.length < 10);
  const engineering = NAME_ENGINEERING.test(rec.name) ||
    (real.length > 0 && real.filter(i => i.code[0] === 'E').length * 2 >= real.length);
  let kind = '其他';
  for (const [k, re] of KINDS) {
    if (k === '餐飲' && !foodMain) continue;
    if (re.test(names)) { kind = k; break; }
  }
  if (engineering) kind = '工程';
  const onlyOnline = real.length > 0 && real.every(i => /無店面零售/.test(i.name));
  let grade = 'B', why = '';
  if (kind === '工程') { grade = 'C'; why = '工程行'; }
  else if (NAME_UNMANNED.test(rec.name)) { grade = 'C'; why = '無人店'; }
  else if (onlyOnline) { grade = 'C'; why = '只登記網路銷售'; }
  else if (kind === '餐飲') { grade = 'A'; why = '餐飲'; }
  else if (floor === '樓上') { grade = 'C'; why = '樓上且非餐飲'; }
  else if (KINDS[0][1].test(names)) { why = '登記項目多，含餐飲'; }
  return Object.assign({}, rec, {
    dateIso: rocToIso(rec.date), district, li, road, floor, kind, grade, why,
    mine: MY_DISTRICTS.includes(district),
    itemText: real.map(i => i.name).join('、'),
  });
}

module.exports = { MY_DISTRICTS, parseItemText, classify, floorOf, rocToIso };
