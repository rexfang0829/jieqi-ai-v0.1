# AI 決策層架構 (AI Decision Layers)

本文件描述 `recommendMove()` / `recommendMoveFair()` 的五層決策優先序。
每層均對應 `AiMoveTrace.decisionLayer` 欄位的數值。

---

## Layer 0 — 直接絕殺 (Immediate Checkmate)

**`decisionLayer = 0`**（此層不產生 trace，直接 early-return）

- 條件：`applyMove(state, move).status === winningStatus(turn)`
- 行為：立即回傳，不評分、不建立 trace。
- reason：`'此步直接形成絕殺'`

---

## Layer 1 — 安全門：解除明大子威脅 (Safety Gate)

**`decisionLayer = 1`**

- 前置掃描：`scanHighValueThreats(board, side)` 偵測己方已翻明車/明炮/明馬在對方攻擊下且無保護。
- 觸發條件：`resolvedHighValueThreat === true`，即此步讓受威脅大子數量減少。
- 加分：`+resolvedHighValueThreatBonus (+120)`
- 相關懲罰（反面）：
  - 未解除威脅且做了開局/救援等低優先動作 → `ignoredHigherPriorityThreatPenalty (-180)`
  - 未解除威脅且無吃子/將/阻殺 → `unresolvedHighValueThreatPenalty (-250)`
- 目的：確保 AI 不因兵卒開發、暗子救援等低優先事項忽略已暴露的大子受攻。

---

## Layer 2 — 戰術 (Tactical)

**`decisionLayer = 2`**

- 條件（滿足任一）：
  - `captureGain > 0`（吃子）
  - `blocksImmediateWin`（阻止對方一步殺）
  - `effectiveCheck`（有效將軍）
  - `escapeBonus > 0`（重要子脫身）
- 包含：安全吃子、阻殺、有效將軍、重要子逃脫。

---

## Layer 3 — 陣型 / 計畫 (Positional / Plan)

**`decisionLayer = 3`**

- 條件（滿足任一）：
  - `pawnSoldierDevelopment`（開局暗兵卒開發）
  - `pawnSoldierFollowUp.score > 0`（兵卒後續組合）
  - `endgamePlan.endgamePlanActive`（中殘局目標啟動）
  - `rescuesLooseHiddenPiece`（救援無保護暗子）
  - `openingBonus > 0`（開局翹邊兵）
- 包含：開局理論、結構改善、暗子管理、中殘局推進。

---

## Layer 4 — 預設 (Fallback)

**`decisionLayer = 4`**

- 條件：不符合 Layer 1–3 的所有候選步。
- 包含：無明確目標的走步、結構中性、關鍵格佔位等。
- 通常 `meaningless === true` 或 `avoidAimlessMove === true`。

---

## Trace 欄位說明

| 欄位 | 說明 |
|------|------|
| `decisionLayer` | 0–4，本步所屬決策層 |
| `decisionLayerLabel` | 決策層中文標籤 |
| `safetyGateTriggered` | 本局面是否有明大子受威脅（Safety Gate 啟動） |
| `highValuePieceInDanger` | 同上（= `safetyGateTriggered`） |
| `resolvedHighValueThreat` | 本步讓受威脅大子數量減少 |
| `unresolvedHighValueThreat` | 本步未解除大子威脅 |
| `ignoredHigherPriorityThreat` | 未解除威脅且做了低優先動作（兵卒開發/救援暗子/純暗馬活化） |

---

## 實作位置

| 元件 | 檔案 |
|------|------|
| `scanHighValueThreats()` | `src/ai/simpleAi.ts` |
| 決策層計算 & 分數 | `src/ai/simpleAi.ts` → `evaluateMove()` |
| 新 reason strings | `src/ai/simpleAi.ts` → `reasonFor()` |
| Trace 欄位定義 | `src/ai/aiTrace.ts` → `AiMoveTrace` |
| 權重定義 | `src/ai/aiWeights.ts` → `defaultAiWeights` |
| Debug 輸出 | `src/ai/aiDebugReport.ts` → `fmtTrace()` |

---

## 未來方向

- Layer 1 可擴充為「被將軍時強制防禦」Gate（目前 `allowsOpponentWin` 已部分覆蓋）。
- `decisionLayer` 可用於 Pattern 觸發日誌統計（待辦事項 #2）。
- 可加入 Layer 0.5：「搶佔必殺威脅（Forced Mate in N）」作為 Threat Map MVP 的入口。
