# Codex Status

## 最新完成的工作

2026-06-25 完成 Phase 1 / Phase 1.5 小範圍 UI 補強：天天象棋式被吃子顯示。

- 黑方吃掉紅子後，被吃紅子顯示在棋盤左上角。
- 紅方吃掉黑子後，被吃黑子顯示在棋盤左下角。
- 被吃子用小圓棋子顯示，不再只靠文字列表。
- 明子被吃會正常顯示棋子字。
- 暗子被吃會顯示翻出的真實棋種，並用半透明小棋子表示原本是暗子。
- 炮 / 包依照被吃棋子的 side 正確顯示。
- 棋盤角落顯示使用 `pointer-events: none`，手機版不擋棋盤操作。
- 舊的文字 CapturedPanel 保留為精簡輔助資訊。
- 順手修復 `App.tsx` 先前因編碼造成的殘破 JSX 文案，避免 build 不穩。

## 修改了哪些檔案

- `src/game/capturedPieces.ts`
  - 整理被吃子資料。
  - 新增 `getCapturedBoardStacks`，提供棋盤左上 / 左下顯示資料。
- `src/components/CapturedBoardOverlay.tsx`
  - 新增棋盤角落小圓棋子 overlay。
- `src/components/Board.tsx`
  - 接收 `moves`，在棋盤內顯示被吃子 overlay。
- `src/components/CapturedPanel.tsx`
  - 改成精簡輔助資訊，避免佔太多空間。
- `src/App.tsx`
  - 傳入 `state.history` 給 Board。
  - 修復殘破 JSX 文案。
- `src/style.css`
  - 新增被吃子角落 overlay、小圓棋子、暗子半透明、手機尺寸樣式。
- `tests/rules.test.ts`
  - 新增紅吃黑進左下、黑吃紅進左上、暗子半透明資料、炮/包 side 顯示、MoveList 資料不破壞測試。

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

- 被吃子顯示是最小版角落小棋子，尚未做拖曳、展開詳情或動畫。
- 舊文字輔助資訊仍使用 history，不做棋譜回放。
- 沒有做首頁、Threat Map、AI VS AI、AI 重寫、後端或資料庫。
- 沒有做 Belief State、Monte Carlo、OCR、Ponder、自動截圖辨識。

## 是否已經 push 到 GitHub

本輪測試與 build 已通過，會依流程 commit 並 push；若看到此版本在 GitHub 上，代表本輪已 push。
