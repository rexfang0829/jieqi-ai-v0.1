# Next Task

## 下一輪目標

建議下一輪繼續 Phase 1，做「手動設定輪到哪方」的最小版本。

## 為什麼要做

現在已經可以手動建立棋盤，也可以儲存 / 載入局面。不過從天天象棋手動抄盤時，還需要指定目前輪到紅方或黑方，否則推薦走法和合法步提示可能會看錯方。

## 具體要改哪些功能

建議範圍：

- 在 UI 加上「輪到紅方 / 輪到黑方」切換。
- 切換 turn 後：
  - `state.turn` 正確更新。
  - `selected` 清空。
  - undo 歷史可保留或清空，採用較簡單且穩定的做法即可。
  - `status` 回到 `playing`，避免卡在勝負狀態。
- 新增測試確認：
  - 可以把 turn 改成紅方。
  - 可以把 turn 改成黑方。
  - 修改 turn 後 status 回到 `playing`。

## 不要做哪些超出範圍的事

本任務不要做：

- Belief State
- Monte Carlo
- OCR
- Ponder
- 自動截圖辨識
- 雲端同步
- 多局面管理
- 大型重構

## 完成標準

- UI 能手動設定目前輪到哪方。
- 手動設定後可繼續走棋、編輯、儲存、載入。
- `npm test` 通過。
- `npm run build` 通過。
- 更新 `CODEX_STATUS.md` 與 `NEXT_TASK.md`。
- 測試與 build 通過後 commit 並 push。
