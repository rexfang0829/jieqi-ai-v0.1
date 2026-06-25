# Shared AI Status（Claude / Codex / ChatGPT 共用）

> 此文件由 Claude、Codex、ChatGPT 共同維護，記錄每輪 AI 完成的工作。  
> 任何 AI 完成工作後都應更新此文件，並以日期 + 工具名稱標記。

## 最新完成的工作

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
