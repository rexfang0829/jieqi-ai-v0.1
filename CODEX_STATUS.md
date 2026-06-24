# Codex Status

## 最新完成的工作

本輪完成 Phase 1 的「翻子快捷鍵」最小版本。

已完成：

- 選取棋子後可用鍵盤快捷鍵快速設定真實棋種並翻開：
  - `1` = 車
  - `2` = 馬
  - `3` = 象 / 相
  - `4` = 士 / 仕
  - `5` = 炮
  - `6` = 兵 / 卒
- 快捷鍵只作用於目前 selected 的棋子。
- 沒有 selected、selected 是空格、或按下非 1-6 時，不會改動局面。
- 快捷鍵執行後：
  - `realType` 會更新。
  - `revealed` 會變成 `true`。
  - `status` 會回到 `playing`。
  - `originalType` 不會改變。
  - `side` 不會改變。
  - 其他格子不會改變。
- UI 新增提示文字：「翻子快捷鍵：1車 2馬 3象 4士 5炮 6兵」。

## 修改了哪些檔案

- `src/game/boardEditing.ts`
  - 新增 `revealHotkeyType` 與 `revealSelectedByHotkey`。
- `src/App.tsx`
  - 新增鍵盤 `keydown` 監聽。
  - 接上選取棋子的翻子快捷鍵。
  - 新增快捷鍵提示文字。
- `src/style.css`
  - 新增快捷鍵提示樣式。
- `tests/rules.test.ts`
  - 新增測試：
    - `1` 對應 rook。
    - `2` 對應 horse。
    - `3` 對應 elephant。
    - `4` 對應 advisor。
    - `5` 對應 cannon。
    - `6` 對應 pawn。
    - 快捷鍵會讓 `revealed` 變 `true`。
    - 快捷鍵不會改 `originalType`。
    - 快捷鍵不會改 `side`。
    - 快捷鍵不會改其他格子。
    - 空格或沒有 selected 時不會造成錯誤。
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

是。本輪會以 commit message `add reveal hotkeys` push 到 GitHub。
