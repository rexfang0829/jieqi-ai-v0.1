# Codex Status

## 最新完成的工作

2026-06-25 本輪只修棋盤邊界路數顯示：

- 修正上方黑方邊界路數 UI：顯示為 `1 2 3 4 5 6 7 8 9`。
- 修正下方紅方邊界路數 helper：顯示為 `九 八 七 六 五 四 三 二 一`。
- 移除 `.topFileLabels` 的 180 度旋轉，避免手機與桌面看到的黑方邊界順序相反或錯亂。
- 補上 board edge labels 回歸測試，確認黑方邊界不會左右顛倒。

## 本輪確認

- 這次修的是 board edge labels。
- 不是重新修 AI 座標。
- 沒有改 `board[10][9]` 內部座標。
- 沒有改合法步產生。
- 沒有改 AI。
- 沒有改 move history 主流程。
- `moveNotation` 的黑方路數已有回歸測試，未重改。
- `AiPanel` 與 `MoveList` 仍共用 `moveText`。

## 修改了哪些檔案

- `src/game/boardLayout.ts`
- `src/style.css`
- `tests/rules.test.ts`
- `CODEX_STATUS.md`
- `NEXT_TASK.md`

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

- 尚未做 Belief State。
- 尚未做 Monte Carlo。
- 尚未做 OCR / 自動截圖辨識。
- 尚未做 Ponder。
- AI 仍是規則型評分加一層安全檢查。

## 是否已經 push 到 GitHub

是。本輪會以 commit message `fix board edge labels for black side` push 到 GitHub。
