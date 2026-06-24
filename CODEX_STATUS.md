# Codex Status

## 最新完成的工作

本輪完成 Phase 1 的棋盤視覺改版，參考使用者提供的中國象棋棋盤規格。

已完成：

- 棋盤保留 9 路 x 10 交叉點。
- 上方新增 1 到 9 路線標號。
- 下方新增「九八七六五四三二一」路線標號。
- 楚河漢界文字保持正向顯示。
- 楚河漢界仍是視覺河界，不是可走格子。
- 新增炮位 / 兵卒位的小刻痕標記。
- 加強棋盤外框視覺。
- 棋盤資料仍維持 `board[10][9]`。
- 規則引擎沒有修改。
- AI 邏輯沒有修改。

## 修改了哪些檔案

- `src/components/Board.tsx`
  - 新增上方 / 下方路線標號。
  - 新增外框與兵炮位刻痕 SVG。
- `src/style.css`
  - 新增路線標號、棋盤外框、刻痕樣式。
  - 調整棋盤外觀更接近參考圖。
- `src/game/boardLayout.ts`
  - 新增 `TOP_FILE_LABELS` 與 `BOTTOM_FILE_LABELS`。
- `tests/rules.test.ts`
  - 補測試確認路線標號數量與 9 路一致。
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

是。本輪會以 commit message `refine board reference styling` push 到 GitHub。
