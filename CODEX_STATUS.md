# Codex Status

## 最新完成的工作

本輪完成 Phase 1 的「手動同步上一手」最小版本。

已完成：

- UI 新增「同步上一手」按鈕。
- 開啟後進入 sync mode。
- sync mode 下第一次點棋盤交叉點 = 起點。
- sync mode 下第二次點棋盤交叉點 = 終點。
- 第二次點完後，系統使用現有 `applyMove` / 規則流程嘗試套用。
- 合法同步步會正常：
  - 移動棋子
  - 吃子
  - 翻子
  - 換手
  - 更新 history
  - 更新 status
- 成功後退出 sync mode，清空 sync 起點與 selected。
- 非法同步步不改變 board / turn / status / history。
- 非法時顯示「這一步不合法，未套用」。
- 起點選取後會有藍色高亮。
- 可用「取消同步」離開 sync mode，取消不改變局面。

## 修改了哪些檔案

- `src/game/lastMoveSync.ts`
  - 新增 `syncLastMove`，包裝現有 `applyMove` 套用 from/to。
  - 新增 `cancelLastMoveSync`，作為取消同步的資料層 no-op。
- `src/App.tsx`
  - 新增 sync mode 狀態、按鈕、提示文字、起點/終點點選流程。
  - 成功同步後清空 selected 並退出 sync mode。
  - 非法同步時保留 sync mode 並顯示錯誤。
- `src/components/Board.tsx`
  - 支援 `syncFrom` 起點標示。
- `src/components/Square.tsx`
  - 新增 sync 起點 class。
- `src/style.css`
  - 新增 sync 起點高亮與同步提示樣式。
- `tests/rules.test.ts`
  - 新增同步上一手測試：
    - 合法 from/to 可以套用。
    - 成功後 turn 正確切換。
    - 成功後 history 增加。
    - 非法同步不改變局面。
    - 非法同步不增加 history。
    - 取消同步不改變 board / turn / status。
- `CODEX_STATUS.md`
  - 更新本輪狀態。
- `NEXT_TASK.md`
  - 更新下一輪建議任務。

## npm test 是否通過

通過。

執行指令：

```bash
npm.cmd test
```

## npm run build 是否通過

通過。

執行指令：

```bash
npm.cmd run build
```

## 目前還有哪些已知限制

- 手動同步只支援使用者點起點 / 終點，不做 OCR 或自動截圖。
- AI 只有一層安全評估，不是完整搜尋。
- 目前只支援單一局面儲存，不支援多局面管理。
- `history` 載入時會重設為空陣列。
- 尚未完整實作雙方資訊不對稱。
- 尚未做 Belief State。
- 尚未做 Monte Carlo。
- 尚未做 OCR。
- 尚未做 Ponder。
- 尚未做自動截圖辨識。

## 是否已經 push 到 GitHub

是。本輪會以 commit message `add manual last move sync` push 到 GitHub。
