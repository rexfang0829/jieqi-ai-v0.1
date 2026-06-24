# Next Task

## 下一輪目標

建議繼續 Phase 1.5 小範圍工作，不要直接進 Phase 2。

優先二選一：

1. Threat Map 威脅圖最小版本
   - 顯示目前選取棋子走到某點後，是否會被對方下一手攻擊。
   - 只用公開規則資訊：明子用 `realType`，暗子用 `originalType`。
   - 不做 Belief State，不做 Monte Carlo。

2. 被吃子區 UI 收斂
   - 把目前棋譜中的暗子被吃資訊整理得更清楚。
   - 可以加一個簡單被吃紀錄區，區分「明子被吃」與「暗子被吃翻出」。
   - 不做大型 UI 重構。

## 為什麼要做

本輪已經把士 / 象揭棋規則、炮 / 包顯示、暗子被吃資訊補起來。下一步應先把「安全性與資訊顯示」做清楚，讓手動實戰輸入與 AI 推薦更容易判讀。

## 具體要改哪些功能

- 若做 Threat Map：
  - 新增最小 threat helper。
  - UI 只做輕量提示，不改棋盤結構。
  - 補測試確認暗子威脅只用 `originalType`。

- 若做被吃子區 UI：
  - 延伸 `MoveList` 或新增小型 captured info component。
  - 暗子被吃顯示「暗子（翻出X）」。
  - 炮 / 包依 side 顯示。

## 不要做哪些超出範圍的事

- 不要做 Belief State。
- 不要做 Monte Carlo。
- 不要做 OCR。
- 不要做 Ponder。
- 不要做自動截圖辨識。
- 不要做雲端同步。
- 不要重寫 AI。
- 不要大型重構棋盤 UI。

## 完成標準

- `npm test` 通過。
- `npm run build` 通過。
- 更新 `CODEX_STATUS.md` 和 `NEXT_TASK.md`。
- 通過後 commit 並 push。
