# Next Task

## 下一輪優先建議

仍建議留在 Phase 1 / Phase 1.5，不要直接進 Phase 2。

優先順序：

1. 手機版操作細節優化
   - 用手機實測 Vercel 最新部署網址。
   - 確認棋盤、按鈕、MoveList、AI 面板、局面編輯器、被吃子資訊區可操作。
   - 只做必要 CSS 微調，不做大型 UI 重構。

2. Threat Map 威脅圖最小版本
   - 只做規則型威脅圖。
   - 明子用 `realType`，暗子用 `originalType`。

3. 實戰同步流程提示優化
   - 強化同步上一手的起點 / 終點提示。
   - 不做 OCR，不做自動截圖辨識。

## 不要做哪些超出範圍的事

- 不要做 Belief State。
- 不要做 Monte Carlo。
- 不要做 OCR。
- 不要做 Ponder。
- 不要做自動截圖辨識。
- 不要做大型 UI 重構。
- 不要重寫 AI。
- 不要改 board 座標系。
- 不要改規則引擎。
- 不要改成 Next.js。
- 不要加後端。
- 不要加資料庫。
- 不要加登入系統。

## 完成標準

- `npm install` 完成。
- `npm test` 通過。
- `npm run build` 通過。
- 更新 `CODEX_STATUS.md` 和 `NEXT_TASK.md`。
- 通過後 commit 並 push。
