# Next Task

## 下一輪建議目標

建議下一輪繼續做 Phase 1 / Phase 1.5 的小範圍補強，不要直接進 Phase 2。

優先順序：

1. 手機版操作提示優化
   - 讓同步上一手、長按修正棋種、快捷鍵提示更直覺。
   - 檢查手機點選、長按、取消流程是否容易誤觸。
2. 棋譜回放器 MVP
   - 從已儲存棋譜逐步查看每一步文字與基本資訊。
   - 若要還原盤面，先做最小版，不要大改架構。
3. Threat Map 威脅圖最小版本
   - 只做規則型威脅圖。
   - 敵方暗子仍只能使用 `originalType`，不可偷看 `realType`。

## 不要做哪些超出範圍的事

- 不要做 Belief State。
- 不要做 Monte Carlo。
- 不要做 OCR。
- 不要做 Ponder。
- 不要做自動截圖辨識。
- 不要重寫 AI。
- 不要做大型 UI 重構。
- 不要改 board[10][9] 座標系。
- 不要改成 Next.js。
- 不要加後端 / 資料庫 / 登入系統。

## 完成標準

- `npm test` 通過。
- `npm run build` 通過。
- 更新 `CODEX_STATUS.md` 與 `NEXT_TASK.md`。
- 通過後 commit 並 push。
