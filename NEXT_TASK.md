# NEXT_TASK

## 此輪完成
- 修正兩個 AI 實戰漏判問題

### 問題 A：暗兵卒白送偵測不限開局階段
- `pawnSoldierWalksIntoRevealedPawnAttack` 原本被 `pawnSoldierDevelopment` 綁住（需 `isOpeningPhase` 為真）
- 修正：引入 `isUnrevealedPawnMove = isUnrevealedPawnSoldier(move.piece)`（與開局階段無關）
- `pawnSoldierProtectedAfterAdvance` / `pawnSoldierWalksIntoRevealedPawnAttack` 改用 `isUnrevealedPawnMove` 作為 gate
- 開局獎分（`pawnSoldierDevelopmentScore` 等）仍保留 `pawnSoldierDevelopment` 限制

### 問題 B：殘局吃子暗大子回吃風險
- 新增 helper `hiddenMajorCanRecaptureAt`：用 `originalType` 偵測敵方暗車/炮/馬是否能在指定格回吃
- 新增 `hiddenMajorRecaptureRisk` / `unsafeEndgameCapture` / `unsafeCaptureExchangeNet` 三個 trace 欄位
- 新增 `unsafeCapturePenalty(-120)` 權重
- 新增 reason：`'吃子後遭暗大子回吃，交換不利'`
- `formatAiDebugReport` 補充 3 個新 trace 欄位輸出
- 新增 6 個測試（A1~A3 / B1~B3）
- `npx tsc --noEmit` 無錯；`npm test` 全 196 項通過

## 建議下一步
1. AI 開局理論回歸測試擴充。
2. Pattern 觸發日誌 / 統計。
3. AI VS AI 對局資料統計。
4. 自我對弈調參實驗。
5. Belief State / 剩餘池概率推演。
6. Threat Map MVP。

## 非明確指示不要做
- 不改 Board UI。
- 不偷看未翻暗子的 `realType`。
- 不加後端或資料庫。

---

# NEXT_TASK

## 此輪完成
- Human vs AI 新增「回到上一步」（悔棋）功能
- `UndoEntry` 型別：儲存 gameState / past / aiAnnotations / lastAiInfo 快照
- `undoStack`：每次玩家或 AI 落子前 push snapshot
- 悔棋邏輯：
  - 最後一手為 AI（humanSide 回合）→ 退 2 步，回到玩家可重新決策的局面
  - 最後一手為玩家（aiSide 回合）→ 退 1 步
- AI 效果新增 `current.turn !== aiSide` guard，防止 undo 期間 400ms timer 誤觸
- 「回到上一步」按鈕：disabled 邏輯為 `undoStack.length < undoStepsNeeded`
- lastMove highlight 隨悔棋正確還原
- 新增 4 個測試
- `npx tsc --noEmit` 無錯；`npm test` 全 184 項通過

## 建議下一步
1. AI 開局理論回歸測試擴充。
2. Pattern 觸發日誌 / 統計。
3. AI VS AI 對局資料統計。
4. 自我對弈調參實驗。
5. Belief State / 剩餘池概率推演。
6. Threat Map MVP。

## 非明確指示不要做
- 不改 Board UI。
- 不偷看未翻暗子的 `realType`。
- 不加後端或資料庫。

---

# NEXT_TASK

## 此輪完成
- 新增中殘局目標 heuristic MVP：修正 AI VS AI 無意義來回和棋
- `endgamePlanActive`：開局後（history.length > 12）自動啟動
- 新增 6 個加分：`towardEnemyKing(25)` / `restrictKingMobility(45)` / `attackPalaceGuard(35)` / `improveMajorActivity(20)` / `passedPawnAdvance(30)` / `createNonCheckingThreat(40)`
- 新增 1 個懲罰：`avoidAimlessMove(-80)`：無明確中殘局目標時扣分
- 新增 helper：`chebyshevDist` / `isPalaceGuardPiece` / `isMajorActivePiece` / `enemyPalaceCenter` / `computeEndgamePlan`
- 新增 8 個 trace 欄位 + `endgamePlanScore`（共 9 個）
- `formatAiDebugReport` 補充 9 個新 trace 欄位輸出
- 新增 7 個 reason strings（中文）
- 新增 8 個測試
- `npx tsc --noEmit` 無錯；`npm test` 全部通過

## 建議下一步
1. AI 開局理論回歸測試擴充。
2. Pattern 觸發日誌 / 統計。
3. AI VS AI 對局資料統計。
4. 自我對弈調參實驗。
5. Belief State / 剩餘池概率推演。
6. Threat Map MVP。

## 非明確指示不要做
- 不改 Board UI。
- 不偷看未翻暗子的 `realType`。
- 不加後端或資料庫。

---

# NEXT_TASK

## 此輪完成
- 修正 AI VS AI 來回連將 / 重複殺卡死問題
- 擴充 detectRepetitiveCheck 至所有棋子類型（車、炮、馬等）
- 新增 detectRepeatedCheckingCycle：偵測 A→B, B→A, A→B 來回模式
- 需求 B：硬性抑制—無成果連將時強制轉換其他手
- 需求 C：修正 getPositionKey 未翻暗子不偷看 realType（公平資訊鍵值）
- 需求 D：AI VS AI 同一局面出現 4 次則判定和棋（重複局面和棋訊息）
- 新增 2 個權重：repeatedCheckingCyclePenalty(-300) / repeatedPositionPenalty(-250)
- 新增 4 個 trace 欄位：repeatedCheckingCycle / repeatedPositionRisk / repetitiveCheckSuppressed / repetitionCount
- formatAiDebugReport 補充 4 個新 trace 欄位輸出
- 新增 8 個測試

## 建議下一步
1. AI 開局理論回歸測試擴充。
2. Pattern 觸發日誌 / 統計。
3. AI VS AI 對局資料統計。
4. 自我對弈調參實驗。
5. Belief State / 剩餘池概率推演。
6. Threat Map MVP。

## 非明確指示不要做
- 不改 Board UI。
- 不偷看未翻暗子的 realType。
- 不加後端或資料庫。

---

# NEXT_TASK

## 此輪完成
- 修正暗兵卒白送偵測：`pawnSoldierWalksIntoRevealedPawnAttack`
- 新增 helper `isSquareAttackedByRevealedPawn`：偵測已翻敋兵卒是否攻擊指定格
- 新增 2 個權重：`pawnSoldierWalksIntoRevealedPawnAttackPenalty(-120)` / `pawnSoldierDevelopmentSuppressedByPawnAttackPenalty(-80)`
- 新增 4 個 trace 欄位：`pawnSoldierWalksIntoRevealedPawnAttack` / `pawnSoldierSelfSacrifice` / `pawnSoldierProtectedAfterAdvance` / `pawnSoldierDevelopmentSuppressedByPawnAttack`
- `formatAiDebugReport` 補免 4 個新 trace 欄位輸出
- 修正舊測試：象相 follow-up 測試的 blocker 擺動位置（避免新懲罰誤觸發）
- 新增 3 個測試

## 建議下一步
1. AI 開局理論回歸測試擴充。
2. Pattern 觸發日誌 / 統計。
3. AI VS AI 對局資料統計。
4. 自我對弈調參實驗。
5. Belief State / 剩餘池概率推演。
6. Threat Map MVP。

## 非明確指示不要做
- 不改 Board UI。
- 不偷看未翻暗子的 `realType`。
- 不加後端或資料庫。

---

# NEXT_TASK

## 此輪完成
- 修正明大子戰術優先級：安全吃明車/炮 > 暗兵卒開發 > 死車保留
- 新增 `revealedMajorCaptureAvailable` / `safeRevealedMajorCapture` / `revealedMajorCaptureScore` trace 欄位
- `deadMajorThreatHold` 有安全吃大子時抑制，不再給保留獎分
- `pawnSoldierDelayedByMajorCapture` 有明大子可吃時暗兵卒開發扣分 (-80)
- `formatAiDebugReport` 補免 6 個新 trace 欄位
- 新增 5 個測試；修正舊 1 個測試反映新行為

## 建議下一步
1. AI 開局理論回歸測試擴充。
2. Pattern 觸發日誌 / 統計。
3. AI VS AI 對局資料統計。
4. 自我對弈調參實驗。
5. Belief State / 剩餘池概率推演。
6. Threat Map MVP。

## 非明確指示不要做
- 不改 Board UI。
- 不偷看未翻暗子的 `realType`。
- 不加後端或資料庫。

---

# NEXT_TASK

## Completed this round
- Prioritized pawn-soldier development over early pure blind-horse activation.
- Added pawn-soldier pressure on revealed major pieces.
- Added pawn-soldier follow-up heuristics for revealed pawn-origin horse / elephant / advisor.
- Added pure blind-horse activation trace, cap, and penalty while pawn soldiers are still undeveloped.
- Updated AI debug report to print pawn-soldier, pure blind-horse, and loose-hidden-piece trace fields.
- Fixed Fair AI first move to prefer 1 / 3 / 7 / 9 hidden pawn openings over blind hidden horse activation.
- Aligned AiPanel main recommendation with `recommendMoveFair`; Oracle is now Debug comparison only.
- Added first-move Fair AI trace fields and regression tests.
- Added post-move loose hidden piece MVP evaluation.
- Added trace fields for loose hidden piece count, protected-under-attack count, rescue, ignore, and penalty.
- Added weights for loose-piece penalty, rescue bonus, protected-under-attack cap, and activation cap.
- Tightened regression tests for unprotected hidden pawn rescue, ignored loose hidden pawn, and defended hidden piece pressure.

## Suggested next tasks
1. AI opening theory regression expansion.
2. Pattern trigger logging / statistics.
3. AI VS AI game data statistics.
4. Self-play tuning experiments.
5. Belief State / remaining pool probability.
6. Threat Map MVP.

## Do not do unless explicitly requested
- Do not change Board UI.
- Do not change moveNotation.
- Do not change gameEngine / checkRules.
- Do not weaken Fair AI permission boundaries.
- Do not peek at unrevealed `realType`.
- Do not add backend or database.

---

# NEXT_TASK

## 已完成

- 音效系統（落子聲 + 吃子聲 + 將軍聲 + 絕殺語音）
- 棋盤視覺修正
- 全面介面重組 + 模式切分
- 棋譜管理（initialState 策略、回放、收藏、打譜模式）
- 計時器（10 分鐘對弈鐘 + timeout 棋譜資料）
- AI trace 系統（AiMoveTrace + AiRecommendation）
- 天眼 AI 修正（revealTacticalSuppre