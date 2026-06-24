# Codex Status

## 最新完成的工作

本輪完成 Phase 1 的棋盤視覺微調：縮窄楚河漢界的河界間距，讓中路吃子的距離感更接近天天象棋參考圖。

已完成：

- 楚河漢界視覺空白變窄。
- 棋子仍站在 9 x 10 交叉點。
- 棋盤資料仍維持 `board[10][9]`。
- 楚河漢界仍不是可走格子。
- 規則引擎沒有修改。
- AI 邏輯沒有修改。

## 修改了哪些檔案

- `src/components/Board.tsx`
  - 將 SVG 棋線的河界視覺比例從 0.75 調整為 0.42。
- `src/style.css`
  - 將桌面河界間距從 48px 調整為 27px。
  - 將手機河界間距從 32px 調整為 18px。
  - 略微縮小楚河漢界文字與字距，避免文字擠壓棋子。
- `CODEX_STATUS.md`
  - 更新本輪狀態。
- `NEXT_TASK.md`
  - 保留下一輪建議任務。

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

- AI 只有一層安全評估，不是完整搜尋。
- 目前只支援單一局面儲存，不支援多局面管理。
- `history` 載入時會重設為空陣列。
- 尚未完整實作雙方資訊不對稱。
- 尚未建立天天象棋手動同步流程。
- 尚未做 Belief State。
- 尚未做 Monte Carlo。
- 尚未做 OCR。
- 尚未做 Ponder。
- 尚未做自動截圖辨識。

## 是否已經 push 到 GitHub

是。本輪會以 commit message `tighten river spacing` push 到 GitHub。
