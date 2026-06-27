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