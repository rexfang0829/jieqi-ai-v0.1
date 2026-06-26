# NEXT_TASK

## 已完成

- 音效系統（落子聲 + 吃子聲 + 將軍聲 + 絕殺語音）
- 棋盤視覺修正
- 全面介面重組 + 模式切分
- 棋譜管理（initialState 策略、回放、收藏、打譜模式）
- 計時器（10 分鐘對弈鐘 + timeout 棋譜資料）
- AI trace 系統（AiMoveTrace + AiRecommendation）
- 天眼 AI 修正（revealTacticalSuppressed / effectiveCheck）
- AI 收斂修正（edge cannon cap / safe capture priority / repetitive check penalty）
- 人 vs AI 測試對局 MVP
- 一鍵複製 AI 測試報告 MVP（formatAiDebugReport + 複製按鈕）
- 後手翻棋選擇權懲罰（revealChoiceRisk / revealChoicePenalty）
- 公平資訊開局大子活化（majorActivation / openingMajorGoal / opponentRevealSuppression）
- revealChoiceRisk 公平資訊修正（用 publicHiddenReplyThreatValue 取代 hiddenPieceValue，禁止偷看未翻 realType）
- Fair AI Permission Boundary MVP（AiVisibleState / createAiView / recommendMoveFair / hidden realType masking）
  - Human vs AI 與 AI vs AI 已改用 recommendMoveFair
  - 輔助盤面（AiPanel）保留 recommendMoveOracle（Oracle/debug 模式）
- 死車威脅保留 + 暗士翻子卡陣風險 MVP（advisorRevealClogRisk / deadMajorThreatHold / forcedBadDefense）

## 後續優先項目

1. **AI trace 顯示面板**
   - 在人 vs AI 模式或輔助盤面模式中，顯示每個候選步的 trace 詳情
   - 方便調棋力時觀察 score breakdown

2. **Under Attack Rescue MVP（基於 Fair AI view 設計）**
   - 己方大子被攻擊時，優先疏散

3. **forcing reply / forced exchange MVP**
   - 偵測對方攻擊後，AI 優先回防或反將

4. **更完整的 PublicInfo evaluator，逐步移除 visibleStateToMaskedGameState adapter**

5. **Belief State / 剩餘牌池機率**

6. **自我對弈調參 / 訓練資料統計**

7. **中殘局重複局面與長將規則**
   - 三重複局面判和
   - 長將判負
