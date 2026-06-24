# Codex Status

## 最新完成的工作

2026-06-25 本輪完成 Phase 1 / early AI 小範圍修正：

- 修正大盤揭棋版士 / 仕走法：斜走一格，可以離開九宮。
- 修正大盤揭棋版象 / 相走法：走田字，可以過河，仍保留象眼。
- 暗子未翻開仍依 `originalType`，翻開後依 `realType`；advisor / elephant 都套用揭棋版規則。
- 統一棋子顯示 helper：紅方 cannon 顯示「炮」，黑方 cannon 顯示「包」。
- 棋譜可區分明子被吃與暗子被吃，暗子被吃會顯示翻出的真實棋種。
- `Move` 紀錄新增 `capturedWasHidden` / `captureKind`，保留被吃棋子是否為暗子。
- `simpleAi` 只做小型 helper 命名整理與測試補強，沒有重寫 AI。

## 修改了哪些檔案

- `src/game/moveRules.ts`
- `src/game/checkRules.ts`
- `src/game/gameState.ts`
- `src/game/moveNotation.ts`
- `src/game/pieceText.ts`
- `src/types/chess.ts`
- `src/ai/simpleAi.ts`
- `src/components/Square.tsx`
- `src/components/PositionEditor.tsx`
- `src/components/MoveList.tsx`
- `src/style.css`
- `tests/rules.test.ts`
- `RULES_AND_AI_DESIGN.md`
- `CODEX_STATUS.md`
- `NEXT_TASK.md`

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

- 尚未做 Belief State。
- 尚未做 Monte Carlo。
- 尚未做 OCR / 自動截圖辨識。
- 尚未做 Ponder。
- AI 仍是規則型評分加一層安全檢查，不是完整搜尋或機率推理。
- 被吃子區 UI 尚未整理成天天象棋式資訊區，目前先在棋譜文字與 className 區分。

## 是否已經 push 到 GitHub

是。本輪會以 commit message `fix jieqi movement capture info and cannon labels` push 到 GitHub。
