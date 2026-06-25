# Next Task（Claude / Codex / ChatGPT 共用）

> 此文件供所有 AI 工具共用，不只 Codex 使用。
> 完成某項後請更新此文件，並在 CODEX_STATUS.md 記錄細節。

## 下一步建議排序

1. **棋譜回放：真正的盤面還原**
   - 目前回放頁的棋盤已可根據步數顯示局面，但 `applyMove` 依賴合法走法驗證，揭棋初始全暗的盤面重播需要驗證是否每步都能正確還原。
   - 建議：在回放頁加「回放步驟是否正確還原」的視覺提示，或改用直接套用 board snapshot 的方式。

2. **棋譜回放：儲存時加入紅黑雙方名稱欄位**
   - `GameRecord` 目前沒有玩家名稱欄位。
   - 建議：在 `GameRecord` 加 `redPlayer?: string`、`blackPlayer?: string`，在棋譜回放頁顯示。

3. **收藏功能**
   - 在棋譜列表頁加收藏按鈕，`GameRecord` 加 `favorited?: boolean`。
   - 棋譜庫首頁「我的收藏」就能顯示有內容。

4. **輔助盤面模式 MVP**
   - 目前只有空狀態頁。
   - 建議：整合 AI 分析，讓使用者輸入/匯入盤面後，AI 給出最佳下一步。

5. **AI VS AI 模式**
   - 目前尚未啟用。

## 不要做哪些超出範圍的事

- 不做 Belief State、Monte Carlo、OCR、Ponder。
- 不加後端、資料庫、登入系統。
- 不改成 Next.js。
- 不改 board 座標系。
- 不重寫 AI。
- 不做大型 UI 重構。

## 完成標準

- `npm test` 通過。
- `npm run build` 通過（或確認沙盒限制、Vercel 正常）。
- 更新 `CODEX_STATUS.md` 與 `NEXT_TASK.md`。
- commit 並 push。
