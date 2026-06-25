# Codex Status

## 最新完成的工作

2026-06-25 本輪完成 Phase 1.5 小範圍補強：手動修正棋種、暗子池一致性、音效。

- 新增 piece inventory / remaining pool 檢查。
  - 每方棋種上限：帥/將 1、士 2、象 2、車 2、馬 2、炮/包 2、兵/卒 5。
  - 手動修正 `realType` 前會檢查同方棋種數量。
  - 超標時阻擋修改，UI 顯示提示，不會默默造成不合法盤面。
- 新增手機版長按修正棋種。
  - 長按棋盤上的棋子可開啟修正選單。
  - 大按鈕包含：車、馬、相/象、仕/士、炮/包、兵/卒。
  - 點選後只改該棋子的 `realType`，並設 `revealed=true`。
  - 不改 `side`，不破壞鍵盤 1-6 快捷鍵。
  - 長按後會阻止一般點選 / 走棋觸發。
- 新增音效 helper。
  - 成功走棋後播放一次簡短落子音效。
  - 不合法點擊、只選棋子、局面編輯不播放落子音效。
  - 絕殺音效改成「咻——嘣」風格。
  - 絕殺音效仍由既有 helper 控制，同一局只播放一次。
  - 手機瀏覽器若阻擋音效，不會讓畫面報錯。
- 沒有改規則引擎主流程。
- 沒有改 AI 搜尋。
- 沒有做 Threat Map / Belief State / Monte Carlo / OCR / Ponder。

## 修改了哪些檔案

- `src/game/pieceInventory.ts`
  - 新增棋種數量上限、剩餘數量、超標驗證 helper。
- `src/game/boardEditing.ts`
  - 編輯棋種前套用 inventory 驗證。
  - 新增長按修正使用的 `correctSelectedRealType` helper。
- `src/game/soundEffects.ts`
  - 新增落子音效與成功走棋音效觸發判斷。
- `src/game/endgameSound.ts`
  - 調整絕殺音效為掃頻加低頻終局感。
- `src/App.tsx`
  - 接上長按修正選單、超標提示、成功走棋落子音效。
- `src/components/Board.tsx`
  - 傳遞交叉點長按事件。
- `src/components/Square.tsx`
  - 支援長按，並避免長按後觸發一般 click。
- `src/components/PositionEditor.tsx`
  - 顯示棋種超標錯誤提示。
- `src/style.css`
  - 新增長按修正選單與錯誤提示樣式。
- `tests/rules.test.ts`
  - 補上 inventory、長按修正 helper、音效觸發 helper 測試。
- `CODEX_STATUS.md`
  - 更新本輪狀態。
- `NEXT_TASK.md`
  - 更新下一輪建議。

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

## 目前已知限制

- 長按修正目前是最小版選單，尚未做更完整的手機操作引導。
- 棋譜回放器尚未做。
- Threat Map 尚未做。
- Belief State / Monte Carlo / OCR / Ponder 尚未做。

## 是否已經 push 到 GitHub

本輪測試與 build 通過後，會以 commit `add manual piece correction inventory and sounds` push 到 GitHub。
