### 2026-06-27 困斃（無合法棋步）結束時播放絕殺音效（Claude）

**目標**：輪到一方卻無合法棋步（困斃），應判對方勝、設定 `status`、播放 `playEndgameSound()`。

**修改檔案**：

1. **`src/game/gameState.ts`**：`applyMove` 改用 `getAllLegalMoves(board, nextTurn).length === 0` 取代 `isCheckmate`，純困斃亦正確設定勝者 status。

2. **`src/game/checkRules.ts`**：新增 `isStalemate(board, side)` 與 `winnerWhenNoLegalMoves(side)` 工具函式。

3. **`src/App.tsx`**：
   - 新增 `aiVsAiLastStatusRef`
   - `aiVsAiStep()` / 自動播放 interval：`r.move === null` 時設定困斃勝者 status、顯示勝利訊息、播放音效。
   - AI VS AI 結束效果加入 `shouldPlayEndgameSound` 音效觸發。

4. **`src/components/HumanVsAiPanel.tsx`**：AI 步驟觸發 `r.move === null` 時防禦性設定困斃勝者 status。

5. **`tests/rules.test.ts`**：新增 S1–S4 四個困斃測試；修正 reveal-choice-risk-fair-info 測試（紅王改置宮內 col=3，原 col=0 在宮外致困斃誤判）。

**驗收**：`npx tsc --noEmit` 乾淨，stalemate S1–S4 全過，reveal-choice-risk-fair-info 修正通過。

---

### 2026-06-27 修正邊 G / 邊路明車壓力時馬守兵線被蓋過（Claude）

**目標**：當邊路明車（G）壓制兵線時，AI 應優先活馬守線（馬8進7 類），而非普通暗兵卒開發。

**新增 / 修改檔案**：

1. **`src/ai/simpleAi.ts`**：
   - `structurePatternEvaluation` 回傳新增 `horsePawnLineGuard` 欄位
   - `releasedHorseFromPressure` 納入 `horsePawnLineGuard`（馬守兵線也是目的性應手）
   - 新增 `edgeRookPressure` 計算
   - `pureBlindHorseActivation` 新增 `!structure.horsePawnLineGuard` 排除
   - 新增 `horsePawnLineGuardEdgeRookBonus`：馬走好守格且邊路受車壓 +80
   - 新增 `pawnSoldierDelayedByEdgeRookPressure`：邊路受車壓下普通暗兵卒開發 -90
   - 新增 reason：`邊路明車壓兵線，優先活馬守線` / `邊 G 壓力下，延後普通暗兵卒開發`
   - `MoveEvaluation` 新增 3 個欄位

2. **`src/ai/aiWeights.ts`**：
   - 新增 `horsePawnLineGuardEdgeRookBonus: 80`
   - 新增 `pawnSoldierDelayedByEdgeRookPressurePenalty: -90`

3. **`src/ai/aiTrace.ts`**：
   - 新增 3 個 trace 欄位：`edgeRookPawnLineLockRisk` / `horsePawnLineGuard` / `pawnSoldierDelayedByEdgeRookPressure`

4. **`src/ai/aiDebugReport.ts`**：
   - `fmtTrace` 補充 3 個新欄位輸出

5. **`tests/rules.test.ts`**：
   - 新增 3 個測試（C1~C3 驗證邊路車壓力點）

**測試**：`npm test` 全 199 項通過；`npx tsc --noEmit` 無錯。

---

### 2026-06-27 修正暗兵卒白送偵測與暗大子回吃風險（Claude）

**目標**：修正兩個 AI 實戰漏判問題。

**新增 / 修改檔案**：

1. **`src/ai/simpleAi.ts`**：
   - 問題 A：引入 `isUnrevealedPawnMove`（與開局無關），解除 `pawnSoldierWalksIntoRevealedPawnAttack` 對 `isOpeningPhase` 的依賴
   - 問題 B：新增 `hiddenMajorCanRecaptureAt` helper（用 `originalType` 偵測暗車/炮/馬回吃能力）
   - 新增 `hiddenMajorRecaptureRisk` / `unsafeEndgameCapture` / `unsafeCaptureExchangeNet` 邏輯
   - 新增 `unsafeCapturePenalty` 到分數公式
   - 新增 reason `'吃子後遭暗大子回吃，交換不利'`
   - 新增 3 個 `MoveEvaluation` 欄位 + 3 個 traces 欄位

2. **`src/ai/aiWeights.ts`**：
   - 新增 `unsafeCapturePenalty: -120`

3. **`src/ai/aiTrace.ts`**：
   - 新增 3 個 trace 欄位：`hiddenMajorRecaptureRisk` / `unsafeEndgameCapture` / `unsafeCaptureExchangeNet`

4. **`src/ai/aiDebugReport.ts`**：
   - `fmtTrace` 補充 3 個新欄位輸出

5. **`tests/rules.test.ts`**：
   - 新增 6 個測試（A1~A3 驗證開局外暗兵卒邏輯，B1~B3 驗證暗大子回吃 trace）

**測試**：`npm test` 全 196 項通過；`npx tsc --noEmit` 無錯。

---

## 最新完成的工作

### 2026-06-27 Human vs AI 悔棋（undo）MVP（Claude）

**目標**：Human vs AI 模式新增「回到上一步」按鈕，方便 AI 調參測試。

**新增 / 修改檔案**：

1. **`src/components/HumanVsAiPanel.tsx`**：
   - 新增 `UndoEntry` 型別：`{ gameState, past, aiAnnotations, lastAiInfo }`
   - 新增 `undoStack` state + `undoStackRef`
   - 新增 `lastAiInfoRef`（供 AI timeout callback 讀取）
   - 玩家落子（`click()`）前 push undo snapshot
   - AI 落子（setTimeout callback）前 push undo snapshot
   - AI callback 新增 `current.turn !== aiSide` guard（防止 undo 後 timer 誤觸）
   - 新增 `handleUndo()`：計算 stepsBack（humanSide turn=2, aiSide turn=1），還原所有 state + refs，setAiThinking(false)
   - 新增 `undoDisabled` 計算：`undoStack.length < undoStepsNeeded`
   - 新增「回到上一步」按鈕（disabled 時不可點）
   - `startGame()` / `restart()` 清除 `undoStack`

2. **`tests/rules.test.ts`**：
   - 新增 4 個悔棋邏輯測試

**測試**：`npm test` 全 184 項通過；`npx tsc --noEmit` 無錯。

---

### 2026-06-27 中殘局目標 heuristic MVP（Claude）

**目標**：修正 AI VS AI 無意義來回重複和棋，新增中殘局方向性評分。

**新增 / 修改檔案**：

1. **`src/ai/aiWeights.ts`**：
   - 新增 7 個權重：`towardEnemyKingBonus(25)` / `restrictKingMobilityBonus(45)` / `attackPalaceGuardBonus(35)` / `improveMajorActivityBonus(20)` / `passedPawnAdvanceBonus(30)` / `createNonCheckingThreatBonus(40)` / `avoidAimlessMovePenalty(-80)`

2. **`src/ai/aiTrace.ts`**：
   - 新增 9 個 trace 欄位：`endgamePlanActive` / `towardEnemyKing` / `restrictKingMobility` / `attackPalaceGuard` / `improveMajorActivity` / `passedPawnAdvance` / `createNonCheckingThreat` / `avoidAimlessMove` / `endgamePlanScore`

3. **`src/ai/simpleAi.ts`**：
   - 新增 helper：`chebyshevDist` / `isPalaceGuardPiece` / `isMajorActivePiece` / `enemyPalaceCenter`
   - 新增 `EndgamePlan` 型別與 `computeEndgamePlan()` 函式
   - `evaluateMove` 整合 `computeEndgamePlan`，加分加入總分
   - `reasonFor` 新增 7 個中文 reason strings
   - traces 新增 9 個 endgame 欄位

4. **`src/ai/aiDebugReport.ts`**：
   - `fmtTrace` 補充 9 個新欄位輸出

5. **`tests/rules.test.ts`**：
   - 新增 8 個測試：endgamePlanActive / towardEnemyKing / restrictKingMobility / attackPalaceGuard / passedPawnAdvance / createNonCheckingThreat / avoidAimlessMove / debug report 欄位名稱

**測試**：`npm test` 全部通過；`npx tsc --noEmit` 無錯。

---


## Task #122 — 修正 AI VS AI 來回連將 / 重複殺卡死問題
**Status**: ✅ Done  
**Files changed**:
- `src/game/repetitionRules.ts` — 修正 getPositionKey 未翻暗子用 originalType；新增 isRepetitionDraw
- `src/ai/aiWeights.ts` — 新增 repeatedCheckingCyclePenalty / repeatedPositionPenalty
- `src/ai/aiTrace.ts` — 新增 4 個 trace 欄位
- `src/ai/simpleAi.ts` — 擴充 detectRepetitiveCheck；新增 detectRepeatedCheckingCycle；Need B 硬性抑制
- `src/ai/aiDebugReport.ts` — 補充 4 個新 trace 欄位輸出
- `src/App.tsx` — AI VS AI 第 4 次重複局面判定和棋
- `tests/rules.test.ts` — 新增 8 個測試

### 2026-06-27 暗兵卒白送偵測（Claude）

**目標**：修正 AI 推薦暗兵卒走入已翻敵方兵卒攻擊範圍（白送）的問題。

**新增/修改檔案**：

1. **`src/ai/aiWeights.ts`**：
   - 新增 2 個權重：`pawnSoldierWalksIntoRevealedPawnAttackPenalty: -120` / `pawnSoldierDevelopmentSuppressedByPawnAttackPenalty: -80`

2. **`src/ai/aiTrace.ts`**：
   - 新增 4 個 trace 欄位：`pawnSoldierWalksIntoRevealedPawnAttack` / `pawnSoldierSelfSacrifice` / `pawnSoldierProtectedAfterAdvance` / `pawnSoldierDevelopmentSuppressedByPawnAttack`

3. **`src/ai/simpleAi.ts`**：
   - 新增 helper `isSquareAttackedByRevealedPawn(board, bySide, target)`：遍歷 bySide 已翻兵卒的合法棋步，判斷 target 格是否在攻擊範圍內
   - 評分：暗兵卒走入已翻敵方兵卒攻擊 → 扣 -120（基本）+ -80（開發延後）
   - 有己方棋子保護目標格時 (`pawnSoldierProtectedAfterAdvance`) 不扣分
   - reason strings：`'暗兵卒走入已翻兵卒攻擊，已降分'` / `'暗兵卒白送，開發延後'`

4. **`src/ai/aiDebugReport.ts`**：
   - `fmtTrace` 補免 4 個新欄位輸出

5. **`tests/rules.test.ts`**：
   - 修正舊測試「象相 follow-up 偏好中兵」blocker 從 row 5 改 row 6（避免新懲罰誤觸發）
   - 新增 3 個測試：暗兵卒走入攻擊計分 / 有保護則不扣分 / debug report 含新欄位名稱

**測試**：`npm test` 全部通過；`npx tsc --noEmit` 無錯。

---

## 最新完成的工作

### 2026-06-27 明大子戰術優先級修正（Claude）

**目標**：修正 AI 優先級，確保安全吃明大子 > 暗兵卒開發 > 死車保留威脅。

**新增/修改檔案**：

1. **`src/ai/aiWeights.ts`**：
   - 新增 4 個權重：`revealedMajorCapturePriorityBonus:90` / `safeRevealedRookCaptureBonus:120` / `safeRevealedMajorCaptureBonus:80` / `pawnSoldierDelayWhenMajorCaptureAvailablePenalty:-80`

2. **`src/ai/aiTrace.ts`**：
   - 新增 6 個 trace 欄位：`revealedMajorCaptureAvailable` / `safeRevealedMajorCapture` / `revealedMajorCaptureScore` / `pawnSoldierDelayedByMajorCapture` / `deadMajorShouldCaptureNow` / `deadMajorHoldSuppressedBySafeCapture`

3. **`src/ai/simpleAi.ts`**：
   - Req A: `safeRevealedMajorCapture`判斷此步是否安全吃明大子，加分 120/80+90
   - Req A: `posRevealedMajorCaptureAvailable` 一次計算揪一遍（在 recommendMove 自羅候選步目前）
   - Req B: `deadMajorThreatHold` 新增 `!deadMajorHoldSuppressedBySafeCapture` 條件；安全吃大子時不給保留獎分
   - Req C: `pawnSoldierDelayedByMajorCapture`：有明大子可吃時，暗兵卒開發扣分 (-80)

4. **`src/ai/aiDebugReport.ts`**：
   - `fmtTrace` 補免 6 個新欄位輸出

5. **`tests/rules.test.ts`**：
   - 修正舊測試「controlled dead rook」斷言反映新行為
   - 新增 5 個測試：安全吃車優先級 / deadMajorHold抑制 / 暗兵卒延後懲罰 / 無明大子基線 / debug report 欄位名稱

**測試**：`npm test` 全部通過；`npx tsc --noEmit` 無錯。

---

### 2026-06-27 Fair AI Permission Boundary MVP（Claude）

**目標**：建立正式下棋 AI 的公平資訊權限牆，避免 AI 在正式下棋時偷看未翻暗子的 realType。

**新增/修改檔案**：

1. **`src/ai/aiVisibility.ts`**（全新）：
   - `AiVisiblePiece`：unrevealed 時不帶 `realType`（TS 層強制）
   - `AiVisibleBoard` / `AiVisibleMove` / `AiVisibleState`
   - `createAiView(state, perspectiveSide)`：unrevealed piece 隱藏 realType
   - `visibleStateToMaskedGameState(view)`：MVP 過渡 adapter，未翻 realType mask 成 originalType

2. **`src/ai/simpleAi.ts`**（修改）：
   - 新增 `recommendMoveOracle()`：完整資訊，等同舊 `recommendMove()`，用於 debug/分析
   - 新增 `recommendMoveFair()`：正式下棋入口，透過 createAiView + visibleStateToMaskedGameState 隔離，MVP 忽略外部 candidateMoves

3. **`src/components/HumanVsAiPanel.tsx`**：正式對局 AI 改用 `recommendMoveFair`
4. **`src/App.tsx`**：AI vs AI 兩處改用 `recommendMoveFair`
5. **`src/components/AiPanel.tsx`**：主推薦改用 `recommendMoveFair`；Oracle 僅作 debug 對照用途

6. **`tests/rules.test.ts`**（新增 4 個測試）：
   - `Fair AI view hides realType for unrevealed pieces`
   - `Fair AI masked state replaces hidden realType with originalType`
   - `recommendMoveFair is stable when hidden realType changes but public info is same`
   - `Oracle AI and Fair AI entrypoints both return recommendations`

**哪些模式已改用 recommendMoveFair**：Human vs AI、AI vs AI

**哪些地方仍保留 Oracle**：AiPanel 提供 Oracle debug 對照欄位（主推薦已改用 Fair AI）

**測試**：`npm test` 全部通過（含 4 個新 fair info 測試）；`npx tsc --noEmit` 無錯。

---

### 2026-06-26 AI pattern 觸發紀錄 MVP（Claude）

**目標**：`recommendMove()` 回傳 `traces` 陣列，記錄每個候選步的詳細評分資訊，方便後續 pattern win rate 統計與調小自我對弈。

**新增/修改檔案**：

1. **`src/ai/aiTrace.ts`**（全新）：
   - `AiMoveTrace` 型別：move / score / reason / patterns / structureScore / exchangeNet / risk / captureGain / openingBonus / keySquareScore / hiddenPressureScore / leaveKeySquareScore / checking / effectiveCheck / lowQualityCheck / meaningless
   - `AiRecommendation` 型別：move / score / reason / traces?（向下相容）

2. **`src/ai/simpleAi.ts`**（修改）：
   - import `AiMoveTrace`、`AiRecommendation`
   - `recommendMove` 回傳型別改為 `AiRecommendation`
   - 評分迴圈改為收集所有 `evaluations`，最後打包成 traces 陣列回傳
   - 全部現有呼叫方 `.move` / `.score` / `.reason` 不受影響（向下相容）

3. **`tests/rules.test.ts`**（新增 3 個測試）：
   - A：`recommendMove` 回傳 traces 並含正確欄位
   - B：敵方為表牌炮且能壓制暗大子時 traces 含 `opening_cannon_hits_hidden_rook`
   - C：敵方邊兵翻出 G/車時 traces 含 `opening_edge_rook_pawn_line_lock`

**修改原則**：不改寫 `recommendMove` 邏輯，不調整評分/權重/UI，只增加 debug trace 輸出。

**測試**：`npm test` 全部通過（含 3 個新 trace 測試）；`npx tsc --noEmit` 無錯。

# Shared AI Status（Claude / Codex / ChatGPT 共用）

> 此文件由 Claude、Codex、ChatGPT 共同維護，記錄每輪 AI 完成的工作。  
> 任何 AI 完成工作後都應更新此文件，並以日期 + 工具名稱標記。


### 2026-06-25 一般揭棋模式棋譜管理簡化（Claude）

**問題**：一般揭棋模式底部完整 `GameRecordPanel`（列表、刪除、複製、匯出）版面太重，手機需一直往下滑。

**修改**（僅 `src/App.tsx`）：

1. 移除 `GameRecordPanel` import。
2. 移除 `<GameRecordPanel state={state} past={past} />` 渲染。
3. toolbar 新增「儲存棋譜」按鈕。
4. 點擊後展開 inline 輸入列（棋譜名稱 input + 確認 + 取消）；Enter 確認，Escape 取消。
5. 儲存時同樣保存 `initialState = past[0] ?? state`（含暗子配置），成功顯示「棋譜已儲存」綠色提示。
6. 新增三個 state：`playQuickSave`、`playQuickTitle`、`playQuickMsg`。
7. 新增 `savePlayQuick()` 函式。

**完整棋譜管理保留位置**：打譜模式 → 最近對局（列表、回放、刪除）。

**測試**：`npm test` 80 項全通過。

---

### 2026-06-25 落子聲拉滿 + 回放絕殺音效修正（Claude）

**soundEffects.ts peakGain 調整**：
- 落子聲（`playBoardSoundFeedback` + `playMoveSound`）：`0.35` → `1.0 * BOARD_SOUND_VOLUME`（0.80），decayTime `0.07` → `0.08`
- 吃子聲（`playCaptureSound`）：`0.55` → `1.0 * BOARD_SOUND_VOLUME`（0.80），頻率維持 700 Hz
- `BOARD_SOUND_VOLUME = 0.80` 不變，統一在常數調整

**App.tsx 回放絕殺修正**：
- 回放音效 `useEffect` 中新增 `isEndgame` 判斷：`playbackState.status === 'red_win' || 'black_win'`
- 是絕殺步時：`playBoardSoundFeedback` 的 `check` 傳 `false`（避免說「將軍」），改由 `playEndgameSound()` 播絕殺音效 + 語音
- 非絕殺的將軍仍正常叫「將軍」
- 一般對局 endgame `useEffect`（監聽 `state.status`）不受影響

**測試**：`npm test` 80 項全通過。

---

### 2026-06-25 全 App 棋盤音效規則統一（Claude）

**目標**：所有走子 / 同步 / 回放步數變化統一使用相同音效規則，語音可疊加不互斥。

**音量常數**（集中在 `soundEffects.ts` 頂部，方便微調）：
- `BOARD_SOUND_VOLUME = 0.80`：噪音爆發（落子聲）峰值增益乘數
- `VOICE_SOUND_VOLUME = 0.70`：語音合成音量

**新音效規則**：
1. 有走子 / 步數變化 → 播放落子聲（900 Hz 噪音爆發）
2. 有吃子 → 額外佇列語音「吃」
3. 有將軍 → 額外佇列語音「將軍」
4. 絕殺 / 對局結束 → 由現有 endgame `useEffect` 播放，不重複
5. 語音佇列（`queueSpeech`）不取消已播語音，吃 + 將軍可以連續播

**修改檔案**：

1. **`src/game/soundEffects.ts`**（完整改寫）：
   - 加 `BOARD_SOUND_VOLUME`、`VOICE_SOUND_VOLUME` 常數
   - 加 `queueSpeech()`：不取消當前語音，直接佇列
   - `speakNow()` 保留（供舊 `playCheckSound` 和 endgameSound 使用）
   - 加 `playBoardSoundFeedback({ captured, check, win? })`：統一 helper
   - 保留 `playMoveSound`、`playCaptureSound`、`playCheckSound`、`shouldPlayMoveSound`（測試相容）
   - 舊噪音爆發參數全部乘以音量常數

2. **`src/App.tsx`**：
   - 加 `useRef` import
   - 換 soundEffects import 為 `playBoardSoundFeedback`（移除 4 個舊 import）
   - 移除 `pickMoveSound()` helper
   - `click()`：移除 `shouldPlayMoveSound + next.status==='playing'` 條件，改用 `playBoardSoundFeedback`；終局走子也播落子聲（絕殺語音由 endgame effect 負責）
   - `syncClick()`：同步，移除舊條件改用 helper
   - 加 `playbackSoundStepRef`（`useRef<number>(-1)`）
   - 加 playback 音效 `useEffect`：step 變化時播一次目標步音效；step=0 不播；不在 records 模式不播；跳多步只播目標步（不播中間每步）

**測試**：`npm test` 80 項全通過。

---

### 2026-06-25 手機版被吃子 overlay 對齊修正（Claude）

**問題根因**：桌機版在 `.capturedOverlayLeft` / `.capturedOverlayRight` 設定的 `justify-content`
（flex-direction:column 時控制垂直位置），在手機版切換為 `flex-direction:row` 後變成控制水平位置，
造成方向反轉：黑方吃子顯示在左上、紅方吃子顯示在右下。

**修改**：`src/style.css` 的手機媒體查詢中新增覆蓋：
```css
.capturedOverlayLeft  { order:3; justify-content:flex-start } /* 左下，紅方吃子 */
.capturedOverlayRight { order:1; justify-content:flex-end   } /* 右上，黑方吃子 */
```

**未改動**：`getCapturedBoardStacks` 資料邏輯、piece side、小圓棋子樣式、暗子半透明、炮/包 by side。

**測試**：`npm test` 通過。

---

### 2026-06-25 完成兩個小階段（Codex）：

### 階段 2：模式切分

- 新增 App 首頁 / 封面，用 React state 切換模式，不加 router。
- 新增「接棋對弈模式」：
  - 顯示棋盤、AI 建議、同步上一手、長按修正棋種、被吃子資訊、必要棋譜資訊。
  - 不顯示局面編輯與棋譜 JSON 管理工具。
- 新增「打譜模式」：
  - 顯示 GameRecordPanel 與 MoveList。
  - 用於棋譜儲存、載入、複製棋譜文字、匯出 JSON。
  - 本階段不做完整棋譜回放器。
- 新增「AI VS AI 模式」：
  - 只有入口與空狀態頁。
  - 顯示 AI VS AI 尚未啟用。
- 新增「局面編輯 / 測試模式」：
  - 顯示棋盤、PositionEditor、清空棋盤、恢復初始局面、換手方、儲存 / 載入局面等測試工具。
- 每個模式都有回首頁按鈕。
- 沒有改規則引擎、沒有重寫 AI、沒有做 Threat Map。

### 階段 3：手機版整體可用性收斂

- 手機版棋盤改用 viewport 計算格距，降低超出螢幕的機率。
- 手機版棋子尺寸跟著棋盤格距縮放，避免被裁切。
- 模式按鈕、工具列按鈕、棋譜與編輯按鈕加大點擊區。
- AI 面板、MoveList、CapturedPanel、GameRecordPanel、PositionEditor 在手機版不再用過小高度擠壓。
- 長文字使用換行策略，避免撐爆面板。
- 刪除棋譜按鈕改用危險色，視覺上與一般操作區分。

## 修改了哪些檔案

- `src/App.tsx`
  - 新增首頁與四種模式切換。
  - 將既有面板依模式拆分顯示。
- `src/style.css`
  - 新增模式首頁樣式。
  - 補手機版棋盤、面板、按鈕、長文字與危險操作樣式。
- `CODEX_STATUS.md`
  - 更新本輪完成內容。
- `NEXT_TASK.md`
  - 更新下一步建議排序。

## npm test 是否通過

通過。

```bash
npm.cmd test
```

## npm run build 是否通過

通過。

```bash
npm.cmd run build
```

## 目前還有哪些已知限制

- AI VS AI 目前只有入口與空狀態，尚未啟用。
- Threat Map 尚未做。
- 棋譜回放器 MVP 尚未做。
- 沒有做 Belief State、Monte Carlo、OCR、Ponder、自動截圖辨識。
- 沒有加後端、資料庫、登入系統。
- 沒有改成 Next.js。
- 沒有改 board 座標系。
- 沒有重寫 AI。

## 是否已經 push 到 GitHub

階段 2 已 commit：`add app mode selector`。
階段 3 測試與 build 通過後，會 commit 並 push；若看到此版本在 GitHub 上，代表本輪已 push。

---

### 2026-06-25 棋譜模式 UX 重構 MVP（Claude）

**頁面流程重構**：打譜模式從「一個大頁面塞所有東西」改成三層流程：
```
打譜模式入口
  └─ 棋譜庫首頁（library）
       ├─ 最近對局 → 列表頁 → 回放頁
       ├─ 我的收藏（空狀態）
       └─ 大師棋譜（空狀態）
```

**各頁功能**：
- 棋譜庫首頁：三張入口卡片，顯示最近對局筆數。
- 最近對局列表：搜尋欄（依名稱篩選）、儲存目前對局、可點選進回放頁、刪除按鈕。
- 棋譜回放頁：棋盤（只顯示）、步數顯示（第 N / M 步）、⏮◀▶⏭四鍵控制、水平捲動步驟列（可點跳轉）、「分析目前局面」預留按鈕。

**移除打譜主畫面中的**：`AiPanel`、`WisdomPanel`。  
`AiPanel` + `WisdomPanel` 移到「輔助盤面模式」。

**修改檔案**：
- `src/App.tsx`：新增 RecordsPage 型別、回放狀態、三層頁面渲染。
- `src/components/MoveList.tsx`：新增回放模式（水平捲動可點選步驟）。
- `src/style.css`：新增棋譜庫、列表頁、回放頁樣式。

**測試**：`npm test` 80 項全通過。  
**建置**：沙盒 rollup 限制，Vercel 正常。

---

### 2026-06-25 棋譜儲存改為 initialState + moves 策略（Claude）

**動機**：每步全量 snapshots 會造成 localStorage 膨脹；揭棋回放只需要開局完整暗子配置（initialState），後續 moves 即可精確重現。

**修改**：

1. **`src/game/gameRecord.ts`**：
   - `GameRecord` 加 `initialState?: GameState`（新策略）。
   - `snapshots?: GameState[]` 保留但標記 `@deprecated`，舊棋譜向下相容。

2. **`src/App.tsx`**：
   - `saveCurrentGame`：改為 `const initialState = past.length > 0 ? past[0] : state`，只存一個初始快照。
   - `playbackState` useMemo：優先順序改為 ①`initialState` + moves 推演 → ②`snapshots[step]`（舊棋譜相容） → ③`newGame()` + moves（最終 fallback，暗子可能不一致）。
   - `playbackHasSnapshot`：更新為 `!!(initialState || snapshots?.length)`。

3. **`src/components/GameRecordPanel.tsx`**：
   - `currentRecord` useMemo：改存 `initialState = past[0] ?? state`，不再展開全量 snapshots。
   - 儲存成功訊息改為「棋譜已儲存（含初始快照）」。

**儲存體積**：舊策略每手儲存一整個 GameState，N 手 = N 倍體積；新策略無論幾手只多一個 GameState。

**向下相容**：有 `snapshots` 的舊棋譜仍可回放，不壞資料。

**測試**：`npm test` 80 項全通過。

---

### 2026-06-25 GameRecordPanel 補 snapshots 支援（Claude）

**問題**：一般揭棋模式底部的「儲存棋譜」按鈕（`GameRecordPanel`）沒有傳入 `past`，
導致儲存的棋譜沒有 `snapshots`，回放仍走舊的 `applyMove` 重播，暗子會隨機變動。

**修改**：

1. **`src/components/GameRecordPanel.tsx`**：
   - props 從 `{ state }` 改為 `{ state, past?: GameState[] }`。
   - `currentRecord` useMemo 內：`const snapshots = past ? [...past, state] : undefined`，
     有快照時合併進 record（`{ ...base, snapshots }`），沒有時維持原本行為。
   - 儲存成功訊息：有快照時顯示「棋譜已儲存（含快照）」，沒有時顯示「棋譜已儲存」。

2. **`src/App.tsx`**：
   - 一般揭棋模式底部從 `<GameRecordPanel state={state} />` 改為 `<GameRecordPanel state={state} past={past} />`。

**向下相容**：`past` 為可選，其他地方若沒傳 `past` 仍可正常運作，只是不存 snapshots。

**測試**：`npm test` 80 項全通過。

---

### 2026-06-25 棋譜回放 snapshot 最小修正（Claude）

**問題**：棋譜回放從 `newGame()` 重播，但揭棋暗子 `realType` 是隨機的，回放盤面與原局不同。

**修改**：

1. **`src/game/gameRecord.ts`**：`GameRecord` 加 `snapshots?: GameState[]`，並在 import 加入 `GameState`。
2. **`src/App.tsx`**：`saveCurrentGame` 改為 `const snapshots = [...past, state]`，存入 record。
   回放的 `playbackState` useMemo 優先取 `playbackRecord.snapshots?.[playbackStep]`，沒有才走舊的 `applyMove` replay。
   回放頁加一行小提示：有快照顯示綠色「✓ 快照回放」，舊棋譜顯示黃色「⚠ 舊棋譜重播，暗子可能不一致」。

**向下相容**：舊棋譜（無 `snapshots`）繼續用 `applyMove` 回播，不會壞。

**測試**：`npm test` 80 項全通過。

---

### 2026-06-25 正式對局資料一致性修正 MVP（Claude）

**問題**：一般揭棋模式可以長按或快捷鍵修正棋種，但棋種修正不是正式 Move，  
不會寫入 history，導致棋譜回放盤面與實際對局不一致。

**修改**（僅 `src/App.tsx`，兩處 targeted edit）：

1. **keydown effect**：在 `mode !== 'editor' && mode !== 'ai-master'` 時直接 return，  
   並把 `mode` 加入 deps array，確保 effect 跟著模式更新。
2. **一般揭棋模式 Board**：移除 `onSquareLongPress={openCorrection}`，  
   同時移除底部的 hotkey hint 面板與 `{renderCorrectionPanel()}`。

**結果**：
- 一般揭棋模式：正常走棋/翻子/吃子/將軍/絕殺/同步/undo/儲存棋譜都不受影響。
- 長按棋子不再出現修正面板。
- 1~6 快捷鍵在對弈模式完全無效。
- 局面編輯 / 輔助盤面模式：長按修正與快捷鍵完整保留。
- 棋譜回放頁：Board 本來就沒有 onSquareLongPress，不受影響。

**測試**：`npm test` 80 項全通過。  
**建置**：沙盒 rollup 限制，Vercel 正常。

---

### 2026-06-25 棋譜時間修正 + 回放局面帶入輔助盤面分析（Claude）

**問題**：
1. `fmtDate()` 用 `iso.slice(0,10)` 取 UTC 日期，台灣（UTC+8）深夜存的棋譜日期顯示少一天。
2. 回放頁「分析目前局面」按鈕只是 `enterMode('ai-master')`，不帶入目前回放盤面。

**修改**：

1. **`src/App.tsx`** – `fmtDate()` 改用 `new Date(iso).toLocaleString()` + try/catch fallback（顯示系統本地日期時間）。
2. **`src/App.tsx`** – 新增 `aiMasterNote` state（`string | null`）。
3. **`src/App.tsx`** – `enterMode()` 進入 ai-master 時清除 `aiMasterNote`（防止舊提示殘留）。
4. **`src/App.tsx`** – `analyzePlayback()` 重寫：
   - `JSON.parse(JSON.stringify(playbackState))` 深複製，避免 reference 污染。
   - `setState(snapshot)`、`setPast([])`、`setSelected(null)`、`closeCorrection()`、`cancelSync()`。
   - `setAiMasterNote(\`已載入棋譜第 ${playbackStep} 手局面\`)`。
   - `setMode('ai-master')`（�
---

### 2026-06-27 人 vs AI 測試對局 MVP（Claude）

**目標**：新增可測試 AI 棋力的人機對弈模式，支援 AI 步法理由顯示與棋譜儲存。

**新增 / 修改檔案**：

1. **`src/components/HumanVsAiPanel.tsx`**（全新）：
   - 自帶完整遊戲狀態（`gameState`、`past`、`initialState`、`aiAnnotations`）
   - 選色畫面：執紅先手 / 執黑後手
   - 人類走棋：點擊棋子 → 顯示合法落點 → 點目標落子
   - AI 自動走棋：`gameState.turn === aiSide` 時 `setTimeout(400ms)` 觸發 `recommendMove()`
   - AI 上一步面板：顯示棋步文字、分數、reason
   - 重新開始 / 儲存棋譜 按鈕
   - endgame banner + `playEndgameSound()`

2. **`src/game/gameRecord.ts`**（修改）：
   - `GameRecord` 加 `moveAnnotations?: ({ score: number; reason: string } | null)[]`
   - index 與 `moves[]` 對齊，`null` = 人類走步，物件 = AI 走步
   - optional 欄位，不破壞舊棋譜

3. **`src/App.tsx`**（修改）：
   - `AppMode` 加 `'human-vs-ai'`
   - `modeCards` 加入「人 vs AI 測試」卡片（排在打譜模式後）
   - `mode === 'human-vs-ai'` 渲染 `<HumanVsAiPanel onHome={goHome} storage={storage()} />`

4. **`tests/rules.test.ts`**（新增 4 個測試）：
   - A：AI 在人類走棋後產生合法回應
   - B：AI 回應進入 history（共 2 手）
   - C：可建立含 moveAnnotations 的人 vs AI 棋譜 record
   - D：舊棋譜（無 moveAnnotations）仍可正常載入

**測試**：`npm test` 24 個 AI 相關測試全部通過。  
**TypeScript**：`npx tsc --noEmit` 無錯。  
**建置**：沙盒 rollup native binary 限制（pre-existing），Vercel 正常。

---

## 一鍵複製 AI 測試報告 MVP（2026-06-27）

**目標**：在輔助盤面 / AI 建議區新增「複製 AI 測試報告」按鈕，讓手機測試 AI 更方便。

**新增 / 修改檔案**：

1. **`src/ai/aiDebugReport.ts`**（全新）：
   - `AiDebugReportInput` 型別：`{ modeName, state, analysisMoves?, recommendation }`
   - `formatAiDebugReport()` 純函式，輸出純文字報告
   - 報告包含：模式/輪到/手數、最近 10 手、AI 建議（推薦步 + 分數 + reason）、推薦步完整 trace、候選前 5 名

2. **`src/components/AiPanel.tsx`**（修改）：
   - 新增 `useState` 控制「已複製」提示（2 秒後自動消除）
   - 新增 `modeName?: string` 與 `analysisMoves?: Move[]` 選用 props（不破壞現有呼叫端）
   - 新增「複製 AI 測試報告」按鈕，呼叫 `navigator.clipboard.writeText()`
   - 複製成功顯示「已複製 AI 測試報告」綠色提示

3. **`tests/rules.test.ts`**（新增 6 個測試）：
   - header 與模式名稱存在
   - AI 建議區塊存在
   - 候選前 5 名（有 traces 時）
   - 推薦步 trace（有 traces 時）
   - 無合法棋步時顯示提示
   - analysisMoves 顯示變化手數

**測試**：`npm test` 全部 30 個 AI 相關測試通過。  
**TypeScript**：`npx tsc --noEmit` 無錯。

---

## 後手翻棋選擇權 + 公平資訊開局大子活化（2026-06-27）

**目標**：修正兩個揭棋 AI 核心邏輯，不動 UI、不改 GameRecord schema。

**新增 / 修改檔案**：

1. **`src/ai/aiWeights.ts`**（修改）：
   - 新增 5 個 weight：`majorActivationBonus(45)` / `opponentRevealSuppressionBonus(12)` / `revealChoiceRiskPenaltyBase(90)` / `revealChoiceRiskHighValueExtra(40)` / `hiddenPressureNonActivationCap(16)`

2. **`src/ai/aiTrace.ts`**（修改）：
   - 新增 5 個 trace 欄位：`revealChoiceRisk` / `revealChoicePenalty` / `openingMajorGoal` / `majorActivation` / `opponentRevealSuppression`

3. **`src/ai/simpleAi.ts`**（修改）：
   - 新增 helper `computeRevealChoiceRisk()`：高價子吃低外觀

---

## 2026-06-27 死車威脅保留 + 暗士翻子卡陣風險 MVP

### 功能概覽
1. **advisorRevealClogRisk**：暗士翻子易卡住將門，扣分 (-70 基本 / -110 鄰近將軍)
2. **deadMajorThreatHold**：保留對方死車威脅 (+70)，不须立即吃車
3. **forcedBadDefense**：暗士翻子硬保已被控制的己方車，扣分 (-80)

### 修改檔案
- `src/ai/aiWeights.ts`：新增 4 個權重（advisorRevealClogPenalty / advisorRevealClogNearKingPenalty / deadMajorThreatHoldBonus / defendDoomedMajorPenalty）
- `src/ai/aiTrace.ts`：新增 7 個安全 trace 欄位
- `src/ai/simpleAi.ts`：新增 helper functions + evaluateMove 整合 + reasonFor + trace 建立
- `tests/rules.test.ts`：新增 3 個測試

### 測試
- 全部測試通過，`npx tsc --noEmit` 清洁


---

## 2026-06-27 上一手高亮 + AI 報告盤面快照

### 功能
- **上一手高亮**：Board 新增 `lastMove` prop，from 方格顯示小白點，to 方格顯示白色光圈
- **盤面快照**：`formatAiDebugReport` 加入10×9 文字棋盤，明子顯紅車/黑馬，暗子顯紅暗車/黑暗卒

### 修改檔案
- `src/components/Square.tsx`：`lastMoveFrom` / `lastMoveTo` props
- `src/components/Board.tsx`：`lastMove` prop
- `src/style.css`：`.lastMoveFrom::before` / `.lastMoveTo::before` 樣式
- `src/App.tsx` + `src/components/HumanVsAiPanel.tsx`：各模式傳入 `lastMove`
- `src/ai/aiDebugReport.ts`：`boardSnapshot()` helper + 插入報告
- `tests/rules.test.ts`：2 個新測試

### 驗收
- 全部測試通過，`npx tsc --noEmit` 清洁


---

### 2026-06-27 Last Move Highlight + Board Snapshot Report
- Board 支援 lastMove
- Square 顯示上一手 from 白點 / to 白圈
- 一般揭棋、人 vs AI、AI VS AI、回放、輔助盤面已傳入 lastMove
- AI 測試報告加入盤面快照
- 補 formatAiDebugReport 測試：tests/rules.test.ts import 移至頂層 + 統整測試 (3 個)

---

### 2026-06-27 AI 策略補充（CODEX 更新）

以下為已完成但尚未記錄於 CODEX 的策略項目：

- **暗兵卒優先策略**：開局優先翻自方兵卒，不急於翻大子，降低資訊洩漏風險
- **純暗馬活化降權**：未翻馬在開局階段不給予過高活化分，避免提前暴露
- **暗兵卒 follow-up heuristic**：翻出兵卒後，優先帶動馬 / 相 / 士進行配合，加強陣型完整性
- **debug report trace 欄位**：`AiMoveTrace` 已含完整欄位（advisorRevealClogRisk / deadMajorThreatHold / forcedBadDefense 等），`formatAiDebugReport` 輸出含盤面快照與 top-5 候選步
