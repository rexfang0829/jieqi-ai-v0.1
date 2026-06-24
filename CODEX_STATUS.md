# Codex Status

## 最新完成的工作

本輪完成 Phase 1 的楚河漢界規格修正，讓棋盤更貼近使用者提供的中國象棋參考圖。

已完成：

- 河界不再是額外拉開的距離。
- 棋盤 10 條橫線改回等距視覺。
- 楚河漢界是第 4 排與第 5 排交叉點之間那一格的斷線區。
- 河界區域內沒有直線穿過。
- 楚河漢界文字放在該格中，保持正向顯示。
- 棋盤資料仍維持 `board[10][9]`。
- 楚河漢界仍不是可走格子。
- 規則引擎沒有修改。
- AI 邏輯沒有修改。

## 修改了哪些檔案

- `src/components/Board.tsx`
  - 移除額外 river offset。
  - SVG viewBox 回到 10 條橫線等距規格。
- `src/style.css`
  - 移除額外 `river-gap`。
  - 河界文字改放在第 4、5 排之間的標準格距中。
- `src/game/boardLayout.ts`
  - `visualRowForBoardRow` 改回資料 row 對應視覺 row，不新增額外 row。
- `tests/rules.test.ts`
  - 更新河界測試，確認 visual row 不新增額外 row。
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

是。本輪會以 commit message `fix river board spacing` push 到 GitHub。
