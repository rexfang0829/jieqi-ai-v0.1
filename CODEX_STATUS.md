# Codex Status

## 最新完成的工作

2026-06-25 完成兩個小階段：

### 階段 2：模式切分

- 新增 App 首頁 / 封面，用 React state 切換模式，不加 router。
- 新增「接棋對弈模式」：
  - 顯示棋盤、AI 建議、同步上一手、長按修正棋種、被吃子資訊、必要棋譜資訊。
  - 不顯示局面編輯與棋譜 JSON 管理工具。
- 新增「打譜模式」：
  - 顯示 GameRecordPanel 與 MoveList。
  - 用於棋譜儲存、載入、複製棋譜文字、匯出 JSON。
  - 本階段不做完整棋譜回放器。
- 新增「AI VS AI 模式」：
  - 只有入口與空狀態頁。
  - 顯示 AI VS AI 尚未啟用。
- 新增「局面編輯 / 測試模式」：
  - 顯示棋盤、PositionEditor、清空棋盤、恢復初始局面、換手方、儲存 / 載入局面等測試工具。
- 每個模式都有回首頁按鈕。
- 沒有改規則引擎、沒有重寫 AI、沒有做 Threat Map。

### 階段 3：手機版整體可用性收斂

- 手機版棋盤改用 viewport 計算格距，降低超出螢幕的機率。
- 手機版棋子尺寸跟著棋盤格距縮放，避免被裁切。
- 模式按鈕、工具列按鈕、棋譜與編輯按鈕加大點擊區。
- AI 面板、MoveList、CapturedPanel、GameRecordPanel、PositionEditor 在手機版不再用過小高度擠壓。
- 長文字使用換行策略，避免撐爆面板。
- 刪除棋譜按鈕改用危險色，視覺上與一般操作區分。

## 修改了哪些檔案

- `src/App.tsx`
  - 新增首頁與四種模式切換。
  - 將既有面板依模式拆分顯示。
- `src/style.css`
  - 新增模式首頁樣式。
  - 補手機版棋盤、面板、按鈕、長文字與危險操作樣式。
- `CODEX_STATUS.md`
  - 更新本輪完成內容。
- `NEXT_TASK.md`
  - 更新下一步建議排序。

## npm test 是否通過

通過。

```bash
npm.cmd test
```

## npm run build 是否通過

通過。

```bash
npm.cmd run build
```

## 目前還有哪些已知限制

- AI VS AI 目前只有入口與空狀態，尚未啟用。
- Threat Map 尚未做。
- 棋譜回放器 MVP 尚未做。
- 沒有做 Belief State、Monte Carlo、OCR、Ponder、自動截圖辨識。
- 沒有加後端、資料庫、登入系統。
- 沒有改成 Next.js。
- 沒有改 board 座標系。
- 沒有重寫 AI。

## 是否已經 push 到 GitHub

階段 2 已 commit：`add app mode selector`。
階段 3 測試與 build 通過後，會 commit 並 push；若看到此版本在 GitHub 上，代表本輪已 push。
