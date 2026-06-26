## 最新完成的工作

### 2026-06-26 timeout 音效重複 + 雙 banner 修正（Claude）

**問題 1 — timeout 後誤播「絕殺」**：timeout effect 呼叫 `setState({...s, status: 'black_win'})` 後，全域 endgame useEffect 偵測到 status 變化，接著播 `playEndgameSound()`（語音「絕殺」）。

**修正**：新增 `isPlayTimeoutRef = useRef(false)`。timeout 發生時設為 `true`；`startNewPlayGame` 和 `enterMode` 進入 play 模式時重置為 `false`。全域 endgame effect 加 guard：`!isPlayTimeoutRef.current`，timeout 狀態下不播「絕殺」。

**問題 2 — timeout 顯示兩個結束 banner**：同時出現標準 endgameFeedback banner（「絕殺」）與自訂紫色 timeout banner。

**修正**：移除紫色獨立 banner；改為 inline 覆寫 `renderEndgameBanner` 的內容：timeout 時 title 顯示「時間到」，winnerText 加上「（超時）」，保留同一個 endgameBanner CSS class 樣式。

**修改檔案**：僅 `src/App.tsx`。

**測試**：`npm test` 80 項全通過；`npx tsc --noEmit` 無錯。


### 2026-06-26 10 分鐘對弈鐘 + timeout 棋譜資料 6 項修正（Claude）

**修正項目**：

1. **timeout → 真實終局狀態**：逾時時呼叫 `setState(s => ({...s, status: 'black_win' / 'red_win'}))` 讓 header、endgameFeedback banner 直接由真實 state 驅動，不再靠 `playIsTimeout` 擋 UI；toolbar 按鈕也改用 `state.status !== 'playing'` 判斷。

2. **GameRecord 加時間欄位**：`gameRecord.ts` 新增 `redTimeMs?: number`、`blackTimeMs?: number`；`createGameRecord` 接受並儲存；逾時存檔傳入 `redTimeMs: 0` 或 `blackTimeMs: 0`；每手自動存檔也傳入當前雙方剩餘時間。

3. **自動存檔保留 createdAt/favorited**：`saveGameRecord` 更新既有記錄時，從 `existing` 取 `createdAt`、`favorited`、`note`，不再被新記錄覆蓋。

4. **計時器位置改為棋盤角落 chips**：移除全寬橫列；Board 外包 `position:relative` div；黑方計時器 chip 絕對定位 `top:4px left:4px`，紅方計時器 `bottom:4px right:4px`；剩餘 ≤30 秒時閃爍 + 橙色警示；新增 `.playTimerChip`、`.playTimerBlack`、`.playTimerRed`、`.playTimerWarn` CSS。

5. **首頁文案修正**：一般揭棋模式描述改為「不支援長按修正棋種」。

6. **回放頁顯示 timeout 原因**：結果行改為 `resultText（時間到 / 絕殺）` 格式。

**移除**：`playCreatedAtRef`（已無用）、紫色 timeout banner（由 endgameFeedback 標準 banner 取代）。

**修改檔案**：`src/game/gameRecord.ts`、`src/App.tsx`、`src/style.css`。

**測試**：`npm test` 80 項全通過；`npx tsc --noEmit` 無錯。


### 2026-06-26 正式對局自動儲存 + 收藏定位調整 + 10 分鐘對弈鐘 MVP（Claude）

**功能**：

1. **10 分鐘對弈鐘**：進入「一般揭棋模式」或點「新局」時，紅黑各 10:00 倒計時，輪到誰走棋才扣時；時間到觸發逾時，顯示橙紫色 banner，語音播報，棋局終止。

2. **自動存檔**：每走一手及對局結束自動儲存棋譜（含 initialState），同一局覆蓋更新；逾時時存 endReason: 'timeout'，timeoutSide 標記。

3. **收藏定位**：棋譜庫首頁顯示真實收藏數；最近對局每筆新增收藏星號按鈕；收藏頁顯示真實收藏列表。

4. **回放逾時音效**：回放到結束步若 endReason === 'timeout' 則播 playTimeoutSound，否則播 playEndgameSound。

**修改**：僅 src/App.tsx。
**測試**：npm test 80 項全通過；npx tsc --noEmit 無錯。

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
## 2026-06-26 局面第三次重複禁止 MVP

### 最新完成的工作
- 新增局面 key 與第三次重複判斷，key 包含棋盤每格、side、revealed、realType、turn。
- 一般接棋對弈走子 / 同步上一手在套用前會禁止造成第三次同局面，並提示「此手會造成第三次重複局面」。
- AI VS AI 走子前會排除造成第三次同局面的合法步；若所有合法步都會重複，停止自動播放並顯示「無可避免重複，對局結束」。
- simpleAi 支援傳入已過濾的候選步，不改原本評分邏輯。

### 修改檔案
- `src/game/repetitionRules.ts`：新增 getPositionKey、第三次重複判斷與候選步過濾。
- `src/App.tsx`：接入一般走子、同步上一手、AI VS AI step/autoplay 的重複局面檢查。
- `src/ai/simpleAi.ts`：recommendMove 新增 candidateMoves 參數。
- `tests/rules.test.ts`：新增同路來回、繞路回同局、第二次允許、暗子 realType 不誤判測試。
- `CODEX_STATUS.md` / `NEXT_TASK.md`：更新本輪交接狀態。

### 測試
- `npm.cmd test` 通過。
- `npx.cmd tsc --noEmit` 通過。

### 已知限制
- 只做第三次同局面禁止 MVP。
- 尚未實作完整長將 / 長捉規則。
- 尚未加入和棋或判負裁定。
- 未做 Belief State、Monte Carlo、OCR、Ponder。

### Push 狀態
- 本輪完成後會 commit 並 push。
## 2026-06-26 局面第三次重複禁止 MVP 收尾

### 最新完成的工作
- 補強「局面第三次重複禁止 MVP」交接紀錄。
- `src/game/repetitionRules.ts` 已新增並維護局面 key、第三次重複判斷、候選步過濾。
- 一般對局、同步上一手、AI VS AI 都已套用第三次重複禁止。
- `recommendMove(state, candidateMoves?)` 已支援外部傳入候選 moves，AI VS AI 可先過濾重複步再評分。
- `getPositionKeyAfterMove()` 改用實際 `applyMove()` 取得 next state key，降低未來規則分歧。

### 測試補強
- getPositionKey 包含 side / revealed / realType / turn。
- 第二次同局面允許，第三次同局面禁止。
- 暗子 realType 不同不誤判為同局面。
- filterThirdRepetitionMoves 會排除造成第三次重複的 move。
- repetition 判斷的 next key 與 `applyMove()` 結果一致。

### 測試
- `npm.cmd test` 通過。
- `npx.cmd tsc --noEmit` 通過。
## 2026-06-26 局面第三次重複禁止 MVP（Codex）

### 完成內容
- 新增 `src/game/repetitionRules.ts`。
- `getPositionKey(state)` 會把 `turn`、每格棋子的 `side`、`revealed`、`realType` 納入 key。
- 暗子重複判斷使用 `realType`，避免只看表面棋種造成誤判。
- `getPositionKeyAfterMove(state, move)` 使用正式 `applyMove()` 產生下一局面，再取 next state key，避免和實際走子流程分歧。
- 一般對局、同步上一手、AI VS AI 都已套用第三次重複禁止。
- `recommendMove(state, candidateMoves?)` 已支援候選 moves，AI VS AI 可先排除第三次重複步，再交給 simpleAi 評分。

### 測試覆蓋
- `getPositionKey` 會區分 realType 不同的暗子。
- 第二次同局面允許。
- 第三次同局面禁止。
- `filterThirdRepetitionMoves` 會排除造成第三次重複的 move。

### 驗證
- `npm.cmd test` 通過。
- `npx.cmd tsc --noEmit` 通過。
## 2026-06-26 AI 戰術層 + 棋譜變化線 MVP（Codex）

### 最新完成的工作
- `recommendMove(state, candidateMoves?)` 先檢查候選步是否能直接形成己方勝利，若能直接選並回傳「此步直接形成絕殺」。
- 若沒有直接絕殺，AI 會過濾掉會讓對方下一手直接勝利的候選步；仍保留 `candidateMoves`，不破壞 AI VS AI 第三次重複過濾。
- `GameRecord` 新增 `variations?: GameVariation[]`，支援棋譜變化線 MVP。
- 從棋譜回放按「分析目前局面」會建立 analysisSource，輔助盤後續走法會記錄為 analysisMoves。
- 輔助盤可將 analysisMoves 儲存為變化，寫回原 GameRecord 的 `variations` 並保存到 localStorage。
- 回放頁會在目前 step 顯示 variations 列表，可點開回放該變化。

### 修改檔案
- `src/ai/simpleAi.ts`：加入直接絕殺優先與避免送對方一步勝。
- `src/game/gameRecord.ts`：新增 `GameVariation` 型別與 variations 保存。
- `src/App.tsx`：串接 analysisSource、analysisMoves、儲存變化與變化列表回放。
- `tests/rules.test.ts`：補 AI 直接絕殺優先與 GameRecord variations 保存測試。
- `CODEX_STATUS.md` / `NEXT_TASK.md`：更新本輪交接內容。

### 測試
- `npm.cmd test` 通過。
- `npx.cmd tsc --noEmit` 通過。

### 已知限制
- 戰術層仍是 MVP，沒有完整 minimax。
- 變化線只有一層，不做多層巢狀 variation。
- 未做 Threat Map、Belief State、Monte Carlo、後端或資料庫。
## 2026-06-26 AI 戰術層與棋譜變化線 MVP 收尾（Codex）

### 本輪完成
- `recommendMove(state, candidateMoves?)` 已保留候選 moves 支援，AI VS AI 的第三次重複過濾不受影響。
- AI 已加入直接絕殺優先：候選步若走完立即讓己方勝，直接選該步。
- AI 已加入避免送對方一步絕殺：若某步會讓對方下一手直接勝，且仍有其他選擇，會避開該步。
- 棋譜變化線 MVP 已加入：`GameRecord.variations` 可保存從回放局面分析出的變化線，並可存入 localStorage。
- 本輪補上簡化一層交換評估：我方走子後若對方能吃回剛移動棋子，會再檢查我方是否能立刻反吃攻擊棋，依 `被吃子價值 - 可反吃攻擊棋價值` 計算可能損失。
- AI 現在會用 `gain - possibleLoss` 評估吃子交換，安全吃高價子會優先，虧交換不再被單純吃子分高估。

### 修改檔案
- `src/ai/simpleAi.ts`：補一層交換評估、優勢交換評分與安全吃高價子理由。
- `tests/rules.test.ts`：補絕殺優先、吃高價但絕殺更優先、虧交換不高估、安全吃高價子優先、變化線保存回歸測試。
- `CODEX_STATUS.md` / `NEXT_TASK.md`：更新本輪狀態與下一步。

### 驗證
- `npm.cmd test` 通過。
- `npx.cmd tsc --noEmit` 通過。
## 2026-06-26 開局翻兵 heuristic 收尾（Codex）

### 本輪完成
- AI 戰術層 MVP 保留：直接絕殺優先、避免送對方一步絕殺。
- 一層交換評估保留：吃子分會扣除對方吃回後、我方可反吃的簡化交換損失。
- 棋譜變化線 MVP 保留：`GameRecord.variations` 可保存分析變化線。
- 新增開局翻兵 heuristic：`state.history.length <= 8` 時，只對己方兵卒起始位置、尚未翻開、`originalType === 'pawn'` 的暗子走法加分。
- 翻兵卒起始位 +40；邊兵額外 +10；三七路兵額外 +8。兵卒起始位置由 `createInitialBoard()` 推導，不硬寫紅黑座標。
- 開局翻兵 bonus 只進入一般評分，不會蓋過直接絕殺與避免送一步殺；安全吃高價子仍因 material / exchange 分數高於翻兵 bonus。

### 修改檔案
- `src/ai/simpleAi.ts`：加入開局翻兵 bonus 與由初始盤面推導兵卒起始點的 helper。
- `tests/rules.test.ts`：補紅黑開局翻兵、邊兵/三七路加分、絕殺優先不被翻兵蓋過、翻兵若送對方一步絕殺則不硬翻的測試。
- `CODEX_STATUS.md` / `NEXT_TASK.md`：整理本輪完成內容與已完成補充位置。

### 驗證
- `npm.cmd test` 通過。
- `npx.cmd tsc --noEmit` 通過。
## 2026-06-26 AI 戰術層 + 棋譜變化線 + 開局翻兵 heuristic（Codex）

### 完成內容
- 直接絕殺優先：`recommendMove(state, candidateMoves?)` 會先檢查候選步是否能讓己方立即勝利，若可以就直接選。
- 避免送對方一步絕殺：若某步會讓對方下一手直接勝，且仍有其他候選步，AI 會避開該步。
- 一層交換評估：AI 評估吃子後，會檢查對方是否能吃回剛移動的棋，並估算我方是否能立刻反吃攻擊棋，避免高估虧交換。
- 棋譜變化線 MVP：`GameRecord.variations` 已可保存從回放局面分析出的變化線。
- 開局翻兵 heuristic：開局階段會對己方兵卒起始位置的未翻暗子給小幅加分，邊兵與三七路兵有額外 bonus。

### 範圍限制
- 本段只整理既有狀態，不新增功能。
- 未做 Belief State、Monte Carlo、OCR、Ponder、Threat Map 或大型 AI 重寫。
## 2026-06-26 AI 目的評估與無成果將軍降分（Codex）

### 本輪完成
- AI 現在會對候選步做目的評估：吃子、優勢交換、擋住一步殺、威脅重要棋子、重要棋脫離危險、增加將區壓力、開局翻兵，都會被視為有目的。
- 無目的移動會套用 `meaninglessMovePenalty` 扣分，避免 AI 因第三次重複過濾後改走沒有成果的棋。
- 無成果將軍會套用 `lowQualityCheckPenalty` 降分；只有直接贏棋、吃子、造成重要威脅或增加將區壓力的將軍才視為有效將軍。
- 第三次重複局面禁止仍然只是合法性過濾條件，不是加分項；避開重複後的棋若本身沒有目的仍會被扣分。
- `recommendMove` 的 reason 已補強，可回傳「有效將軍」、「無成果將軍，已降分」、「此步缺乏明確目的，已扣分」、「增加將區壓力」、「避免送對方一步殺」等更明確判斷。

### 修改檔案
- `src/ai/simpleAi.ts`：新增目的評估、將軍品質判斷、將區壓力、重要威脅、脫離危險與更明確 reason。
- `CODEX_STATUS.md` / `NEXT_TASK.md`：同步本輪 AI 評分調整與後續待辦。

### 驗證
- `npm.cmd test` 通過。
- `npm.cmd run build` 通過（仍有既有 `.playbackMoveScroll` CSS minify warning，本輪未處理 CSS）。

## 2026-06-26 開局暗子機率與結構壓制評估 MVP（Codex）

### 本輪完成
- 新增開局暗兵機率假設：`isOpeningPhase()` 讓 AI 在前 12 手內提高「暗子可能是兵卒」對馬腳、象眼、炮架、兵線關鍵點與暗車前方的結構威脅評估。
- 新增炮線壓制評估：可掃描敵炮是否透過剛好一個炮架瞄住己方暗車 / 暗大子，並評估候選步是否改善炮線壓制，而不是只看單純塞線。
- 新增馬象活化評估：開局馬、象從原始位置活出時，若能解除炮線 / 馬腳 / 象眼壓制，會給結構分與 reason。
- 新增邊路 G / 車兵線封鎖風險：AI 會辨識敵方 G / 車吃進兵線的風險，並加分給守住兵線關鍵點、避免敵方 G 壓兵線、保留暗車控制點的手。
- 新增暗大子動態保留價值：`hiddenPieceValue()` 依同類已翻出數量評估暗車、暗炮、暗馬的防守價值，並由 `defensiveTargetValue()` 接進一層交換風險。
- 新增 `src/ai/learningPatterns.ts`，用 pattern id 與 metadata 命名人類經驗棋理，例如 `opening_cannon_hits_hidden_rook`、`opening_edge_rook_pawn_line_lock`、`preserve_hidden_cannon_threat`、`horse_release_to_guard_pawn_line`。
- 目前不是完整自我學習，未寫入棋譜或資料庫；只是先預留 pattern / learning metadata 入口，後續 AI VS AI 可記錄 pattern 觸發、AI 選手與最終結果。

### 修改檔案
- `src/ai/simpleAi.ts`：接入開局結構評估、暗大子保留價值、炮線壓制、兵線封鎖風險與相關 reason。
- `src/ai/aiWeights.ts`：新增結構評估與暗大子保留價值權重。
- `src/ai/learningPatterns.ts`：新增可記錄、可調權重的 pattern metadata。
- `CODEX_STATUS.md` / `NEXT_TASK.md`：同步本輪狀態與後續待辦。

### 驗證
- `npm.cmd test` 通過。
- `npm.cmd run build` 通過（仍有既有 `.playbackMoveScroll` CSS minify warning，本輪未處理 CSS）。

## 2026-06-26 AI 權重參數化 MVP（Codex）

### 本輪完成
- 新增 `src/ai/aiWeights.ts`，集中管理 simpleAi 目前使用的棋子價值、吃子目標價值、開局翻兵、揭棋要點、暗子壓制、交換風險、將區壓力、無目的步與無成果將軍等分數常數。
- `recommendMove(state, candidateMoves?, weights = defaultAiWeights)` 已支援可選 weights；舊呼叫方式不需要修改。
- `simpleAi.ts` 的 helper 改用參數傳入 `AiWeights`，避免使用全域 mutable state。
- 本輪只是集中管理分數，`defaultAiWeights` 盡量沿用原本數值，未做 AI 自動調參、自我學習或搜尋重寫。
- 保留既有功能：絕殺優先、避免送一步殺、candidateMoves、一層交換評估、開局翻兵、無目的步扣分、無成果將軍降分、targetValue、連士 / 過河兵、落點保護、揭棋要點、暗子壓制與 reason 補強。

### 修改檔案
- `src/ai/aiWeights.ts`：新增 `AiWeights` 型別與 `defaultAiWeights`。
- `src/ai/simpleAi.ts`：改由 `weights` 讀取 AI 評分常數，並讓 `recommendMove` 支援可選 weights。
- `CODEX_STATUS.md` / `NEXT_TASK.md`：同步本輪狀態與後續待辦。

### 驗證
- `npm.cmd test` 通過。
- `npm.cmd run build` 通過（仍有既有 `.playbackMoveScroll` CSS minify warning，本輪未處理 CSS）。

## 2026-06-26 AI 揭棋要點與暗子壓制 MVP（Codex）

### 本輪完成
- 在 `src/ai/simpleAi.ts` 既有評分架構上新增 `keySquareBonus()`，會對中路、河界、對方將區附近、二路 / 八路靠近對方陣地、可壓制暗子的位置給小幅加分。
- 新增 `leaveKeySquarePenalty()`，若棋子離開揭棋要點且沒有明確收益，會小幅扣分。
- 新增 `hiddenPiecePressureBonus()`，走完後用公平資訊掃描對方未翻暗子，若我方合法步控制暗子位置則小幅加分；不讀暗子 `realType`、不做機率推理。
- `evaluateMove()` 已接入要點加分、離開要點懲罰、暗子壓制加分，並把明顯要點佔領與暗子壓制納入 purposeful，避免被無目的步扣分。
- reason 新增「佔據揭棋要點」「離開要點且收益不足，已扣分」「壓制對方暗子」「控制對方重要暗子位置」。
- 保留既有 AI 評分功能：絕殺優先、避免送一步殺、candidateMoves、一層交換評估、開局翻兵、無目的步扣分、無成果將軍降分、targetValue、連士 / 過河兵、落點保護 / 高價子無保護扣分。

### 驗證
- `npm.cmd test` 通過。
- `npm.cmd run build` 通過（仍有既有 `.playbackMoveScroll` CSS minify warning，本輪未處理 CSS）。
## 2026-06-26 AI 吃子目標價值與落點保護（Codex）

### 本輪完成
- AI 吃子評估改用 `targetValue(piece, board, position)`，不再只依固定棋種分數判斷吃子價值。
- AI 可用 `isConnectedAdvisor()` 區分連得起來的士與普通士，連得起來的士價值提高但不超過炮。
- AI 可用 `isCrossedPawn()` 區分過河兵卒與未過河兵卒，過河且接近九宮會略微加分。
- AI 會用 `isSquareProtectedBySide()` 檢查走完後落點是否有己方保護，落點有保護給少量加分。
- 高價子落到無保護位置且沒有明確收益時會套用 `hangingMovePenalty` 扣分。
- 仍保留原本直接絕殺、避免送殺、一層交換評估、開局翻兵、無目的步扣分、無成果將軍降分與 candidateMoves 相容。

### 修改檔案
- `src/ai/simpleAi.ts`：新增 target value、連士、過河兵、落點保護與高價子無保護懲罰。
- `CODEX_STATUS.md` / `NEXT_TASK.md`：同步本輪 AI 評分調整與後續待辦。

### 驗證
- `npm.cmd test` 通過。
- `npm.cmd run build` 通過（仍有既有 `.playbackMoveScroll` CSS minify warning，本輪未處理 CSS）。
## 2026-06-26 AI 開局邊炮 / 邊 G pattern 分流修正（Codex）

### 最新完成的工作
- 修正 `src/ai/simpleAi.ts` 的開局結構評估，將「紅方邊兵翻出炮」與「紅方邊兵翻出 G / 車」拆成不同 pattern。
- 紅邊炮局現在偏向馬八進九 / 象七進九，用來解除邊炮壓制。
- 紅邊 G / 車局現在偏向馬八進七，用來守住兵線，避免敵方 G 壓兵線。
- 修正前 AI 會把炮局錯套兵線防守，導致馬八進七拿到錯誤高分；這次已分流。
- 更新 AI reason：`活馬解除邊炮壓制`、`活象解除邊炮壓制`、`守住兵線，避免敵方 G 壓兵線`、`活馬落點不符當前威脅，已扣分`。

### 修改了哪些檔案
- `src/ai/simpleAi.ts`
  - 新增邊炮壓制與邊 G / 車壓兵線 helper。
  - 調整 `structurePatternEvaluation()`，避免馬八進七在邊炮局吃到主要解壓分。
- `tests/rules.test.ts`
  - 新增紅邊炮局與紅邊 G / 車局的 AI 開局推薦回歸測試。
- `CODEX_STATUS.md`
  - 記錄本輪完成內容。
- `NEXT_TASK.md`
  - 將本輪 pattern 分流列入已完成，保留後續建議。

### npm test 是否通過
- 通過：`npm.cmd test`

### npm run build 是否通過
- 通過：`npm.cmd run build`
- 備註：仍有既有 `.playbackMoveScroll` CSS minify warning，本輪未處理 CSS。

### 目前還有哪些已知限制
- 這仍是 simpleAi heuristic，不是 Belief State / Monte Carlo。
- 開局棋理還需要更多回歸測試覆蓋不同邊、不同子力排列。
- pattern 觸發紀錄、AI VS AI 對局資料統計、自我對弈調參尚未做。

### 是否已經 push 到 GitHub
- 本段更新完成後將 commit 並 push。
