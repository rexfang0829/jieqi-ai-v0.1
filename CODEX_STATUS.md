# Codex Status

## 最新完成的工作

2026-06-25 本輪依照重複提出的「天天象棋式被吃子顯示」需求做確認驗證。

- 功能已在上一個 commit `add board captured piece overlay` 完成。
- 本輪確認黑方吃紅子會進棋盤左上資料。
- 本輪確認紅方吃黑子會進棋盤左下資料。
- 本輪確認被吃子使用小圓棋子 overlay，不只是文字列表。
- 本輪確認明子正常顯示棋子字。
- 本輪確認暗子被吃會顯示翻出的真實棋種，並帶半透明標記資料與樣式。
- 本輪確認炮 / 包依 captured side 正確顯示。
- 本輪確認 overlay 使用 `pointer-events: none`，手機版不擋棋盤操作。
- 本輪確認舊文字 CapturedPanel 已縮成簡短輔助資訊。
- 本輪未做首頁、棋譜回放、Threat Map、AI VS AI、AI 重寫、後端或資料庫。

## 修改了哪些檔案

- `CODEX_STATUS.md`
  - 更新本輪確認結果。
- `NEXT_TASK.md`
  - 保持下一輪小範圍 Phase 1 / Phase 1.5 建議。

本輪沒有再改功能程式碼；被吃子顯示仍由以下檔案提供：

- `src/game/capturedPieces.ts`
- `src/components/CapturedBoardOverlay.tsx`
- `src/components/Board.tsx`
- `src/components/CapturedPanel.tsx`
- `src/style.css`
- `tests/rules.test.ts`

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

- 被吃子顯示是最小版角落小棋子，尚未做動畫或展開詳情。
- 舊文字輔助資訊仍使用 history，不做棋譜回放。
- 沒有做首頁、Threat Map、AI VS AI、AI 重寫、後端或資料庫。
- 沒有做 Belief State、Monte Carlo、OCR、Ponder、自動截圖辨識。

## 是否已經 push 到 GitHub

本輪測試與 build 已通過，會依流程 commit 並 push；若看到此版本在 GitHub 上，代表本輪已 push。
