# Codex Status

## 最新完成的工作

2026-06-25 完成 Phase 1 / early AI 小範圍修正：

- 合法走棋成功後播放落子音效，紅黑雙方都適用。
- 不合法點擊、只選棋、局面編輯、長按修正不播放落子音效。
- 保留既有絕殺音效，仍只在進入勝負狀態時觸發。
- 長按修正選單改為顯示在被長按棋子附近。
- 修正選單靠近視窗邊界時會自動往內收，不固定在下方側欄。
- 點空白處可取消修正選單。
- 長按不會觸發一般走棋。
- 手動修正棋種時，未翻暗子的預設 `realType` 不再阻擋修正。
- 修正後會依公開棋子重新補正同方未翻暗子的 `realType`，避免後續翻出超過合理數量的棋子。

## 修改了哪些檔案

- `src/App.tsx`
  - 加入長按修正選單座標、邊界避讓、點空白取消。
  - 保留合法走棋成功後才播放落子音效。
  - 修復原本亂碼造成的部分 JSX 顯示標籤問題。
- `src/components/Board.tsx`
  - 讓長按事件把棋子附近的螢幕座標傳回 App。
- `src/components/Square.tsx`
  - 長按時記錄棋子中心點座標。
  - 長按後抑制一般 click，避免誤走棋。
- `src/style.css`
  - 修正選單改為 fixed 浮動面板。
- `src/game/pieceInventory.ts`
  - 棋種數量檢查改以公開棋子為硬限制。
  - 新增未翻暗子 `realType` 補正邏輯。
- `src/game/boardEditing.ts`
  - 編輯 / 修正棋子後套用暗子池補正。
  - 未翻棋子的預設 `realType` 不再先阻擋人工修正。
- `src/vite-env.d.ts`
  - 補上本專案 React shim 需要的 `useRef` 與事件型別。
- `tests/rules.test.ts`
  - 新增紅黑合法走棋音效條件測試。
  - 新增人工修正不受隱藏 `realType` 阻擋的回歸測試。

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

- 長按修正仍是手動工具，沒有做被吃子 UI、棋譜回放或 Threat Map。
- 目前只做公開棋子與未翻暗子池的最小補正，還不是完整 Belief State。
- 沒有做 Monte Carlo、OCR、Ponder、自動截圖辨識。

## 是否已經 push 到 GitHub

本輪測試與 build 已通過，會依流程 commit 並 push；若看到此版本在 GitHub 上，代表本輪已 push。
