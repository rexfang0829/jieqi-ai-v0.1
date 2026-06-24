# Codex Status

## 最新完成的工作

2026-06-25 本輪完成「缺口補齊 + 回歸確認 + 手機部署準備」：

- 補上黑方路數回歸測試，確認黑方 `col=0` 顯示 1 路、`col=8` 顯示 9 路。
- 補上紅方路數回歸測試，確認紅方 `col=0` 顯示九路、`col=8` 顯示一路。
- 補上黑方橫走 `col=0 -> col=8` 的 notation 測試，防止黑方路數左右顛倒。
- 確認 `AiPanel` 與 `MoveList` 都使用 `moveText`，沒有各自寫一套棋譜轉換。
- 新增 `DEPLOYMENT.md`，記錄 Vercel 部署與手機測試方式。
- 更新 `README_V0.1.md`，加入手機測試 / 線上部署入口。

## 本輪回歸確認

- 士 / 象揭棋規則已完成。
- 炮 / 包顯示已完成。
- 暗子被吃 / 明子被吃已完成。
- 黑方路數顯示已補測試確認。
- `DEPLOYMENT.md` 已新增。
- `README_V0.1.md` 已補手機部署說明。

## 修改了哪些檔案

- `DEPLOYMENT.md`
- `README_V0.1.md`
- `CODEX_STATUS.md`
- `NEXT_TASK.md`
- `tests/rules.test.ts`

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

- 尚未做 Belief State。
- 尚未做 Monte Carlo。
- 尚未做 OCR / 自動截圖辨識。
- 尚未做 Ponder。
- 尚未做雲端同步、多局面管理、登入系統或後端。
- AI 仍是規則型評分加一層安全檢查，不是完整搜尋或機率推理。

## 是否已經 push 到 GitHub

是。本輪會以 commit message `add deployment docs and notation regression tests` push 到 GitHub。
