# 開發慣例（給 Claude / 維護者）

DUSKIN 銷售系統是單檔 PWA，幾乎所有程式都在 `index.html`（內嵌 JS）。
改code前先讀 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)（內有 index.html 區段地圖、資料模型、同步協定）。

## 📚 文件分工（改完功能記得改對應文件）

| 檔案 | 對象 | 內容 |
|------|------|------|
| `README.md` | 第一次看到 repo 的人 | 專案入口：功能、架構總覽、快速開始 |
| `GUIDE.md` | 非技術使用者 | 從零設定教學、功能說明、FAQ |
| `CHANGELOG.md` | 使用者 | 版本更新紀錄（白話「你會感覺到什麼」） |
| `docs/ARCHITECTURE.md` | 開發者 | 資料模型、同步機制、程式區段地圖、發版流程 |
| `test/README.md` | 開發者 | 各測試檔職責、寫新測試的慣例 |
| `CLAUDE.md` | Claude／維護者 | 本檔：慣例與紅線 |

## ⚠️ 每次更新都要更新版本號

**每一次有實質改動（修 bug / 加功能）都必須同步更新版本號**，三個地方一起改：

1. **App 版本**：`index.html` 的 `const APP_VERSION='vYYYY.MM.DD-xN';`
   - 格式：`v年.月.日-` ＋ 類別字母（如 `c`＝contract、`m`/`l`＝既有系列）＋ 流水號。
   - 線上版本檢查靠這行（`^const APP_VERSION=…;`），格式不可破壞。
2. **PWA 快取**：`sw.js` 的 `const CACHE = 'duskin-shell-vN';`（每次發版 +1，確保使用者拿到新 shell）。
3. **更新紀錄**：`CHANGELOG.md` 最上方新增一段，用白話寫「使用者會感覺到什麼」。
   - 若動到 `APPS_SCRIPT_CODE`（內嵌後端），必須標註「需重新部署後端」並附 GUIDE.md 對應步驟連結。

> 純文件改動（README/docs/…）不需要 bump 版本；動到 `index.html`／`sw.js` 才需要。
> App 內「設定 → 版本資訊」會顯示 `APP_VERSION`；上線會比對線上版本提示更新。

## 測試

- `cd test && npm test`（syntax-check / xss / sync / outbox / a11y / pwa…）必須全綠才提交。各檔職責見 [test/README.md](test/README.md)。
- 純函式可用 `index.html` 內 `?test=1` 區塊；合約 builder 可用 docx 套件在 Node 抽函式驗證並產出實檔核對。
- 測試裡 stub 對話框用 `w.appConfirm = async()=>true`／`w.appAlert = m=>{...}`（原生 `alert/confirm` 已全面棄用，勿再使用）。

## UI 紅線

- 顏色一律用 `:root` CSS 變數（含 JS 產生的 inline style）——深色模式靠變數覆寫，寫死 hex 會在深色模式爆版。
- 提示一律用 `showToast`（非阻斷）／`appAlert`／`appConfirm`（危險操作帶 `danger:true` 紅鈕）。

## 合約製作（ContractMaker 模組，index.html）

- 報價單走原單一表單；**合約走「📑 產生合約」分步精靈**（公版 DUSKIN商品租賃契約書）。
- 合約分 A（無特製地墊，6 欄）/ B（含特製地墊，9 欄）型；附帶事項為公版逐字原文，**勿任意改寫排版**。
- 商品表算法：更換週期 1/2/4 週→每4週換 4/2/1 次；契約單價＝每次更換單價；4W租賃金額＝契約單價×次數×數量；遺失賠償費單價＝每件4W金額×5。
