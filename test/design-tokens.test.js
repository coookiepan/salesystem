// D1 — 設計語彙「量尺」的紅線
//   ① tokens.css 是顏色唯一來源：退役 token 不得殘留、四頁不得寫死 UI 色
//   ② 對比門檻：淺色與深色模式所有「文字 / 底色」組合都 ≥ 4.5:1
//   ③ 急迫度三級的相對亮度要分明（灰階列印、色盲也分得出來）
//   ④ 狀態＝點＋粗字（不是淡底藥丸）、階段軌有九格
//   ⑤ 量尺只量系統真的知道的進度：沒有時鐘就空軌，絕不編造
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const tokensCss = read('tokens.css');
const PAGES = ['index.html', 'home.html', 'izcrm.html', 'sitemap.html'];

let failed = 0;
function assert(name, cond, extra) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : (extra ? ' — ' + extra : '')));
  if (!cond) failed++;
}

// ── 對比計算（WCAG 2.1 relative luminance）──
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
function lum(hex) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
// 從 tokens.css 抓某個 block 裡的所有 --token:#hex
function tokensOf(block) {
  const out = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})\b/g)) out[m[1]] = m[2];
  return out;
}

(async () => {
  console.log('D1 — tokens.css 是顏色唯一來源');

  // 退役 token（2026-10 改版刪掉的）不得在任何地方被引用
  const RETIRED = ['--ss-gray-bg', '--ss-gray-fg', '--ss-blue-bg', '--ss-blue-fg', '--ss-amber-bg',
    '--ss-amber-fg', '--ss-purple-bg', '--ss-purple-fg', '--ss-green-bg', '--ss-green-fg',
    '--ss-green2-bg', '--ss-green2-fg', '--ss-red-bg', '--ss-red-fg', '--amber-d', '--blue-d'];
  const stillUsed = [];
  for (const f of PAGES.concat(['tokens.css', 'nav.js'])) {
    const src = read(f);
    for (const t of RETIRED) if (src.includes(t)) stillUsed.push(f + ':' + t);
  }
  assert('退役 token 完全清掉（不留相容層）', stillUsed.length === 0, stillUsed.join(', '));

  // 新增的 token 一定要在 tokens.css 定義（淺色與深色都要）
  const light = tokensCss.slice(0, tokensCss.indexOf('@media'));
  const dark = tokensCss.slice(tokensCss.indexOf('@media'));
  for (const t of ['--green-lit', '--on-green', '--theme', '--on-theme', '--on-theme-2', '--track']) {
    assert('tokens.css 定義 ' + t + '（淺色＋深色）', light.includes(t + ':') && dark.includes(t + ':'));
  }
  assert('tokens.css 有等寬字族 --font-num', /--font-num:\s*ui-monospace/.test(light));
  assert('不載 webfont（PWA 要能離線）',
    !PAGES.some(f => /fonts\.googleapis\.com|fonts\.gstatic\.com|@font-face/.test(read(f))) &&
    !/fonts\.googleapis\.com|@font-face/.test(tokensCss));

  // UI chrome 不得寫死 hex（文件產出色、logo、地圖圖釘階段色除外，見白名單）
  // 白名單＝有正當理由不走 CSS 變數的：
  //   · 產出文件的顏色（docx/xlsx/canvas 不吃 var()）
  //   · 品牌標誌 SVG 的色塊
  //   · 疊在地圖圖磚上的分類色（不隨深淺模式變）
  //   · getComputedStyle 取不到時唯一的退路值
  const ALLOW = {
    'index.html': ['#1f4e79', '#1f2937', '#D9E1F2', '#BDD7EE', '#F2F2F2', '#FFE699',  // 報價單／合約輸出
                   '#085041', '#EF9F27',                                               // logo-mark SVG
                   '#ffffff',                                                          // canvas 圖卡底色
                   '#5E726A'],                                                         // --pin-fallback 退路
    'home.html': [],
    'izcrm.html': ['#085041'],
    'sitemap.html': ['#EF7C27', '#E0B21C', '#3C8DD9', '#1D9E75', '#6B6B66', '#B0B0AA', // 工地階段（地圖圖磚上）
                     '#8F1A11', '#175A99']                                             // cssColor 退路
  };
  for (const f of PAGES) {
    const src = read(f).replace(/<meta name="theme-color"[^>]*>/g, '');  // PWA 色票不是 CSS
    const bad = [...new Set((src.match(/#[0-9A-Fa-f]{6}\b/g) || []))]
      .filter(h => !ALLOW[f].some(a => a.toLowerCase() === h.toLowerCase()));
    assert(f + ' 沒有未白名單的寫死色', bad.length === 0, bad.join(' '));
  }

  console.log('D1 — 對比門檻 4.5:1（淺色與深色都驗）');
  for (const [mode, block] of [['淺色', light], ['深色', dark]]) {
    const T = tokensOf(block);
    const page = T['--bg2'], card = T['--bg'];
    // 文字層
    for (const [fg, label] of [['--text', '正文'], ['--text2', '次要'], ['--text3', '第三層']]) {
      const onPage = ratio(T[fg], page), onCard = ratio(T[fg], card);
      assert(`${mode} ${label} ${fg} 對頁底 ${onPage.toFixed(2)}:1`, onPage >= 4.5, T[fg] + ' on ' + page);
      assert(`${mode} ${label} ${fg} 對卡片 ${onCard.toFixed(2)}:1`, onCard >= 4.5);
    }
    // 急迫度與強調色：墨色對卡片、墨色對自己的淡底
    for (const k of ['red', 'amber', 'blue']) {
      assert(`${mode} --${k} 對卡片 ${ratio(T['--' + k], card).toFixed(2)}:1`, ratio(T['--' + k], card) >= 4.5);
      assert(`${mode} --${k} 對 --${k}-l ${ratio(T['--' + k], T['--' + k + '-l']).toFixed(2)}:1`,
        ratio(T['--' + k], T['--' + k + '-l']) >= 4.5);
    }
    assert(`${mode} --green-d 對卡片`, ratio(T['--green-d'], card) >= 4.5);
    assert(`${mode} --green-d 對 --green-l`, ratio(T['--green-d'], T['--green-l']) >= 4.5);
    assert(`${mode} --purple-d 對 --purple-l（商品類別）`, ratio(T['--purple-d'], T['--purple-l']) >= 4.5);
    // 主鈕：--on-green 疊在 --green 上（深色模式白字只有 2.4:1，所以要有自己的 token）
    assert(`${mode} 主鈕 --on-green 疊 --green ${ratio(T['--on-green'], T['--green']).toFixed(2)}:1`,
      ratio(T['--on-green'], T['--green']) >= 4.5, T['--on-green'] + ' on ' + T['--green']);
    // 主角區塊
    assert(`${mode} --on-theme 疊 --theme`, ratio(T['--on-theme'], T['--theme']) >= 4.5);
    assert(`${mode} --on-theme-2 疊 --theme`, ratio(T['--on-theme-2'], T['--theme']) >= 4.5);

    // 急迫度三級的亮度要分明：相鄰兩級至少差 2 個百分點
    const steps = [T['--red'], T['--blue'], T['--amber']].map(h => lum(h) * 100).sort((a, b) => a - b);
    const gaps = [steps[1] - steps[0], steps[2] - steps[1]];
    assert(`${mode} 急迫度三級亮度分明（${steps.map(v => v.toFixed(1)).join(' / ')}%）`,
      gaps.every(g => g >= 2), '相鄰差 ' + gaps.map(g => g.toFixed(1)).join(' / '));
  }

  console.log('D1 — 狀態語言與量尺');
  const indexHtml = read('index.html');
  assert('狀態＝點＋粗字（statusPill 不再塞 background）',
    /function statusPill\(t\)\{return`<span class="cc-status" style="color:/.test(indexHtml) &&
    !/\.cc-status\{[^}]*background/.test(indexHtml));
  assert('商品類別保留自己的三個色相（分類≠狀態）',
    /CB_STYLE=\{'拖把':\['var\(--purple-l\)','var\(--purple-d\)'\]/.test(indexHtml));
  assert('量尺 CSS 存在且空軌用 --track', /\.gauge\{[^}]*background:var\(--track\)/.test(indexHtml));
  assert('量尺動效尊重 prefers-reduced-motion',
    /@media\(prefers-reduced-motion:reduce\)/.test(indexHtml) && /@keyframes gaugeDraw/.test(indexHtml));

  // 行為：量尺語意
  const store = {};
  const ls = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }, clear: () => { for (const k in store) delete store[k]; }
  };
  const ymd = d => d.toISOString().slice(0, 10);
  const TODAY = ymd(new Date());
  const ago = n => ymd(new Date(Date.now() - n * 864e5));
  store.duskin_v2 = JSON.stringify({
    clients: [
      { id: 'tr', name: '試用第 7 天', addr: '臺南市新營區中山路1號', status: '試用中', todos: [], visits: [],
        trials: [{ n: 1, start: ago(7), due: ymd(new Date(Date.now() + 7 * 864e5)), items: [], open: true, result: '' }] },
      { id: 'od', name: '試用逾期', addr: '臺南市新營區中山路2號', status: '試用中', todos: [], visits: [],
        trials: [{ n: 1, start: ago(20), due: ago(6), items: [], open: true, result: '' }] },
      { id: 'q', name: '報價中', addr: '臺南市後壁區3號', status: '報價', visits: [],
        todos: [{ text: '追報價', source: 'quote-followup', dueDate: ymd(new Date(Date.now() + 3 * 864e5)), done: false }] },
      { id: 'nv', name: '未拜訪', addr: '臺南市鹽水區4號', status: '未拜訪', todos: [], visits: [] },
      { id: 'dl', name: '已成約', addr: '臺南市鹽水區5號', status: '已成約', todos: [], visits: [],
        contractedItems: [{ product: 'S-20', qty: 1, cycle: '2W', contractDate: ago(3) }] }
    ]
  });
  const dom = new JSDOM(read('index.html'), {
    runScripts: 'dangerously', url: 'https://x.github.io/salesystem/', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
    beforeParse(w) {
      Object.defineProperty(w, 'localStorage', { value: ls, configurable: true });
      w.scrollTo = () => {}; w.fetch = async () => { throw new Error('offline'); };
      w.appConfirm = async () => false; w.appAlert = () => {};
    }
  });
  const w = dom.window;
  await new Promise(r => setTimeout(r, 400));

  const g = id => {
    const c = w.eval('DB.clients').find(x => x.id === id);
    return w.clientGaugeHtml(c);
  };
  const widthOf = html => { const m = html.match(/class="f" style="width:([\d.]+)%/); return m ? Number(m[1]) : 0; };

  assert('試用第 7 / 14 天 → 量尺 50%、刻度 14 格', widthOf(g('tr')) === 50 && g('tr').includes('--tick:7.1429%'));
  assert('試用進行中（還有 7 天）→ 藍', g('tr').includes('--tone:var(--blue)'));
  assert('試用逾期 → 滿格轉紅', widthOf(g('od')) === 100 && g('od').includes('--tone:var(--red)'));
  assert('報價中 → 追蹤倒數（7 格）', g('q').includes('--tick:14.2857%') && widthOf(g('q')) > 0);
  assert('未拜訪 → 空軌（系統沒有時鐘，不編造進度）', widthOf(g('nv')) === 0 && !g('nv').includes('class="f"'));
  assert('已成約 → 滿格綠（時鐘走完了）', widthOf(g('dl')) === 100 && g('dl').includes('--tone:var(--green)'));

  assert('階段軌有九格、當前那格是 .o', (() => {
    const r = w.stageRail('試用中');
    return (r.match(/<i /g) || []).length === 9 && r.includes('class="o"') && (r.match(/class="p"/g) || []).length === 3;
  })());
  assert('狀態色＝急迫度：試用中藍、報價橙、成約綠、拒絕紅、未拜訪無彩度', (() => {
    const t = s => w.statusStyle(s)[1];
    return t('試用中') === 'var(--blue)' && t('報價') === 'var(--amber)' &&
      t('已成約') === 'var(--green-d)' && t('拒絕') === 'var(--red)' && t('未拜訪') === 'var(--text2)';
  })());

  // 客戶卡：底緣就是它自己的量尺
  const cards = [...w.document.querySelectorAll('#clients-list .cc')];
  assert('客戶卡都掛上量尺（.cc-gauge）且留了空間（.has-g）',
    cards.length > 0 && cards.every(c => c.classList.contains('has-g') && c.querySelector('.cc-gauge .gauge')));
  assert('地圖圖釘顏色從 tokens 解析（深色模式也對）',
    /function pinColor\(/.test(indexHtml) && /getComputedStyle\(document\.documentElement\)/.test(indexHtml));

  console.log(failed ? `D1 FAILED ✗ (${failed})` : 'D1 PASSED ✅');
  process.exit(failed ? 1 : 0);
})();
