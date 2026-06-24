# Codex Status

## 最新完成的工作

2026-06-25 本輪只做 Vercel 部署設定正式修正與手機版最新部署準備：

- 已固定 package versions，不再使用 `latest`。
- 已將 React 固定為 `18.3.1`。
- 已將 React DOM 固定為 `18.3.1`。
- 已將 Vite 固定為 `5.4.11`。
- 已將 `@vitejs/plugin-react` 固定為 `4.3.3`。
- 已將 TypeScript 固定為 `5.6.3`。
- 已修正 tsconfig build 問題，移除 TypeScript 5.6.3 不支援的 `ignoreDeprecations: "6.0"`。
- 已重新產生 / 更新 `package-lock.json`。
- Vercel 可回到標準 `npm run build`。
- 已更新 `DEPLOYMENT.md` 與 `README_V0.1.md` 的部署說明。

## 本輪未改動

- 沒有重做士 / 象揭棋規則。
- 沒有重做炮 / 包顯示。
- 沒有重做暗子被吃 / 明子被吃。
- 沒有重做黑方 board edge labels。
- 沒有改 moveNotation。
- 沒有改 `board[10][9]` 座標系。
- 沒有改 AI 評分。

## 修改了哪些檔案

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `DEPLOYMENT.md`
- `README_V0.1.md`
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

- 尚未做 Belief State。
- 尚未做 Monte Carlo。
- 尚未做 OCR / 自動截圖辨識。
- 尚未做 Ponder。
- AI 仍是規則型評分加一層安全檢查。

## 是否已經 push 到 GitHub

是。本輪會以 commit message `stabilize vercel build configuration` push 到 GitHub。
