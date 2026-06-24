# Codex Status

## 最新完成的工作

2026-06-25 本輪只做「被吃子資訊 UI 收斂 + AI 建議說明文字」：

- 已新增被吃子資訊區 `CapturedPanel`。
- 已從 history 整理紅方被吃 / 黑方被吃。
- 已區分明子被吃與暗子被吃。
- 暗子被吃會顯示「暗子（翻出 X）」。
- cannon 顯示仍依 side 區分：紅方「炮」、黑方「包」。
- 已加入 AI 建議簡易評分標示。
- AI 面板 playing 狀態顯示「AI 建議（簡易評分）」與簡短限制說明。
- 已絕殺時仍優先顯示絕殺 / 本局結束，不顯示一般推薦文案。

## 本輪未改動

- 沒有改規則引擎。
- 沒有改 AI 搜尋。
- 沒有改 Move 資料模型。
- 沒有改 board 座標系。
- 沒有做 Belief State。
- 沒有做 Monte Carlo。
- 沒有做 OCR / 自動截圖辨識。
- 沒有做 Ponder。

## 修改了哪些檔案

- `src/App.tsx`
- `src/components/AiPanel.tsx`
- `src/components/CapturedPanel.tsx`
- `src/ai/simpleAiText.ts`
- `src/game/capturedPieces.ts`
- `src/style.css`
- `tests/rules.test.ts`
- `CODEX_STATUS.md`
- `NEXT_TASK.md`

## npm install 是否完成

完成。

```bash
npm.cmd install
```

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

- AI 仍是 simpleAi 的簡易評分，不是完整最佳手搜尋。
- 尚未做 Threat Map。

## 是否已經 push 到 GitHub

是。本輪會以 commit message `add captured pieces panel and ai disclaimer` push 到 GitHub。
