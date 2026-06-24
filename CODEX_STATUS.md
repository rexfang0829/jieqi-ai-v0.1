# Codex Status

## 最新完成的工作

本輪完成 Phase 1 的「局面儲存 / 載入」最小版本。

已完成：

- UI 新增「儲存目前局面」按鈕。
- UI 新增「載入已儲存局面」按鈕。
- 使用 `localStorage` 保存單一局面。
- 儲存內容包含：
  - `board`
  - `turn`
  - `status`
- 載入時 `history` 會重設為空陣列。
- 載入後會清空 `selected`，避免選取狀態錯亂。
- 載入後會清空 `past` / undo 歷史。
- localStorage 不存在、沒有資料、JSON 壞掉、資料格式不合法時，程式不會壞掉。

## 修改了哪些檔案

- `src/game/positionStorage.ts`
  - 新增局面儲存格式、序列化、還原、localStorage 安全讀寫。
- `src/App.tsx`
  - 新增「儲存目前局面」與「載入已儲存局面」按鈕。
  - 載入局面後重設 `selected` 與 undo 歷史。
- `tests/rules.test.ts`
  - 新增儲存/載入測試：
    - GameState 可轉成儲存格式。
    - 儲存格式可還原成 GameState。
    - 載入後 `status` / `turn` / `board` 正確。
    - localStorage 不存在時不會壞掉。
    - 壞掉 JSON 不會壞掉。
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
- 尚未提供 UI 手動切換輪到紅方/黑方，仍主要依走棋流程決定。
- 尚未完整實作雙方資訊不對稱。
- 尚未建立翻子快捷鍵。
- 尚未建立天天象棋手動同步流程。
- 尚未做 Belief State。
- 尚未做 Monte Carlo。
- 尚未做 OCR。
- 尚未做 Ponder。
- 尚未做自動截圖辨識。

## 是否已經 push 到 GitHub

是。本輪會以 commit message `add local position save and load` push 到 GitHub。
