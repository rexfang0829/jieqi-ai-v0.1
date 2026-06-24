# Codex Status

## 最新完成的工作

本輪完成兩件 Phase 1 / early AI 工作：

1. 修正棋盤 UI，從「格子中心」改成中國象棋「十字交叉點」棋盤。
2. 改善 `simpleAi`，加入最小版本安全評估，避免推薦明顯送子的步。

棋盤 UI 已完成：

- 棋子視覺上站在線與線的交叉點。
- 棋盤資料仍維持 `board[10][9]`。
- 楚河漢界是第 4 排與第 5 排交叉點之間的視覺空白。
- 楚河漢界不再是一排可走格子。
- 合法步提示顯示在交叉點。
- 合法吃子目標會高亮該交叉點上的棋子。
- 象 / 相的合法提示仍只出現在田字位置。

AI 安全評估已完成：

- 每個候選走法會模擬走完後局面。
- 會檢查對方下一手是否可吃回剛移動的棋子。
- 若可被吃回，會依照該棋價值扣分。
- 會估計對方下一手最大吃子收益並扣分。
- 敵方暗子威脅只使用 `originalType`，不偷看未翻開的 `realType`。
- 推薦理由會提示安全吃子、避免送子或已扣分。

## 修改了哪些檔案

- `src/components/Board.tsx`
  - 改成交叉點棋盤結構。
  - 使用 SVG 畫 9 路直線、10 條橫線與九宮斜線。
  - 楚河漢界改成非點擊的視覺空白。
- `src/components/Square.tsx`
  - 合法吃子目標新增高亮 class。
- `src/style.css`
  - 重寫棋盤、交叉點、河界、合法點與吃子高亮樣式。
- `src/game/boardLayout.ts`
  - 新增棋盤視覺座標 helper 與 10 x 9 shape 檢查。
- `src/ai/simpleAi.ts`
  - 新增一層安全評估與 opponent reply 估值。
- `tests/rules.test.ts`
  - 新增棋盤資料 / 河界 / 合法提示 / 象相提示測試。
  - 新增 AI 避免立即被高價吃回測試。
  - 新增 AI 評估敵方暗子威脅時不偷看 `realType` 測試。
- `CODEX_STATUS.md`
  - 更新本輪狀態。
- `NEXT_TASK.md`
  - 更新下一輪建議任務。

## npm test 是否通過

通過。

執行指令：

```bash
npm.cmd test
```

## npm run build 是否通過

通過。

執行指令：

```bash
npm.cmd run build
```

## 目前還有哪些已知限制

- AI 只有一層安全評估，不是完整搜尋。
- 目前只支援單一局面儲存，不支援多局面管理。
- `history` 載入時會重設為空陣列。
- 尚未完整實作雙方資訊不對稱。
- 尚未建立天天象棋手動同步流程。
- 尚未做 Belief State。
- 尚未做 Monte Carlo。
- 尚未做 OCR。
- 尚未做 Ponder。
- 尚未做自動截圖辨識。

## 是否已經 push 到 GitHub

是。本輪會以 commit message `fix board intersection ui and improve ai safety scoring` push 到 GitHub。
