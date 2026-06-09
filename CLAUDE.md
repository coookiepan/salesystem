# 開發慣例（給 Claude / 維護者）

DUSKIN 銷售系統是單檔 PWA，幾乎所有程式都在 `index.html`（內嵌 JS）。

## ⚠️ 每次更新都要更新版本號

**每一次有實質改動（修 bug / 加功能）都必須同步更新版本號**，三個地方一起改：

1. **App 版本**：`index.html` 的 `const APP_VERSION='vYYYY.MM.DD-xN';`
   - 格式：`v年.月.日-` ＋ 類別字母（如 `c`＝contract、`m`/`l`＝既有系列）＋ 流水號。
   - 線上版本檢查靠這行（`^const APP_VERSION=…;`），格式不可破壞。
2. **PWA 快取**：`sw.js` 的 `const CACHE = 'duskin-shell-vN';`（每次發版 +1，確保使用者拿到新 shell）。
3. **更新紀錄**：`GUIDE.md` 的「版本更新紀錄（給使用者）」最上方新增一段，用白話寫「使用者會感覺到什麼」。

> App 內「設定 → 版本資訊」會顯示 `APP_VERSION`；上線會比對線上版本提示更新。

## 測試

- `cd test && npm test`（syntax-check / a11y / xss / pwa…）必須全綠才提交。
- 純函式可用 `index.html` 內 `?test=1` 區塊；合約 builder 可用 docx 套件在 Node 抽函式驗證並產出實檔核對。

## 合約製作（ContractMaker 模組，index.html）

- 報價單走原單一表單；**合約走「📑 產生合約」分步精靈**（公版 DUSKIN商品租賃契約書）。
- 合約分 A（無特製地墊，6 欄）/ B（含特製地墊，9 欄）型；附帶事項為公版逐字原文，**勿任意改寫排版**。
- 商品表算法：更換週期 1/2/4 週→每4週換 4/2/1 次；契約單價＝每次更換單價；4W租賃金額＝契約單價×次數×數量；遺失賠償費單價＝每件4W金額×5。
