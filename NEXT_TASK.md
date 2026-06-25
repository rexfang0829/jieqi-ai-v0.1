# Next Task（Claude / Codex / ChatGPT 共用）

> 此文件供所有 AI 工具共用，不只 Codex 使用。
> 完成某項後請更新此文件，並在 CODEX_STATUS.md 記錄細節。

## 下一步建議排序

1. **輔助盤面模式 MVP**
   - 目前只有空狀態頁。
   - 建議：整合 AI 分析，讓使用者輸入/匯入盤面後，AI 給出最佳下一步建議。

2. **AI VS AI 模式**
   - 目前尚未啟用。

3. **棋譜玩家名稱欄位**
   - `GameRecord` 加 `redPlayer?: string`、`blackPlayer?: string`。
   - 儲存時可輸入雙方名稱，回放頁顯示。

4. **收藏功能**
   - `GameRecord` 加 `favorited?: boolean`。
   - 列表頁加星號按鈕，棋譜庫首頁「我的收藏」顯示有內容。

## 不做

- 不做 Belief State、Monte Carlo、OCR、Ponder。
- 不加後端、資料庫、登入。
- 不改成 Next.js。
- 不改 board 座標系。
- 不重寫 AI。
- 不做大型 UI 重構。

## 完成標準

- `npm test` 通過。
- `npm run build` 通過（沙盒 rollup 限制例外，Vercel 正常即可）。
- 更新 `CODEX_STATUS.md` 與 `NEXT_TASK.md`。
- commit 並 push。
