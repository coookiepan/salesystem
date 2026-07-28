// H3 首頁樞紐（home.html）：唯讀鏡射三系統 localStorage 的數字正確性、
//    空狀態、XSS 轉義、深連結（index.html#daily / #trip）、整合接點靜態檢查。
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const root = path.join(__dirname, '..');
const homeHtml = fs.readFileSync(path.join(root, 'home.html'), 'utf8');
const mainHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const smHtml = fs.readFileSync(path.join(root, 'sitemap.html'), 'utf8');
const izHtml = fs.readFileSync(path.join(root, 'izcrm.html'), 'utf8');
const swJs = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));

let failed = 0;
const assert = (name, cond) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name); if (!cond) failed++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

function boot(html, store, url) {
  const vc = new VirtualConsole(); vc.on('jsdomError', () => {});
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: url || 'https://x.github.io/salesystem/home.html', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      Object.defineProperty(w, 'localStorage', {
        value: {
          getItem: k => (k in store ? store[k] : null),
          setItem: (k, v) => { store[k] = String(v); },
          removeItem: k => { delete store[k]; },
          clear: () => { for (const k in store) delete store[k]; }
        }, configurable: true
      });
      w.scrollTo = () => {};
      w.fetch = async () => { throw new Error('offline'); };
    }
  });
  return dom.window;
}

(async () => {
  console.log('H3 — 整合接點靜態檢查');
  assert('manifest start_url 指向首頁', manifest.start_url === './home.html');
  assert('sw 預快取 home.html', swJs.includes("'./home.html'"));
  assert('主系統底部導覽有 🏠 首頁', mainHtml.includes('id="nav-home"') && mainHtml.includes("location.href='home.html'"));
  assert('工地地圖底部導覽有 🏠 首頁', smHtml.includes('id="nav-home"'));
  assert('工業區CRM 底部導覽有 🏠 首頁', izHtml.includes("location.href='home.html'"));
  assert('工地地圖支援 #place 深連結', smHtml.includes("location.hash==='#place'") && smHtml.includes('startPlaceGPS'));
  assert('home 註冊 Service Worker、連 manifest', /serviceWorker.+register\(\s*['"]sw\.js['"]/s.test(homeHtml) && homeHtml.includes('rel="manifest"'));

  console.log('H3 — 有資料：數字正確');
  const now = new Date();
  const TODAY = ymd(now);
  const yesterday = ymd(new Date(now.getTime() - 864e5));
  const d20 = ymd(new Date(now.getTime() - 20 * 864e5));
  const in3 = ymd(new Date(now.getTime() + 3 * 864e5));
  const store = {
    duskin_v2: JSON.stringify({
      clients: [
        { id: 'a', name: '阿霞小吃<img src=x>', addr: '臺南市永康區中華路1號', status: '試用中', trialDate: d20, nextdate: TODAY, visits: [{ date: TODAY }], todos: [{ text: 'x', dueDate: TODAY, done: false }] },
        { id: 'b', name: '逾期店', addr: '東區裕農路2號', status: '報價', nextdate: yesterday, visits: [] },
        { id: 'c', name: '成約店', addr: '仁德區', status: '已成約', contractedItems: [{ product: 'X', contractDate: TODAY }], visits: [] }
      ],
      gtodos: [{ text: 'g', dueDate: yesterday, done: false }],
      profile: { contact: '秉均' },
      sheetUrl: 'https://script.google.com/macros/s/X/exec'
    }),
    duskin_outbox: JSON.stringify([{ key: 'save:a' }]),
    sitemap_v1: JSON.stringify({
      sites: [
        { id: 's1', stage: '施工中', openDate: in3, created: Date.now() },
        { id: 's2', stage: '已拜訪', created: 1 },
        { id: 's3', stage: '裝潢收尾', deleted: true, created: 1 }
      ],
      cfg: { url: 'https://script.google.com/macros/s/Y/exec' }, queue: []
    }),
    izcrm_v1: JSON.stringify({ records: { f1: { visitPlan: { date: TODAY } }, f2: {} }, gasUrl: '', dirty: {} })
  };
  const w = boot(homeHtml, store);
  await wait(200);
  const txt = id => w.document.getElementById(id).textContent;
  assert('今日行程 = 1', txt('t-count') === '1' && txt('s-trip') === '1');
  assert('路線副標帶行政區', txt('t-route').includes('永康區'));
  assert('逾期 = 1（紅條顯示）', txt('s-od') === '1' && w.document.getElementById('t-overdue').style.display === 'flex');
  assert('試用該收 = 1（20 天）', txt('s-trial') === '1');
  assert('今日待辦 = 2（客戶 1 + 全域逾期 1）', txt('s-todo') === '2');
  assert('本週成果：拜訪 1・成約 1', txt('w-visits') === '1' && txt('w-deals') === '1');
  assert('問候帶姓名', txt('h-greet').includes('秉均'));
  assert('行程站點轉義 HTML 店名（XSS）', w.document.getElementById('t-stops').innerHTML.includes('&lt;img') && !w.document.getElementById('t-stops').innerHTML.includes('<img src=x'));
  assert('客戶管理卡：3 位客戶・試用中 1', txt('a-main').includes('3 位客戶') && txt('a-main').includes('試用中 1'));
  assert('工地卡：待開幕 1（tombstone 不計）・本週可拜訪 1', txt('a-site').includes('待開幕 1') && txt('a-site').includes('本週可拜訪 1'));
  assert('工業區卡：有紀錄 2・待訪 1', txt('a-iz').includes('有紀錄 2') && txt('a-iz').includes('待訪 1'));
  assert('同步狀態：主系統 1 筆待推', w.document.getElementById('h-syncs').textContent.includes('1 筆待推'));

  console.log('H3 — 空狀態：全新使用者不會看到壞畫面');
  const w2 = boot(homeHtml, {});
  await wait(200);
  const t2 = id => w2.document.getElementById(id).textContent;
  assert('數字全 0、不炸', t2('t-count') === '0' && t2('s-od') === '0' && t2('s-trial') === '0');
  assert('行程空狀態給指引', w2.document.getElementById('t-stops').textContent.includes('客戶管理'));
  assert('同步狀態顯示未設定', w2.document.getElementById('h-syncs').textContent.includes('未設定'));

  console.log('H3 — 主系統深連結');
  const s3 = { duskin_v2: JSON.stringify({ clients: [] }) };
  const m = boot(mainHtml, s3, 'https://x.github.io/salesystem/index.html#daily');
  await wait(500);
  assert('#daily → 日報分頁開啟', m.document.getElementById('panel-daily').classList.contains('on') && !m.document.getElementById('panel-clients').classList.contains('on'));
  assert('hash 消化後清掉（重整不再跳）', !m.location.hash);
  const m2 = boot(mainHtml, { duskin_v2: JSON.stringify({ clients: [] }) }, 'https://x.github.io/salesystem/index.html#trip');
  await wait(500);
  assert('#trip → 待辦（行程規劃）分頁開啟', m2.document.getElementById('panel-todos').classList.contains('on') && !m2.document.getElementById('panel-clients').classList.contains('on'));
  assert('#trip → 直接是行程規劃視圖（非待辦清單）', m2.document.getElementById('todos-mode-trip').style.display === 'block');
  const m3 = boot(mainHtml, { duskin_v2: JSON.stringify({ clients: [] }) }, 'https://x.github.io/salesystem/index.html#new');
  await wait(700);
  assert('#new → 新增客戶表單開啟', (m3.document.getElementById('form-title').textContent || '').includes('新增'));

  console.log(failed ? 'H3 FAILED ✗ (' + failed + ')' : 'H3 PASSED ✅');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('  ✗ exception:', e); process.exit(1); });
