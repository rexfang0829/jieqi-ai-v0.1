# Codex Status

## 最新完成的工作

2026-06-25 本輪完成音效系統升級。

- 改寫 `src/game/soundEffects.ts`：
  - `playMoveSound()`：白噪音 + bandpass 900Hz，模擬木頭棋子輕敲聲。
  - `playCaptureSound()`：白噪音 + bandpass 700Hz，力道更重的吃子聲。
  - `playCheckSound()`：棋子聲 + `speechSynthesis` 男聲語音「將軍」（pitch 0.7、rate 0.85、lang zh-TW）。
  - 移除舊的 square wave 電子音。
- 改寫 `src/game/endgameSound.ts`：
  - 四層疊加：白噪音重擊（t=0）、低頻 sine 55Hz（t=0）、sawtooth 金屬餘音 600→80Hz（t=0.15）、sine 鐘聲 220Hz（t=0.5）。
  - 語音「絕殺」延遲 400ms，pitch 0.6、rate 0.75。
- 更新 `src/App.tsx`：
  - 新增 `pickMoveSound()` 輔助函式，依 isInCheck / hasCaptured / 普通走步分流。
  - `click()` 與 `syncClick()` 分別觸發正確聲音，絕殺時不重複播棋子聲（由 endgame useEffect 負責）。
  - import 更新：加入 `isInCheck`、`playCaptureSound`、`playCheckSound`。
- 補測試（`tests/rules.test.ts`）：
  - `playMoveSound` / `playCaptureSound` / `playCheckSound` 在無 AudioContext 環境不 throw。
  - 吃子 move 的 `history` 含有 `captured` 棋子。
  - 普通 move 的 `history` 無 `captured`（為 null）。
  - 絕殺 move 的 `status` 變為 `red_win`。

## 修改了哪些檔案

- `src/game/soundEffects.ts`：完全改寫。
- `src/game/endgameSound.ts`：完全改寫。
- `src/App.tsx`：更新 import 與聲音觸發邏輯。
- `tests/rules.test.ts`：新增 7 個音效相關測試。
- `CODEX_STATUS.md`：更新本輪結果。
- `NEXT_TASK.md`：清空待規劃。

## npm test 是否通過

通過（全部 86 個測試 ok）。

## npm run build 是否通過

TypeScript 編譯（`tsc --noEmit`）零錯誤。
`vite build` 需在 Windows 環境執行（Linux 沙箱缺少 rollup-linux native 模組，屬環境問題非程式碼問題）。

## 目前還有哪些已知限制

- 語音品質取決於裝置已安裝的 zh-TW 語音；若無男聲，自動 fallback 至任一中文語音。
- 音效不含音量控制 UI，未來可加靜音按鈕。
- 沒有做首頁、棋譜回放、Threat Map、AI VS AI、AI 重寫、後端或資料庫。
- 沒有做 Belief State、Monte Carlo、OCR、Ponder、自動截圖辨識。

## 是否已經 push 到 GitHub

待使用者在 Windows 執行 `npm run build` 確認後，執行：
```
git add .
git commit -m "upgrade sound effects: wooden tap, capture, check voice, checkmate epic sound"
git push
```
