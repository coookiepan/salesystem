# 測試說明

```bash
cd test
npm install   # 只需第一次（唯一依賴：jsdom）
npm test      # 全套，提交前必須全綠；CI 也跑同一套
```

不需要瀏覽器：測試用 **JSDOM 把整個 `index.html` 真實載入**，再直接呼叫全域函式驗證。
只 stub 外部邊界（`fetch`、`localStorage`、`appConfirm` 對話框），不 mock 內部實作。

## 各檔案職責

| 檔案 | 代號 | 驗什麼 |
|------|------|--------|
| `syntax-check.js` | — | 解析 inline `<script>`、內嵌 `APPS_SCRIPT_CODE`／`IZ_GAS_CODE` 後端、`sw.js`、`izcrm.html`，擋語法錯誤（最快的守門，放第一個） |
| `xss-guard.test.js` | M1/M5 | 掃描未經 `escHtml` 直出 HTML 的使用者欄位（`${c.name}` 這類腳印）；localStorage 配額滿的提示 |
| `gas-getall.test.js` | C4/H1 | 後端逐列容錯：clients 分頁某列 JSON 壞掉要跳過該列並回報列號，不能整批失敗 |
| `outbox.test.js` | C2 | 待推送佇列：斷網入列→持久化→重開 App 自動補送→佇列清空；待推送時拉取要被擋下 |
| `sync.test.js` | M2/M3 | 增量同步合併（upsert／雲端刪除偵測／髒資料退回整碗）；衝突流程兩條路（force 覆蓋／採雲端） |
| `errlog.test.js` | L1 | 診斷紀錄：logErr 持久化、上限 50 筆、未捕捉錯誤自動入錄 |
| `validate.test.js` | L2 | 客戶欄位輕量檢查（統編 8 碼、電話異常字元、空名稱警告） |
| `todo-parse.test.js` | T1 | 待辦自然語言解析 29 案例：日期規則（含跨年／跨月進位、同曜日）、p1–p3 邊界、token 剝除、#客戶比對、一般待辦落點 |
| `a11y.test.js` | L4 | 無障礙底線：`lang`、viewport、img alt、icon-only 按鈕要有標籤、裝飾 SVG aria-hidden |
| `pwa.test.js` | H2 | Service Worker 行為：預快取、離線退回外殼、HTML 網路優先、POST 不攔、Leaflet CDN 快取優先 |
| `izcrm.test.js` | Z1 | 工業區CRM：主檔載入與渲染（XSS）、聚落規則 zoneOf、報價 fw4、LWW 同步合併、CSV 跳脫、seed 匯入冪等、建檔 handoff 寫入＋鏡射 |
| `trip-handoff.test.js` | Z2 | 行程規劃：走廊順路、今天/逾期/未來分組、批次移到今天；主系統消化 handoff 建檔（冪等、進 outbox） |
| `client-views.test.js` | Z3 | 客戶列表視圖：試用回收分組排序、成約待轉交、排序誠實化、已拜訪定義與藥丸數量 |
| `sitemap.test.js` | S1/S2 | 工地地圖：語法（含 GAS_CODE）、登記/60m 重複/離線佇列/LWW/tombstone/XSS、📇 建檔交接端對端（工地→主系統、冪等） |
| `home.test.js` | H3 | 首頁樞紐：接點靜態檢查（start_url/sw/🏠 鈕/#place）、三系統數字鏡射正確性、空狀態、深連結（#daily/#trip/#new） |
| `map-place.test.js` | P1 | 主系統工地地圖模式：FAB→GPS 抓點→拖圖釘→建檔表單→manual 座標入庫；取消路徑與暫存座標不外洩 |

## 寫新測試的慣例

- 沿用 `boot()` 樣板（見 `sync.test.js`）：假 `localStorage`＋`runScripts:'dangerously'` 載入全 App
- 對話框：覆寫 `w.appConfirm = async () => true/false`、`w.appAlert = m => {...}`（原生 `confirm/alert` 已棄用）
- 日期相關純函式請設計成可注入基準日（如 `parseQuickTodo(text, baseDate)`），避免測試隨日曆飄移
- 新檔案記得加進 `package.json` 的 `test` script 串鏈
