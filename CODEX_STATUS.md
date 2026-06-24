# Codex Status

## 最新完成的工作

本輪完成 Phase 1 的「手動設定輪到哪方」最小版本。

已完成：

- UI 新增「輪到」下拉選單。
- 可手動切換 `turn` 為紅方或黑方。
- 切換 turn 後 `status` 會回到 `playing`。
- 切換 turn 後 `selected` 會清空，避免選取狀態錯亂。
- 切換 turn 後 undo 歷史會清空，採用穩定簡單做法。
- 切換 turn 後 board 不會被改動。
- 切換 turn 後仍可繼續走棋、編輯局面、儲存局面、載入局面。

## 修改了哪些檔案

- `src/game/boardEditing.ts`
  - 新增 `setTurn`，用於手動切換目前輪到哪方，並讓 `status` 回到 `playing`。
- `src/App.tsx`
  - 新增「輪到」下拉選單。
  - 切換 turn 時清空 `selected` 與 undo 歷史。
- `src/style.css`
  - 新增 turn selector 的簡單樣式。
- `tests/rules.test.ts`
  - 新增測試：
    - 可以切換到紅方。
    - 可以切換到黑方。
    - 切換 turn 後 `status` 回到 `playing`。
    - 切換 turn 後不破壞 board。
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
- 尚未建立翻子快捷鍵。
- 尚未建立天天象棋手動同步流程。
- 尚未做 Belief State。
- 尚未做 Monte Carlo。
- 尚未做 OCR。
- 尚未做 Ponder。
- 尚未做自動截圖辨識。

## 是否已經 push 到 GitHub

是。本輪會以 commit message `add manual turn selector` push 到 GitHub。
