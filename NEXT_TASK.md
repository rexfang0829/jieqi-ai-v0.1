# Next Task

## 下一輪優先建議

下一輪仍建議留在 Phase 1 / Phase 1.5，不要直接進 Phase 2。

優先順序：

1. 手機版 UI 可用性檢查
   - 用部署後網址在手機瀏覽器測試。
   - 確認棋盤、按鈕、MoveList、AI 面板、局面編輯器在手機上可操作。
   - 只做必要的 CSS 微調，不做大型 UI 重構。

2. 被吃子區 UI 收斂
   - 目前暗子被吃 / 明子被吃已在棋譜文字與 className 區分。
   - 下一步可做簡單被吃資訊區，讓「暗子翻出什麼」更容易看。

3. Threat Map 威脅圖最小版本
   - 顯示某個候選點是否會被對方下一手攻擊。
   - 明子用 `realType`，暗子用 `originalType`。
   - 只做規則型威脅圖，不做機率推理。

## 不要做哪些超出範圍的事

- 不要做 Belief State。
- 不要做 Monte Carlo。
- 不要做 OCR。
- 不要做 Ponder。
- 不要做自動截圖辨識。
- 不要做雲端同步。
- 不要做大型 UI 重構。
- 不要重寫 AI。
- 不要改成 Next.js。
- 不要加後端。
- 不要加資料庫。
- 不要加登入系統。

## 完成標準

- `npm test` 通過。
- `npm run build` 通過。
- 更新 `CODEX_STATUS.md` 和 `NEXT_TASK.md`。
- 通過後 commit 並 push。
