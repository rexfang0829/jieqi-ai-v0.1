# NEXT_TASK.md — 建議下一步

## 已完成 ✅
- 棋盤視覺問題修正、全面介面重組
- 天天象棋式被吃子 UI + 手機版對齊修正
- 棋譜模式三層頁面 UX 重構
- 棋譜 initialState + moves 快照策略
- 落子/吃子/將軍/絕殺統一音效 + 回放音效
- 棋種修正限 editor / ai-master 模式
- 回放局面帶入輔助盤面分析
- 輔助盤面模式 MVP
- AI VS AI 模式 MVP
- 棋譜玩家名稱欄位
- 正式對局自動儲存 + 收藏 + 10 分鐘對弈鐘 MVP
- timeout 修正：真實終局狀態、時間欄位、保留 createdAt/favorited、角落計時器、文案、回放原因 ✅

## 下一步建議（優先順序）

### P1 — 對弈品質
- AI 升級：目前只看一層安全分，可加 minimax 2~3 層
- 揭棋規則邊界：長將判負、困斃判定

### P2 — UX 完善
- 對弈鐘設定：5/10/15 分鐘（目前固定 10 分鐘）
- 棋譜搜尋排序：玩家名稱、結果、日期
- 大師棋譜：內建幾局精彩揭棋

### P3 — 技術
- LocalStorage 容量管理（超限自動刪最舊）
- PWA / 離線支援
- Vercel 部署驗證
# 下一輪建議：AI VS AI MVP 收斂

## 目標
讓 AI VS AI 模式更適合長時間測試規則與 AI 行為，但仍維持 MVP，不做大型 AI 重寫。

## 為什麼要做
本輪已加入第三次重複禁止，下一步適合檢查 AI VS AI 的停止條件、訊息、棋譜保存與基本可觀察性，方便之後測試 Threat Map 或更深層 AI。

## 具體要做
- 檢查 AI VS AI 的開始、暫停、單步、自動播放、到達手數上限、無合法步、無可避免重複等狀態顯示。
- 補 AI VS AI 基礎測試或可抽出的純函式測試。
- 確認 AI VS AI 棋譜保存不破壞現有 GameRecord。

## 不要做
- 不做 Belief State。
- 不做 Monte Carlo。
- 不做 OCR / Ponder / 自動截圖辨識。
- 不做 Threat Map。
- 不重寫 AI。
- 不改 board 座標系。
- 不加後端、資料庫、登入系統。

## 完成標準
- `npm test` 通過。
- `npx tsc --noEmit` 通過。
- 更新 `CODEX_STATUS.md` 與 `NEXT_TASK.md`。
- commit 並 push。
# 下一輪建議：變化線 UX 與 AI 送殺測試收斂

## 目標
在不做大型重構的前提下，讓剛加入的棋譜變化線更好檢查，也讓 AI 戰術層有更多回歸測試。

## 建議工作
- 補一個明確的「避免送對方下一手絕殺」AI 回歸測試局面。
- 變化線列表增加刪除或重新命名之前，先確認現有儲存 / 回放流程穩定。
- 檢查回放變化後返回原棋譜的操作是否足夠清楚。

## 不要做
- 不做完整 minimax。
- 不做 Threat Map。
- 不做 Belief State / Monte Carlo / OCR / Ponder。
- 不做多層巢狀 variation。
- 不加後端、資料庫、登入系統。

## 完成標準
- `npm test` 通過。
- `npx tsc --noEmit` 通過。
- 更新 `CODEX_STATUS.md` 與 `NEXT_TASK.md`。
- commit 並 push。
