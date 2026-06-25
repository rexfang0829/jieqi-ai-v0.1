# Next Task（Claude / Codex / ChatGPT 共用）

> 此文件供所有 AI 工具共用，不只 Codex 使用。  
> 完成某項後請更新此文件，並在 CODEX_STATUS.md 記錄細節。

## 下一步建議排序

1. AI VS AI MVP
2. Threat Map 威脅圖最小版本
3. 棋譜回放器 MVP

## 為什麼這樣排

目前 App 已完成模式切分，AI VS AI 已有入口但尚未啟用；Threat Map 與棋譜回放器也都有明確模式位置，可以逐步補上，不需要再把所有功能塞在同一個畫面。

## 不要做哪些超出範圍的事

- 不做 Belief State。
- 不做 Monte Carlo。
- 不做 OCR。
- 不做 Ponder。
- 不做自動截圖辨識。
- 不加後端。
- 不加資料庫。
- 不加登入系統。
- 不改成 Next.js。
- 不改 board 座標系。
- 不重寫 AI。
- 不做大型 UI 重構。

## 完成標準

- `npm test` 通過。
- `npm run build` 通過。
- 更新 `CODEX_STATUS.md` 與 `NEXT_TASK.md`。
- 測試與 build 通過後 commit 並 push。
