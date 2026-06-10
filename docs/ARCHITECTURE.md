# 技術架構

> 給開發者／維護者的深入文件。使用者請看 [GUIDE.md](../GUIDE.md)；開發慣例請看 [CLAUDE.md](../CLAUDE.md)。

## 目錄

1. [設計理念](#設計理念)
2. [系統組成](#系統組成)
3. [index.html 內部地圖](#indexhtml-內部地圖)
4. [資料模型](#資料模型)
5. [同步機制（outbox／增量／衝突）](#同步機制)
6. [後端：內嵌 Apps Script](#後端內嵌-apps-script)
7. [PWA 與快取策略](#pwa-與快取策略)
8. [UI 系統](#ui-系統)
9. [測試架構](#測試架構)
10. [發版流程](#發版流程)

---

## 設計理念

三個前提決定了所有架構選擇：

1. **使用者非技術背景**——部署、更新、備份都必須「照著做就會」。
2. **外勤情境**——隧道裡、地下室、收訊差的工業區，App 必須離線完整可用。
3. **零預算**——不租伺服器、不買資料庫。

因此：

| 選擇 | 原因 |
|------|------|
| 單一 `index.html`（無框架、無 build） | 部署＝上傳一個檔案；更新檢查＝比對一行 `APP_VERSION` 字串；永遠不會「build 壞了」 |
| `localStorage` 為主資料庫 | 離線完整讀寫；容量對單一業務員的客戶量綽綽有餘 |
| Google Sheets 當雲端後端 | 免費、使用者看得懂自己的資料、主管能直接開試算表看 |
| Apps Script 程式碼**內嵌在前端** | 使用者「複製 → 貼上 → 部署」即完成後端，不用碰 git |
| outbox 待推送佇列 | 收訊差時的寫入絕不能默默消失 |

---

## 系統組成

```mermaid
flowchart TB
  subgraph Phone["📱 手機（GitHub Pages 載入）"]
    direction TB
    SW["sw.js — Service Worker<br/>App 外殼快取（離線可開）"]
    APP["index.html — 單檔 App"]
    subgraph Storage["localStorage"]
      V2[("duskin_v2<br/>clients/inventory/products/gtodos<br/>+ sheetUrl + 同步時間戳")]
      OB[("duskin_outbox<br/>待推送操作佇列")]
      EL[("duskin_errlog<br/>最近 50 筆診斷紀錄")]
    end
    APP <--> Storage
  end
  subgraph Google["☁️ 使用者自己的 Google 帳號"]
    GAS["Apps Script Web App<br/>doPost/doGet + LockService"]
    SHEETS[("試算表<br/>clients｜inventory｜products｜shops")]
    GAS <--> SHEETS
  end
  APP -- "POST JSON（save/delete/getAll…）" --> GAS
  CDN["unpkg CDN：Leaflet 1.9.4（SRI 鎖定，SW 快取）"] -.-> APP
  OSM["OpenStreetMap 圖磚 / Nominatim + Google Geocoder（經 GAS 代理）"] -.-> APP
```

---

## index.html 內部地圖

整個 App 約 7,900 行，依序分為四大塊。每個區段都有 `═══` 橫幅註解，可用搜尋直接跳轉：

```
index.html
├─ <style>（~25–530 行）
│   DESIGN TOKENS（CSS 變數：品牌色/語意色/狀態徽章色票，含深色模式覆寫）
│   BASE / FORM CONTROLS / BUTTONS / CARD / BADGE / TODO / MOOD / PILL
│   ALERT / TABLE / MODAL / APP TOAST·DIALOG / TODO QUICK-ADD / NAVIGATION
│   MAP / CONTRACT-MAKER（cm-*）
│
├─ <body>（~530–1410 行）
│   六個 .panel（clients/daily/todos/shops/inventory/settings）
│   ＋共用 modal（狀態篩選、商品、庫存、待辦、版本選單、dedup、admin）
│   ＋報價精靈（#cm-modal）與合約精靈（#cm-wiz）全頁 overlay
│
└─ <script>（~1410–7900 行，單一 script，搜尋「═══」橫幅導覽）
    APPS SCRIPT CODE      內嵌後端原始碼（字串常數，供一鍵複製部署）
    預設商品資料           DEFAULT_PRODUCTS / INV_INIT / BUNDLE_MAP 配件規則
    STATE & PERSISTENCE   STATUS 常數、DB、saveLocal/loadLocal、錯誤紀錄、outbox
    SYNC                  api()/autoSync()/flushOutbox()/syncFromSheet()/衝突處理
    NAV                   navTo() 分頁切換
    PRODUCTS PANEL        商品資料庫 CRUD
    MIGRATION             啟動時資料不變式檢查與自動修正
    DEDUP                 重複店家掃描／合併（含雲端清理）
    全域 UI               showToast / appAlert / appConfirm / 全域 Esc 關 modal
    SHOPS / PROSPECTS     查詢頁（既有客戶＋工業區名單，一鍵建檔）
    CLIENT LIST / MAP     列表（分頁渲染）與 Leaflet 地圖（geocode 佇列）
    CLIENT FORM / DETAIL  建檔表單精靈、詳情頁（拜訪/品項/待辦）
    DAILY / REPORT        日報與 4W 推進表產生器
    GLOBAL TODOS          Todoist 式：parseQuickTodo 解析器＋分區清單
    EXPORT / VERSION      JSON 備份、版本檢查（輪詢線上 APP_VERSION）
    ADMIN DASHBOARD       ?admin=1 長官唯讀彙總
    INIT                  啟動序：載資料→migration→render→自動同步
    CONTRACTMAKER 模組    報價單/合約 .docx 產生器（IIFE 模組，docx 套件 CDN 懶載入）
    TEST MODE             ?test=1 純函式自我測試
```

---

## 資料模型

所有資料以 JSON 形式存於 `localStorage.duskin_v2`，結構如下：

```js
{
  clients: [Client], inventory: [Item], products: [Product], gtodos: [Todo],
  sheetUrl, prospectsUrl, lastSyncAt, lastPullAt, pending
}
```

### Client（客戶，同步雲端 clients 分頁）

```js
{
  id,                    // UUID（crypto.randomUUID，雲端 upsert 的 key）
  name, addr, type, status,        // status ∈ STATUS 常數表（未拜訪…拒絕）
  contact, phone, regNo,           // regNo＝統一編號（工業區名單身分鍵）
  nextdate, trialDate, env, note,
  lat, lng, geocodeSource,         // 地圖定位（manual / geocode_ok / failed）
  trialItems:      [{product, qty, cycle, quoted, bundledTo?, bundleRole?}],
  contractedItems: [{…同上, contractDate}],
  visits: [{date, mood(1-4), note, insight, statusChange, nextdate}],
  todos:  [Todo],
  updatedAt,             // 本機最後修改（衝突偵測比對值）
  srvAt                  // 雲端已確認版本的時間戳（同步基準）
}
```

### Todo（待辦）

```js
{ text, dueDate:'YYYY-MM-DD'|'', done, priority?:1|2|3 }
```

掛在客戶下的 todo 隨客戶同步雲端；**未掛客戶**的存 `DB.gtodos`（僅本機，含於 JSON 匯出）。

### Product／Inventory

```js
Product: { code, cat:'拖把'|'地墊'|'芳香', desc, price, cycle:'2W'|'4W', note, active }
Item:    { name(=product code), stock, std(標準配備數), cat }
```

`BUNDLE_MAP` 定義主商品自動附帶的免費配件（如 S-20 → SHB 拖把頭）與芳香機口味選擇規則。

### 金額算法（唯一入口 `displayFw4`）

更換週期 1/2/4 週 → 每 4 週更換 4/2/1 次；**4W 金額＝契約單價 × 次數 × 數量**；遺失賠償費單價＝每件 4W 金額 × 5。

---

## 同步機制

### Outbox：寫入永不丟失

```mermaid
sequenceDiagram
  participant U as 使用者
  participant A as App
  participant O as outbox(localStorage)
  participant G as Apps Script
  U->>A: 儲存客戶
  A->>O: enqueueOp('save', client)（先持久化）
  A->>G: flushOutbox：逐筆 POST
  alt 成功
    G-->>A: {ok}
    A->>O: 出列，記下 srvAt
  else 斷網/失敗
    A->>O: 整列保留（重開 App 自動補送）
  else 雲端較新（conflict）
    G-->>A: {conflict, server}
    A->>U: 對話框：「用我的版本 / 保留雲端」
    U-->>A: 選擇
    A->>G: force 重送 或 採用雲端版本後出列
  end
```

要點：

- **同 key 收斂**：同一客戶連續修改只保留最新一筆 op，避免重複送
- **嚴格 FIFO**：佇列頭失敗就整體暫停，保證順序性（delete 不會跑到 save 前面）
- **拉取防護**：`syncFromSheet` 前先 flush；若還有未上傳修改則拒絕拉取，避免被雲端覆蓋

### 增量拉取（M2）

本機資料「乾淨」（每筆有 id）且非首次拉取時，帶 `since=lastPullAt` 只拉有更動的列；回傳同時附完整 id 清單，用於偵測雲端已刪除的列。任何不乾淨狀態自動退回整碗拉取。

### 衝突偵測（M3）

每次 save 帶上 `client.srvAt`（上次雲端確認的版本）；後端比對該列現有 `updatedAt`，較新則回 `{conflict, server}` 不寫入。兩種解法（覆蓋／放棄）都會讓佇列前進，不會卡死或靜默覆蓋。

---

## 後端：內嵌 Apps Script

後端原始碼以字串常數 `APPS_SCRIPT_CODE` 內嵌在 index.html（設定頁「複製 Apps Script 程式碼」按鈕的來源），語法由測試層獨立驗證。

| Action | 功能 |
|--------|------|
| `ping` | 連線測試 |
| `getAll` (`since?`) | 全量或增量拉取 clients（逐列容錯：壞 JSON 列跳過並回報列號） |
| `save` (`client`, `force?`) | upsert 單筆＋衝突偵測；`LockService` 20 秒鎖防並行寫入互蓋 |
| `delete` / `deleteByName` | 刪除（後者供 dedup 清理雲端同名列） |
| `saveInventory` / `getInventory` | 庫存整包讀寫 |
| `saveProducts` / `getProducts` | 商品整包讀寫 |
| `getShops` | 查詢頁的公司既有客戶名單 |
| `geocode` | Google Geocoder 代理（地圖定位主來源，免金鑰；失敗退 Nominatim） |

> ⚠ 後端程式碼變動屬「需要使用者重新部署」的更新——CHANGELOG 必須標註，並附 GUIDE.md 的重新部署步驟連結。

---

## PWA 與快取策略

`sw.js`（策略註解在檔頭）：

| 資源 | 策略 | 原因 |
|------|------|------|
| HTML 文件 | **網路優先**，離線退快取 | 上線一定拿到最新程式 |
| 同網域靜態資源 | 快取優先 | 外殼秒開 |
| Leaflet CDN（unpkg，SRI 鎖版本） | 快取優先 | 離線也能載入地圖程式庫 |
| Apps Script POST、地圖磚 | **完全不攔** | 寫入不可重播快取；圖磚本質需連線 |

版本更新雙保險：
1. `sw.js` 的 `CACHE = 'duskin-shell-vN'` 每次發版 +1 → activate 時清舊快取
2. App 內 `checkForUpdate()` 輪詢線上 index.html 的 `APP_VERSION` 行，發現新版顯示更新橫幅

---

## UI 系統

- **設計 tokens**：所有顏色/字級/圓角/陰影都是 `:root` CSS 變數，深色模式以 `prefers-color-scheme` 覆寫同名變數——**JS 產生的 HTML 也必須引用變數**，不可寫死 hex（測試會抓部分情況，review 時留意）
- **狀態色票**：`SS_STYLE`／`CB_STYLE` 以 `var(--ss-*)` 引用，雙色票（淺/深）定義在 tokens 區
- **對話框**：原生 `alert/confirm` 已全面棄用，改用 `appAlert()`／`appConfirm()`（Promise-based、Esc/背景可關、danger 紅鈕）與非阻斷 `showToast()`；測試 stub 時覆寫 `w.appConfirm` 即可
- **設計系統**：[design-system/](../design-system/README.md) 內有 tokens 文件、元件預覽 HTML 與可瀏覽的 UI kit，供設計工具或重建畫面時參照

---

## 測試架構

`cd test && npm test`——Node + JSDOM，**把整個 index.html 真實載入後操作全域函式**，不需要瀏覽器。各檔案職責見 [test/README.md](../test/README.md)。

設計原則：

- **守門優先**：語法、XSS、a11y、PWA 是「永遠不准退步」的底線，跑得快、放最前面
- **資料層全真**：outbox／同步／衝突用 JSDOM 全 App 實測，不 mock 內部函式，只 stub `fetch` 與 `appConfirm`
- **純函式抽測**：如 `parseQuickTodo(text, baseDate)` 接受基準日參數，測試可重現

---

## 發版流程

1. 開發、自測，`cd test && npm test` 全綠
2. **三處同步改版本**（缺一不可，詳見 [CLAUDE.md](../CLAUDE.md)）：
   - `index.html`：`const APP_VERSION='vYYYY.MM.DD-xN';`（此行格式不可破壞，線上版本檢查靠 regex 比對）
   - `sw.js`：`CACHE = 'duskin-shell-vN'` +1
   - `CHANGELOG.md`：最上方新增白話說明（使用者視角）
3. PR → CI 全綠 → merge → GitHub Pages 自動部署
4. 若動到 `APPS_SCRIPT_CODE`：CHANGELOG 標註「需重新部署後端」並附操作連結
